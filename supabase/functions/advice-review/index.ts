// "Finish checking suggestions" for a completed Deep Read (advice-review-1).
// Re-runs ONLY the advice recipient review for items left unresolved, never the
// Deep Read itself. No charge, no credit, no entitlement change. The attempt cap,
// single-flight lease, backoff, evidence expiry and stale-report guard are
// enforced atomically in the database (claim_advice_review / finish_advice_review).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";
import { withTestRun } from "../_shared/testRun.ts";
import { resolveRequestOwner } from "../_shared/requestOwner.ts";
import { markStage } from "../_shared/testRunCore.ts";
import { callOpenRouter, extractJsonObject } from "../_shared/extractMessages.ts";
import { ADVICE_SEMANTIC_VERSION, SEMANTIC_MODEL, applySemanticVerdicts } from "../_shared/adviceRecipients.ts";
import { REVIEW_TIMEOUT_MS, runReviewRetry } from "../_shared/adviceReview.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-btln-test-run, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const Body = z.object({ action: z.enum(["status", "retry"]), analysis_id: z.string().uuid(), session_id: z.string().min(8).max(200).optional() });

Deno.serve(withTestRun("advice-review", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const { action, analysis_id, session_id } = parsed.data;

  const owner = await resolveRequestOwner(req);
  if (owner.kind === "invalid") return json(401, { error: "Please sign in again." });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: a } = await admin.from("analyses").select("id,user_id,session_id,status").eq("id", analysis_id).maybeSingle();
  const allowed = !!a && (a.user_id ? owner.kind === "user" && owner.id === a.user_id : !!session_id && a.session_id === session_id);
  if (!allowed) return json(404, { error: "Report not found." });

  await admin.rpc("expire_advice_reviews");
  const readState = async () => {
    const { data: r } = await admin.from("advice_reviews").select("status,attempts,max_attempts,terminal_reason,lease_until,evidence_expires_at").eq("analysis_id", analysis_id).maybeSingle();
    const { data: row } = await admin.from("analyses").select("result_json").eq("id", analysis_id).maybeSingle();
    const ai = (row?.result_json as any)?.advice_integrity ?? null;
    return {
      review: r ? { status: r.status, attempts: r.attempts, max_attempts: r.max_attempts, terminal_reason: r.terminal_reason, in_flight: !!r.lease_until && new Date(r.lease_until) > new Date(), can_retry: r.status === "pending" && r.attempts < r.max_attempts } : null,
      advice_integrity: ai ? { review: ai.review ?? null, note: ai.note ?? null, withheld_count: ai.withheld_count ?? 0 } : null,
    };
  };
  if (action === "status") return json(200, await readState());

  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json(503, { error: "Checking is unavailable right now." });
  let heldAttempt: number | null = null;
  try {
    const out = await runReviewRetry({
      version: ADVICE_SEMANTIC_VERSION,
      applyVerdicts: applySemanticVerdicts,
      claim: async () => {
        const { data, error } = await admin.rpc("claim_advice_review", { p_analysis_id: analysis_id });
        if (error || !data) return { ok: false, reason: "claim_failed" };
        if ((data as any).ok) heldAttempt = (data as any).attempt;
        return data as any;
      },
      callModel: async (system, user) => {
        markStage("advice_check");
        const r = await callOpenRouter({ model: SEMANTIC_MODEL, max_tokens: 1500, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] },
          key, Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://betweenthelines.app", Deno.env.get("OPENROUTER_X_TITLE") ?? "BetweenTheLines", { timeoutMs: REVIEW_TIMEOUT_MS, singleAttempt: true });
        try { return r.ok ? extractJsonObject(String(r.data?.choices?.[0]?.message?.content ?? "")).value ?? null : null; } catch { return null; }
      },
      finish: async (f) => {
        const { data, error } = await admin.rpc("finish_advice_review", { p_analysis_id: analysis_id, p_attempt: f.attempt, p_base_hash: f.base_hash, p_new_result: f.new_result, p_remaining: f.remaining, p_status: f.status, p_terminal_reason: f.terminal_reason });
        if (error) return { ok: false, reason: "finish_failed" };
        if ((data as any)?.ok) heldAttempt = null;
        return data as any;
      },
    });
    return json(200, { ...out, ...(await readState()) });
  } finally {
    if (heldAttempt !== null) await admin.rpc("release_advice_review", { p_analysis_id: analysis_id, p_attempt: heldAttempt });
  }
}));
