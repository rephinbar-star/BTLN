// Suggestion-check status and free "Resubmit to recover suggestions" (advice-review-2).
//
// - "status":  owner-only review state.
// - "retry":   RETIRED. The old post-completion retry read a stored transcript
//              excerpt; that store no longer exists. Returns resubmit_required.
// - "recover": the owner resubmits the same conversation. The text is used in
//              memory for this request only (never stored or logged). A keyed
//              one-way fingerprint must match the original input; the claim is
//              atomic and consumes the single recovery for this report. Inside:
//              initial check + at most one automatic retry of the report's own
//              hidden suggestions. No new analysis, no charge, no credit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";
import { withTestRun } from "../_shared/testRun.ts";
import { resolveRequestOwner } from "../_shared/requestOwner.ts";
import { currentTestRun, markStage } from "../_shared/testRunCore.ts";
import { callOpenRouter, extractJsonObject } from "../_shared/extractMessages.ts";
import { parseTwoPersonTranscript } from "../_shared/deterministicParse.ts";
import { ADVICE_SEMANTIC_VERSION, SEMANTIC_MODEL, applySemanticVerdicts, semanticRequest, type Msg, type Participant } from "../_shared/adviceRecipients.ts";
import { INPUT_FP_VERSION, REVIEW_TIMEOUT_MS, inputFingerprint, runRecovery } from "../_shared/adviceReview.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-btln-test-run, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const Body = z.object({
  action: z.enum(["status", "retry", "recover"]),
  analysis_id: z.string().uuid(),
  session_id: z.string().min(8).max(200).optional(),
  raw_text: z.string().max(3_000_000).optional(),
});

// Same selection rule the analysis used, so the same input normalizes identically.
const MAX_TOTAL_MESSAGES = 12_000;
const TS_RE = /^\[?\s*\d{1,2}[\/\-.]\d{1,2}|^\d{1,2}:\d{2}/;
const truncateConversation = (text: string, max: number): string => {
  const lines = text.split(/\r?\n/);
  const nonEmpty: number[] = [];
  lines.forEach((line, index) => { if (line.trim().length > 0) nonEmpty.push(index); });
  const dated = nonEmpty.filter((index) => TS_RE.test(lines[index]));
  const markers = dated.length >= 5 ? dated : nonEmpty;
  if (markers.length <= max) return text;
  return lines.slice(0, markers[max]).join("\n").trimEnd();
};

Deno.serve(withTestRun("advice-review", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Invalid request." });
  const { action, analysis_id, session_id } = parsed.data;
  let rawText: string | null = parsed.data.raw_text ?? null;

  const owner = await resolveRequestOwner(req);
  if (owner.kind === "invalid") return json(401, { error: "Please sign in again." });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: a } = await admin.from("analyses").select("id,user_id,session_id,status,is_paid,context_data").eq("id", analysis_id).maybeSingle();
  // Ownership: signed-in owner, or (unclaimed guest report) the original session proof. Report id alone is never enough.
  const allowed = !!a && (a.user_id ? owner.kind === "user" && owner.id === a.user_id : !!session_id && a.session_id === session_id);
  if (!allowed) return json(404, { error: "Report not found." });

  await admin.rpc("expire_advice_reviews");
  const readState = async () => {
    const { data: r } = await admin.from("advice_reviews").select("status,attempts,max_attempts,terminal_reason,recovery_state,recovery_attempts").eq("analysis_id", analysis_id).maybeSingle();
    const { data: row } = await admin.from("analyses").select("result_json").eq("id", analysis_id).maybeSingle();
    const ai = (row?.result_json as any)?.advice_integrity ?? null;
    return {
      review: r ? { status: r.status, attempts: r.attempts, max_attempts: r.max_attempts, terminal_reason: r.terminal_reason, recovery: r.recovery_state, recovery_attempts: r.recovery_attempts, can_retry: false, can_recover: r.recovery_state === "available" } : null,
      advice_integrity: ai ? { review: ai.review ?? null, note: ai.note ?? null, withheld_count: ai.withheld_count ?? 0 } : null,
    };
  };
  if (action === "status") return json(200, await readState());
  if (action === "retry") return json(200, { ok: false, reason: "resubmit_required", ...(await readState()) });

  // ---- recover ----
  // Evaluation isolation: a report produced by a test run can be recovered only
  // inside the SAME operator-issued recovery-probe run (metered), never by a
  // customer path or another run.
  const ctx0 = currentTestRun();
  const { data: art } = await admin.from("evaluation_artifacts").select("run_id").eq("source_kind", "deep_read").eq("source_id", analysis_id).maybeSingle();
  const probeRun = ctx0?.kind === "metered" && !!ctx0.recoveryProbe && !!art && art.run_id === ctx0.runId;
  if (art && !probeRun) return json(200, { ok: false, reason: "not_recoverable" });
  // Entitlement: the same access that unlocks the full report (no new purchase, credit or checkout).
  let entitled = a!.is_paid === true;
  if (!entitled && owner.kind === "user") {
    const { data: paid } = await admin.rpc("user_has_paid_access", { p_user_id: owner.id, p_analysis_id: analysis_id });
    entitled = paid === true;
  }
  // Probe limit (documented): synthetic accounts hold no purchase, and none is faked.
  // Inside the bound probe run only, the entitlement result is recorded, not enforced.
  const entitlementChecked = entitled;
  if (!entitled && probeRun) entitled = true;
  if (!entitled) return json(200, { ok: false, reason: "not_entitled" });
  if (!rawText?.trim()) return json(200, { ok: false, reason: "input_required" });
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json(200, { ok: false, reason: "unavailable" });

  let claimed = false, finished = false;
  try {
    const ctx = (a!.context_data ?? {}) as { name1?: string; name2?: string };
    const name1 = String(ctx.name1 ?? "").trim(), name2 = String(ctx.name2 ?? "").trim();
    const text = truncateConversation(rawText, MAX_TOTAL_MESSAGES);
    const fp = await inputFingerprint(Deno.env.get("ADVICE_INPUT_FP_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", analysis_id, text);
    // Preflight (does not consume the recovery): readable two-person transcript with the report's names.
    const n = (s: string) => s.trim().toLowerCase();
    const p = parseTwoPersonTranscript(text);
    const rows = p.messages.filter((m) => n(m.sender) === n(name1) || n(m.sender) === n(name2));
    if (!fp || !name1 || !name2 || n(name1) === n(name2) || rows.length < 2 || rows.length / Math.max(1, p.messages.length) < 0.9) {
      return json(200, { ok: false, reason: "format_unsupported" });
    }
    const canon: Msg[] = rows.map((m) => ({ sender_role: n(m.sender) === n(name1) ? "user" : "partner", content: m.content }));
    const parts: Participant[] = [{ id: "p1", label: name1, role: "user" }, { id: "p2", label: name2, role: "partner" }];

    const out = await runRecovery({
      version: ADVICE_SEMANTIC_VERSION,
      applyVerdicts: applySemanticVerdicts,
      build: (items) => semanticRequest(items, parts, canon),
      claim: async () => {
        const { data, error } = await admin.rpc("claim_advice_recovery", { p_analysis_id: analysis_id, p_input_fp: fp, p_fp_version: INPUT_FP_VERSION });
        if (error || !data) return { ok: false, reason: "claim_failed" };
        if ((data as any).ok) claimed = true;
        return data as any;
      },
      callModel: async (system, user) => {
        markStage("advice_check");
        const r = await callOpenRouter({ model: SEMANTIC_MODEL, max_tokens: 1500, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] },
          key, Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app", Deno.env.get("OPENROUTER_X_TITLE") ?? "BetweenTheLines", { timeoutMs: REVIEW_TIMEOUT_MS, singleAttempt: true });
        try { return r.ok ? extractJsonObject(String(r.data?.choices?.[0]?.message?.content ?? "")).value ?? null : null; } catch { return null; }
      },
      finish: async (f) => {
        const { data, error } = await admin.rpc("finish_advice_recovery", { p_analysis_id: analysis_id, p_base_hash: f.base_hash, p_new_result: f.new_result, p_status: f.status, p_attempts: f.attempts, p_terminal_reason: f.terminal_reason });
        if (error) return { ok: false, reason: "finish_failed" };
        finished = true; // stale or not, the claimed recovery is settled by the database
        return data as any;
      },
    });
    return json(200, { ...out, ...(probeRun ? { probe: { entitlement_checked: entitlementChecked, entitlement_waived_for_probe: !entitlementChecked } } : {}), ...(await readState()) });
  } finally {
    rawText = null; // resubmitted text is never persisted; drop the reference on every path
    if (claimed && !finished) await admin.rpc("advice_review_terminate", { p_analysis_id: analysis_id, p_reason: "recovery_failed" });
  }
}));
