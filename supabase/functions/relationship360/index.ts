// Relationship360 — the real engine.
//
// Owner-only and Prime-gated on the server. It reads the completed reports the
// person confirmed and included, turns them into normalised observations with
// provenance, then runs one bounded synthesis call over those observations —
// never over raw uploaded messages.
//
// Safety properties:
//  - Ownership, current activation consent, identity and eligibility are checked
//    at the start AND re-checked at commit.
//  - Exactly one running job per scope (enforced by a unique index, not a read).
//  - Unchanged evidence returns the stored profile instead of paying for a rebuild.
//  - Jobs are versioned. If the person corrects, excludes or deletes anything
//    while a job runs, journey_write_summary refuses the late write.
//  - Every claim of recurrence is re-validated against distinct sources, and a
//    cross-relationship claim against distinct CONFIRMED relationships.
//  - Observation text is fenced as untrusted data in the prompt.

import { compactContext, expandRefs, R360_CONTEXT_VERSION } from "../_shared/r360Context.ts";
import { estimateInputTokens, maxCostUsd } from "../_shared/promptBudget.ts";
import { withTestRun } from "../_shared/testRun.ts";
import { codeBaseline } from "../_shared/modeEval.ts";
import { currentTestRun, inStage, markStage, systemFor } from "../_shared/testRunCore.ts";
import { relationship360System, RELATIONSHIP360_ASK_SYSTEM } from "../_shared/modePrompts.ts";
import {
  ASK_LIMITS, buildAskContext, isEligibleSource, pickNotes, askScopeParts, selectObservations, selectSources, validateAskOutput, validateQuestion,
  type AskNote, type AskObservation, type AskSource,
} from "../_shared/r360AskCore.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { callOpenRouter } from "../_shared/extractMessages.ts";
import { loadCoachingPreferences, coachingPreferenceInstruction } from "../_shared/coachingPreferences.ts";
import { extractJsonObject } from "../_shared/extractJson.ts";
import {
  adaptDeepRead,
  adaptGroupRead,
  adaptGroupRoast,
  adaptInteractiveEvent,
  adaptQuickTake,
  type ObservationDraft,
} from "../_shared/r360Adapters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-btln-test-run",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "openai/gpt-6-astra";
const MAX_OBSERVATIONS = 120;
const MAX_TOKENS = 2_600;
// Per-call upper bound kept below the $0.60 operator cap (same bound applies to real users; no cap change).
const CALL_BUDGET_USD = 0.58;
const STALE_JOB_MS = 5 * 60 * 1000;
const CURRENT_CONSENT_VERSION = 2;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const activeRow = (row: { status?: string | null; current_period_end?: string | null }) =>
  ["active", "trialing", "past_due"].includes(row.status ?? "") &&
  (!row.current_period_end || new Date(row.current_period_end).getTime() > Date.now());

const SOURCE_TABLE: Record<string, string> = {
  quick_take: "decodes",
  deep_read: "analyses",
  group_read: "group_reads",
  group_roast: "group_roasts",
};

const SOURCE_LABEL: Record<string, string> = {
  quick_take: "Quick Take",
  deep_read: "Deep Read",
  group_read: "Group Read",
  group_roast: "Group Roast",
};

type SourceRow = {
  id: string;
  relationship_id: string;
  source_kind: string;
  source_id: string;
  subject_participant: string | null;
  subject_participant_id: string | null;
  identity_status: string;
  excluded_at: string | null;
  observed_period_start: string | null;
  observed_period_end: string | null;
  updated_at?: string | null;
};

type ObservationRow = {
  id: string;
  journey_source_id: string;
  subject_kind: string;
  subject_label: string | null;
  observation_type: string;
  statement: string;
  evidence_refs: unknown;
  confidence: string;
  observed_period_start: string | null;
  observed_period_end: string | null;
  created_at: string;
};

const fingerprint = async (parts: string[]) => {
  const bytes = new TextEncoder().encode(parts.sort().join("|"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
};

/**
 * Representative selection. Oldest-first slicing silently dropped the newest
 * evidence, which is exactly what a longitudinal read needs. This takes a fair
 * share from every source, newest first within each, and reports what it omitted.
 */
const selectRepresentative = (rows: ObservationRow[], cap: number) => {
  if (rows.length <= cap) return { kept: rows, omitted: 0 };
  const bySource = new Map<string, ObservationRow[]>();
  for (const row of rows) {
    const list = bySource.get(row.journey_source_id) ?? [];
    list.push(row);
    bySource.set(row.journey_source_id, list);
  }
  for (const list of bySource.values()) list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const kept: ObservationRow[] = [];
  let index = 0;
  while (kept.length < cap) {
    let added = false;
    for (const list of bySource.values()) {
      if (index < list.length) {
        kept.push(list[index]);
        added = true;
        if (kept.length >= cap) break;
      }
    }
    if (!added) break;
    index += 1;
  }
  return { kept, omitted: rows.length - kept.length };
};

Deno.serve(withTestRun("relationship360", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("OPENROUTER_API_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service || !authorization) return json(401, { error: "Sign in required" });

  const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await auth.auth.getUser();
  if (userError || !user) return json(401, { error: "Sign in required" });

  const payload = await req.json().catch(() => null);
  const action = payload?.action === "build" ? "build" : payload?.action === "reflect" ? "reflect" : payload?.action === "ask" ? "ask" : "status";
  const relationshipId: string | null = typeof payload?.relationship_id === "string" && UUID_RE.test(payload.relationship_id)
    ? payload.relationship_id
    : null;

  // ---- Prime, server-side. Privacy controls live elsewhere and are never gated. ----
  const [{ data: entitlementRows, error: entitlementError }, { data: subscriptionRows, error: subscriptionError }] = await Promise.all([
    admin.from("subscription_entitlements").select("status,current_period_end,entitlement")
      .eq("user_id", user.id).in("entitlement", ["prime", "relationship360"]),
    admin.from("user_subscriptions").select("status,current_period_end,tier").eq("user_id", user.id).eq("tier", "prime"),
  ]);
  if (entitlementError || subscriptionError) return json(500, { error: "Could not check your membership." });
  const prime = (entitlementRows ?? []).some(activeRow) || (subscriptionRows ?? []).some(activeRow);

  const { data: profile, error: profileError } = await admin
    .from("journey_profiles")
    .select("opted_in_at,data_version,consent_version,activation_consent_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return json(500, { error: "Could not read your Relationship360 settings." });

  const relationshipsQuery = await admin.from("journey_relationships")
    .select("id,label,kind,scope,is_confirmed,data_version").eq("user_id", user.id);
  if (relationshipsQuery.error) return json(500, { error: "Could not read your relationships." });
  const relationships = relationshipsQuery.data ?? [];
  const relById = new Map(relationships.map((r) => [r.id, r]));

  // ---------------------------------------------------------------- reflect --
  // A reflection is the person's own account. It is stored as self-reported and
  // never becomes observed evidence. References are validated against the owner
  // before the service-role write.
  if (action === "reflect") {
    const kind = ["reflection", "action_outcome", "review_note"].includes(payload?.reflection_kind)
      ? payload.reflection_kind
      : "reflection";
    const body = typeof payload?.response_text === "string" ? payload.response_text.trim() : "";
    const outcome = ["used", "partly_used", "not_used", "not_applicable"].includes(payload?.outcome) ? payload.outcome : null;
    if (!body || body.length > 2_000) return json(400, { error: "Write between 1 and 2000 characters." });
    if (relationshipId && !relById.has(relationshipId)) return json(403, { error: "That relationship is not yours." });

    const recommendationId = typeof payload?.recommendation_id === "string" ? payload.recommendation_id.slice(0, 120) : null;
    if (recommendationId) {
      // The recommendation must exist in a summary this person owns.
      const { data: summaries, error: summaryError } = await admin
        .from("journey_summaries").select("content,relationship_id").eq("user_id", user.id);
      if (summaryError) return json(500, { error: "Could not save your reflection." });
      const known = (summaries ?? []).some((row) => {
        // deno-lint-ignore no-explicit-any
        const content = row.content as any;
        const ids = [
          ...(Array.isArray(content?.recommendations) ? content.recommendations : []),
          ...(Array.isArray(content?.patterns) ? content.patterns : []),
        ].map((item: { id?: unknown }) => String(item?.id ?? ""));
        return ids.includes(recommendationId);
      });
      if (!known) return json(400, { error: "That suggestion is not part of your Relationship360." });
    }

    const { error } = await admin.from("journey_reflections").insert({
      user_id: user.id,
      relationship_id: relationshipId,
      recommendation_id: recommendationId,
      reflection_kind: kind,
      response_text: body,
      outcome,
      self_reported_at: new Date().toISOString(),
    });
    if (error) return json(500, { error: "Could not save your reflection." });
    return json(200, { saved: true });
  }

  // ---- Eligible sources: owner, confirmed identity, not excluded. -------------
  const { data: allSources, error: sourcesError } = await admin
    .from("journey_sources")
    .select("id,relationship_id,source_kind,source_id,subject_participant,subject_participant_id,identity_status,excluded_at,observed_period_start,observed_period_end,updated_at,evaluation_run_id,quarantined_at,dated_count,undated_count,date_provenance,date_precision")
    .eq("user_id", user.id).is("quarantined_at", null);
  if (sourcesError) return json(500, { error: "Could not read your included conversations." });
  const sources = ((allSources ?? []) as SourceRow[]).filter((s) => !relationshipId || s.relationship_id === relationshipId);
  // Evaluation isolation (eval-isolation-1): output created by an operator test
  // run is only eligible inside a server-issued metered test run (the isolated
  // synthetic evaluation scope). Candidate output is quarantined in the database
  // and never eligible. Nothing here is controlled by the client.
  const tr = currentTestRun();
  const evalScope = tr?.kind === "metered" && tr.evalScope === true ? tr.runId : null;
  const eligible = sources.filter((s) => s.identity_status === "confirmed" && s.subject_participant && !s.excluded_at
    && !(s as { quarantined_at?: string | null }).quarantined_at
    && (evalScope !== null || !(s as { evaluation_run_id?: string | null }).evaluation_run_id));

  const scope = relationshipId ? "relationship" : "cross_relationship";
  const summaryQuery = admin
    .from("journey_summaries")
    .select("id,scope,relationship_id,content,coverage,is_stale,generated_at,model,evidence_source_ids,input_fingerprint")
    .eq("user_id", user.id)
    .eq("scope", scope);
  const { data: summaryRow, error: summaryError } = await (relationshipId
    ? summaryQuery.eq("relationship_id", relationshipId)
    : summaryQuery.is("relationship_id", null)).maybeSingle();
  if (summaryError) return json(500, { error: "Could not read your Relationship360." });

  const { data: jobs, error: jobsError } = await admin
    .from("journey_jobs")
    .select("id,status,kind,relationship_id,error_message,created_at,updated_at,attempt_count")
    .eq("user_id", user.id)
    .is("evaluation_run_id", null) // isolated test builds are never shown or reused by the ordinary view
    .neq("kind", "question_answer") // question usage rows are not profile builds
    .order("created_at", { ascending: false })
    .limit(10);
  if (jobsError) return json(500, { error: "Could not read your update history." });
  const latestJob = (jobs ?? []).find((j) => (j.relationship_id ?? null) === relationshipId) ?? null;

  const loadObservations = async (): Promise<ObservationRow[]> => {
    const { data, error } = await admin
      .from("journey_observations")
      .select("id,journey_source_id,subject_kind,subject_label,observation_type,statement,evidence_refs,confidence,observed_period_start,observed_period_end,created_at")
      .eq("user_id", user.id)
      .is("excluded_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_OBSERVATIONS * 4);
    if (error) throw new Error("observations");
    const eligibleIds = new Set(eligible.map((s) => s.id));
    return ((data ?? []) as ObservationRow[]).filter((o) => eligibleIds.has(o.journey_source_id));
  };

  // -------------------------------------------------------------------- ask --
  // Ephemeral question about the person's own included evidence. Nothing about
  // the question or answer is stored; only a content-free usage row counts calls.
  if (action === "ask") {
    if (!prime) return json(402, { error: "Relationship360 is part of Prime." });
    if (!profile?.opted_in_at) return json(403, { error: "Turn Relationship360 on first." });
    if (!profile.activation_consent_at || (profile.consent_version ?? 0) < CURRENT_CONSENT_VERSION) {
      return json(403, { error: "Confirm the current Relationship360 consent first." });
    }
    const q = validateQuestion(payload?.question);
    if (!q.ok) return json(400, { error: q.error });
    const relMap = new Map(relationships.map((r) => [r.id, { id: r.id, label: r.label, is_confirmed: !!r.is_confirmed }]));
    const NONE = "00000000-0000-0000-0000-000000000000";

    // One server read of the whole question scope. Used before the model call and
    // again before releasing the answer; any difference withholds the answer.
    const loadScope = async (requestedSources: unknown, requestedNotes: unknown) => {
      const [{ data: p, error: pe }, { data: srcRows, error: se }] = await Promise.all([
        admin.from("journey_profiles").select("opted_in_at,activation_consent_at,consent_version").eq("user_id", user.id).maybeSingle(),
        admin.from("journey_sources").select("id,relationship_id,source_kind,subject_participant,subject_participant_id,identity_status,excluded_at,quarantined_at,evaluation_run_id,updated_at,date_provenance,observed_period_start,observed_period_end")
          .eq("user_id", user.id).is("quarantined_at", null),
      ]);
      if (pe || se) return { ok: false as const, status: 500, error: "Could not read your included conversations." };
      if (!p?.opted_in_at || !p.activation_consent_at || (p.consent_version ?? 0) < CURRENT_CONSENT_VERSION) return { ok: false as const, status: 403, error: "Confirm the current Relationship360 consent first." };
      const eligibleAsk = ((srcRows ?? []) as AskSource[]).filter((s) => isEligibleSource(s, evalScope) && relMap.has(s.relationship_id));
      const pick = selectSources(eligibleAsk, requestedSources);
      if (!pick.ok) return { ok: false as const, status: 400, error: pick.error };
      const selected = pick.selected;
      const ids = selected.map((s) => s.id);
      const [{ data: obsRows, error: oe }, { data: noteRows, error: ne }] = await Promise.all([
        admin.from("journey_observations")
          .select("id,journey_source_id,subject_kind,subject_label,observation_type,statement,evidence_refs,confidence,observed_period_start,observed_period_end,created_at,version,updated_at,corrected_at")
          .eq("user_id", user.id).is("excluded_at", null).in("journey_source_id", ids.length ? ids : [NONE])
          .order("created_at", { ascending: false }).limit(ASK_LIMITS.maxObservations * 4),
        admin.from("journey_reflections").select("id,relationship_id,response_text,self_reported_at,excluded_at,updated_at")
          .eq("user_id", user.id).is("excluded_at", null).order("self_reported_at", { ascending: false }).limit(50),
      ]);
      if (oe || ne) return { ok: false as const, status: 500, error: "Could not read your stored observations." };
      const obs = selectObservations((obsRows ?? []) as AskObservation[], selected);
      const np = pickNotes((noteRows ?? []) as AskNote[], selected, relMap, requestedNotes);
      if (!np.ok) return { ok: false as const, status: 400, error: np.error };
      const fp = await fingerprint(askScopeParts(p, selected, obs, np.notes));
      return { ok: true as const, selected, obs, notes: np.notes, fp };
    };

    const first = await loadScope(payload?.source_ids, payload?.note_ids);
    if (!first.ok) return json(first.status, { error: first.error });
    const { selected, obs, notes } = first;
    const sourceMap = new Map(selected.map((s) => [s.id, s]));
    const zero = { sources: 0, dated: 0, notes: 0 };
    // No evidence, no model call (and no usage consumed).
    if (obs.length === 0) return json(200, { state: "no_evidence", support: zero });

    const ctx = buildAskContext(q.question, obs, notes, sourceMap, relMap);
    const estimated = maxCostUsd(MODEL, estimateInputTokens([{ content: RELATIONSHIP360_ASK_SYSTEM }, { content: ctx.text }]), ASK_LIMITS.maxOutputTokens) ?? Infinity;
    if (estimated > CALL_BUDGET_USD) return json(429, { error: "That question covers too much at once. Choose fewer reads." });

    // Atomic, server-only allowance: count + content-free insert under a per-account lock.
    const { data: usageId, error: usageError } = await admin.rpc("reserve_question_usage", {
      p_user: user.id, p_eval_run: evalScope, p_limit: ASK_LIMITS.dailyQuestions, p_started_version: profile.data_version ?? 0,
      p_usage: { sources: selected.length, observations: obs.length, notes: notes.length },
    });
    if (usageError) return json(500, { error: "Could not check your question allowance." });
    if (!usageId) return json(429, { error: `You can ask up to ${ASK_LIMITS.dailyQuestions} questions a day. Please try again later.` });
    const finish = (status: string, error_message: string | null = null) =>
      admin.from("journey_jobs").update({ status, error_message, completed_at: new Date().toISOString() }).eq("id", usageId as string);

    markStage("ask");
    const response = await callOpenRouter({
      model: MODEL,
      max_tokens: ASK_LIMITS.maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: RELATIONSHIP360_ASK_SYSTEM }, { role: "user", content: ctx.text }],
    }, aiKey ?? "", "https://betweenthelines.app", "BetweenTheLines Relationship360 Questions", { timeoutMs: 90_000, singleAttempt: true });
    if (!response.ok) {
      await finish("failed", `provider ${response.status}`);
      return json(response.status === 429 ? 429 : 502, { error: response.status === 429 ? "The answering service is busy. Please try again shortly." : "We could not get an answer right now. Nothing was saved." });
    }
    // deno-lint-ignore no-explicit-any
    const rawText = (response.data as any)?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = extractJsonObject(String(rawText)).value; } catch {
      await finish("failed", "unreadable output");
      return json(502, { error: "The answer could not be read. Nothing was saved." });
    }
    const answer = validateAskOutput(parsed, ctx.back, obs, notes, sourceMap, relMap);

    // Release-time recheck of consent, identity, sources, observation content and notes.
    const again = await loadScope(selected.map((s) => s.id), notes.map((n) => n.id));
    if (!again.ok || again.fp !== first.fp) {
      await finish("cancelled", "scope changed");
      return json(409, { error: "Your included sources, notes or consent changed while answering. Ask again." });
    }
    await finish("complete");
    return json(200, answer);
  }

  // ----------------------------------------------------------------- status --
  if (action === "status") {
    const { data: reflections, error: reflectionError } = await admin
      .from("journey_reflections")
      .select("id,recommendation_id,reflection_kind,response_text,outcome,self_reported_at,relationship_id")
      .eq("user_id", user.id)
      .is("excluded_at", null)
      .order("self_reported_at", { ascending: false })
      .limit(50);
    if (reflectionError) return json(500, { error: "Could not read your notes." });

    let observations: ObservationRow[] = [];
    try {
      observations = await loadObservations();
    } catch {
      return json(500, { error: "Could not read your stored observations." });
    }

    // A periodic review is offered only when genuinely new eligible evidence has
    // arrived since the stored profile was built. Nothing is sent anywhere.
    const generatedAt = summaryRow?.generated_at ? new Date(summaryRow.generated_at).getTime() : null;
    const newEvidence = generatedAt
      ? eligible.filter((s) => new Date(s.updated_at ?? 0).getTime() > generatedAt).length
      : 0;

    return json(200, {
      prime,
      opted_in: Boolean(profile?.opted_in_at),
      consent_current: Boolean(profile?.activation_consent_at) && (profile?.consent_version ?? 0) >= CURRENT_CONSENT_VERSION,
      counts: {
        linked: sources.length,
        eligible: eligible.length,
        pending: sources.filter((s) => s.identity_status === "pending").length,
        unresolved_relationships: sources.filter((s) => relById.get(s.relationship_id)?.is_confirmed === false).length,
      },
      review: { due: newEvidence > 0 && Boolean(summaryRow), new_sources: newEvidence },
      summary: summaryRow,
      job: latestJob,
      observations,
      // Source-level coverage from stored metadata for eligible (non-evaluation, non-quarantined) sources only.
      sources: eligible.map((s) => {
        const x = s as unknown as Record<string, unknown>;
        return { id: s.id, source_kind: s.source_kind, relationship_id: s.relationship_id, relationship_label: relById.get(s.relationship_id)?.label ?? null, dated_count: x.dated_count ?? null, undated_count: x.undated_count ?? null, date_provenance: x.date_provenance ?? null, date_precision: x.date_precision ?? null, observed_period_start: s.observed_period_start, observed_period_end: s.observed_period_end };
      }),
      reflections: reflections ?? [],
    });
  }

  // ------------------------------------------------------------------ build --
  if (!prime) return json(402, { error: "Relationship360 is part of Prime." });
  if (!profile?.opted_in_at) return json(403, { error: "Turn Relationship360 on first." });
  if (!profile.activation_consent_at || (profile.consent_version ?? 0) < CURRENT_CONSENT_VERSION) {
    return json(403, { error: "Confirm the current Relationship360 consent before building." });
  }
  if (relationshipId && !relById.has(relationshipId)) return json(403, { error: "That relationship is not available." });
  if (!aiKey) return json(500, { error: "The synthesis model is not configured." });
  if (eligible.length === 0) {
    return json(200, { state: "no_evidence", message: "No confirmed, included conversation contributes yet." });
  }

  const startedFromVersion = relationshipId ? relById.get(relationshipId)?.data_version : profile.data_version;
  if (startedFromVersion === undefined || startedFromVersion === null) return json(403, { error: "That relationship is not available." });

  // Consented style signals are part of the input: consent on/off, reset or
  // delete must not be answered from a cache built under different signals.
  const r360Style = coachingPreferenceInstruction(await loadCoachingPreferences(admin as never, user.id));
  const inputFingerprint = await fingerprint([
    `v${startedFromVersion}`,
    `style:${r360Style}`,
    ...eligible.map((s) => `${s.id}:${s.subject_participant}:${s.subject_participant_id ?? ""}:${s.updated_at ?? ""}`),
  ]);

  // Unchanged evidence: return what is stored rather than paying for the same answer.
  if (!payload?.force && evalScope === null && summaryRow && !summaryRow.is_stale && summaryRow.input_fingerprint === inputFingerprint && summaryRow.content) {
    return json(200, { state: "complete", cached: true, coverage: summaryRow.coverage, content: summaryRow.content });
  }

  // Atomic acquisition: a unique partial index allows one running job per scope,
  // so two concurrent builds cannot replace each other's observations.
  const staleCutoff = new Date(Date.now() - STALE_JOB_MS).toISOString();
  await admin.from("journey_jobs")
    .update({ status: "failed", error_message: "timed out", completed_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("status", "running").lt("updated_at", staleCutoff);
  // Returning to an earlier input (e.g. personalization off -> on -> off, or a
  // correction undone) must rebuild: the stored summary no longer matches, so
  // release the idempotency key held by the older completed job.
  if (evalScope === null) {
    const release = admin.from("journey_jobs").update({ input_fingerprint: null })
      .eq("user_id", user.id).eq("status", "complete").eq("input_fingerprint", inputFingerprint);
    await (relationshipId ? release.eq("relationship_id", relationshipId) : release.is("relationship_id", null));
  }

  const { data: job, error: jobError } = await admin.from("journey_jobs").insert({
    user_id: user.id,
    relationship_id: relationshipId,
    kind: relationshipId ? "relationship_synthesis" : "cross_relationship_synthesis",
    status: "running",
    started_from_version: startedFromVersion,
    // Test builds never hold the ordinary idempotency key and are tagged server-side.
    input_fingerprint: evalScope === null ? inputFingerprint : null,
    evaluation_run_id: evalScope,
    attempt_count: 1,
  }).select("id").single();
  if (jobError || !job) {
    const running = (jobs ?? []).find((j) => j.status === "running" && (j.relationship_id ?? null) === relationshipId);
    if (!running) console.error("r360 job insert failed", jobError?.code, jobError?.message);
    return json(200, { state: "updating", job_id: running?.id ?? null });
  }

  const failJob = async (message: string, status = 500) => {
    await admin.from("journey_jobs").update({ status: "failed", error_message: message.slice(0, 300), completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(status, { state: "failed", error: message });
  };

  // ---- Adapters: rebuild observations for every eligible source. -------------
  try {
    for (const source of eligible) {
      const table = SOURCE_TABLE[source.source_kind];
      if (!table) continue;
      const { data: report, error: reportError } = await admin.from(table)
        .select(table === "group_roasts" ? "id,user_id,status,created_at,selected_period" : "id,user_id,status,created_at,result_json")
        .eq("id", source.source_id).maybeSingle();
      if (reportError) return await failJob("Could not read the included conversations.");
      // Ownership re-checked at build time, not trusted from the link row.
      // deno-lint-ignore no-explicit-any
      const row = report as any;
      if (!row || row.user_id !== user.id || row.status !== "complete") continue;

      const analysedOn: string = String(row.created_at ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      const ctx = {
        subject: source.subject_participant,
        subjectId: source.subject_participant_id,
        label: `${SOURCE_LABEL[source.source_kind]} · analysed ${analysedOn}`,
        // Verified exchange period only. The analysis date is not an exchange date.
        observedStart: source.observed_period_start ? source.observed_period_start.slice(0, 10) : null,
        observedEnd: source.observed_period_end ? source.observed_period_end.slice(0, 10) : null,
      };

      let drafts: ObservationDraft[] = [];
      if (source.source_kind === "deep_read") drafts = adaptDeepRead(row.result_json, ctx);
      else if (source.source_kind === "quick_take") drafts = adaptQuickTake(row.result_json, ctx);
      else if (source.source_kind === "group_read") drafts = adaptGroupRead(row.result_json, ctx);
      else if (source.source_kind === "group_roast") drafts = adaptGroupRoast();

      if (source.source_kind === "quick_take") {
        const { data: thread, error: threadError } = await admin.from("interactive_threads")
          .select("id").eq("user_id", user.id).eq("decode_id", source.source_id).maybeSingle();
        if (threadError) return await failJob("Could not read the continued exchange.");
        if (thread) {
          const { data: events, error: eventsError } = await admin.from("interactive_events")
            .select("event_type,result_json,provenance,created_at,completed_at,status")
            .eq("user_id", user.id).eq("thread_id", thread.id).eq("status", "complete")
            .order("created_at", { ascending: true }).limit(20);
          if (eventsError) return await failJob("Could not read the continued exchange.");
          for (const event of events ?? []) drafts = drafts.concat(adaptInteractiveEvent(event, ctx));
        }
      }

      // Idempotent: this source's observations are replaced, never appended to.
      const { error: deleteError } = await admin.from("journey_observations").delete()
        .eq("user_id", user.id).eq("journey_source_id", source.id);
      if (deleteError) return await failJob("Could not refresh the stored observations.");
      if (drafts.length) {
        const { error: insertError } = await admin.from("journey_observations").insert(drafts.map((draft) => ({
          user_id: user.id,
          relationship_id: source.relationship_id,
          journey_source_id: source.id,
          ...draft,
        })));
        if (insertError) return await failJob("Could not store the observations.");
      }
    }
  } catch (_error) {
    return await failJob("Could not read the included conversations.");
  }

  let allObservations: ObservationRow[];
  try {
    allObservations = await loadObservations();
  } catch {
    return await failJob("Could not read the stored observations.");
  }
  let { kept: observations, omitted } = selectRepresentative(allObservations, MAX_OBSERVATIONS);

  if (observations.length === 0) {
    await admin.from("journey_jobs").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(200, { state: "no_evidence", message: "The included conversations did not produce anything we can stand behind." });
  }

  const sourceById = new Map(eligible.map((s) => [s.id, s]));
  const relOf = (observationId: string) => sourceById.get(observationId)?.relationship_id ?? "";

  // Reflections are the person's own account, carried with explicit provenance.
  const { data: reflectionRows } = await admin
    .from("journey_reflections")
    .select("id,relationship_id,recommendation_id,reflection_kind,response_text,outcome,self_reported_at")
    .eq("user_id", user.id).is("excluded_at", null)
    .order("self_reported_at", { ascending: false }).limit(10);
  const reflections = (reflectionRows ?? []).filter((r) => !relationshipId || r.relationship_id === relationshipId);

  const notesText = `<self_reported_notes>\n${JSON.stringify(reflections.map((r) => ({ id: r.id, kind: r.reflection_kind, outcome: r.outcome, text: r.response_text, self_reported_at: r.self_reported_at, about: r.recommendation_id })))}\n</self_reported_notes>`;
  // Upper-bound estimate uses the longest system text this request could carry.
  const sysApprox = relationship360System({ distinctSources: 99, confirmedRelationships: 99, datedObservations: 9999 }) + (r360Style ? `\n\n${r360Style}` : "") + " ".repeat(1200);
  // Compact, evidence-preserving context; reduce (and report) only if the
  // conservative upper-bound cost would exceed the per-call budget.
  let ctxBuilt = compactContext(observations, sourceById, relById);
  const estimate = () => maxCostUsd(MODEL, estimateInputTokens([{ content: sysApprox }, { content: `${ctxBuilt.text}\n${notesText}` }]), MAX_TOKENS) ?? Infinity;
  const budgetOmitted = { count: 0 };
  while (estimate() > CALL_BUDGET_USD && observations.length > 12) {
    const next = selectRepresentative(allObservations, Math.floor(observations.length * 0.8));
    budgetOmitted.count += observations.length - next.kept.length;
    observations = next.kept; omitted = next.omitted;
    ctxBuilt = compactContext(observations, sourceById, relById);
  }
  const estimatedMaxUsd = estimate();
  if (estimatedMaxUsd > CALL_BUDGET_USD) return await failJob(`This synthesis would need up to $${estimatedMaxUsd.toFixed(3)} per call, above the limit.`, 429);
  const distinctSources = new Set(observations.map((o) => o.journey_source_id)).size;
  const confirmedRelationshipIds = new Set(
    observations.map((o) => relOf(o.journey_source_id)).filter((id) => relById.get(id)?.is_confirmed),
  );
  const distinctRelationships = new Set(observations.map((o) => relOf(o.journey_source_id))).size;
  const datedObservations = observations.filter((o) => o.observed_period_start).length;

  /**
   * Then / Now. Computed here, deterministically, never by the model.
   * It exists only when dated evidence from genuinely different, non-overlapping
   * periods and DIFFERENT sources supports a comparison. More evidence later is
   * not the same as changed behaviour, so the result says what it is: two
   * periods described side by side, with no improvement claimed.
   */
  const buildComparison = () => {
    const dated = observations
      .filter((o) => o.observed_period_start)
      .map((o) => ({ ...o, start: o.observed_period_start!.slice(0, 10), end: (o.observed_period_end ?? o.observed_period_start!).slice(0, 10) }))
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    if (dated.length < 2) return { available: false, reason: "not_enough_dated_evidence" as const };
    const days = [...new Set(dated.map((o) => o.start))];
    if (days.length < 2) return { available: false, reason: "single_period" as const };
    const cut = days[Math.floor(days.length / 2)];
    const then = dated.filter((o) => o.start < cut);
    const now = dated.filter((o) => o.start >= cut);
    if (then.length === 0 || now.length === 0) return { available: false, reason: "single_period" as const };
    const thenSources = new Set(then.map((o) => o.journey_source_id));
    const nowSources = new Set(now.map((o) => o.journey_source_id));
    // The same upload appearing on both sides is not two periods of evidence.
    const independent = [...nowSources].some((id) => !thenSources.has(id));
    if (!independent) return { available: false, reason: "same_conversation_only" as const };
    const thenEnd = then.reduce((max, o) => (o.end > max ? o.end : max), then[0].end);
    const nowStart = now.reduce((min, o) => (o.start < min ? o.start : min), now[0].start);
    if (thenEnd >= nowStart) return { available: false, reason: "overlapping_periods" as const };
    const side = (rows: typeof dated, sources: Set<string>) => ({
      start: rows.reduce((min, o) => (o.start < min ? o.start : min), rows[0].start),
      end: rows.reduce((max, o) => (o.end > max ? o.end : max), rows[0].end),
      observations: rows.length,
      sources: sources.size,
      about_you: rows.filter((o) => o.subject_kind === "user_behavior").length,
      about_them: rows.filter((o) => o.subject_kind === "other_behavior").length,
    });
    return {
      available: true as const,
      then: side(then, thenSources),
      now: side(now, nowSources),
      note: "Two periods described side by side from dated evidence. More evidence later is not proof anything changed.",
    };
  };
  const comparison = buildComparison();

  markStage("synthesis");
  const system = await systemFor("relationship360", relationship360System({ distinctSources, confirmedRelationships: confirmedRelationshipIds.size, datedObservations }), codeBaseline("relationship360")!);
  const systemText = system + (r360Style ? `\n\n${r360Style}` : "");

  // Loop A: private style signals (consented only) loaded above. Style, never evidence.
  const response = await callOpenRouter({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemText },
      {
        role: "user",
        content: `${ctxBuilt.text}\n${notesText}`,
      },
    ],
  }, aiKey, "https://betweenthelines.app", "BetweenTheLines Relationship360");

  if (!response.ok) return await failJob("The synthesis model did not respond.", 502);

  // deno-lint-ignore no-explicit-any
  const raw = (response.data as any)?.choices?.[0]?.message?.content ?? "";
  // deno-lint-ignore no-explicit-any
  let content: any;
  try {
    content = expandRefs(extractJsonObject(String(raw)).value, ctxBuilt.back);
  } catch {
    return await failJob("The synthesis output could not be read.", 502);
  }

  // ---- Strict validation ------------------------------------------------------
  // Every evidence id must be a real observation, and the SHAPE of the claim must
  // match what that evidence can carry: recurrence needs distinct sources, an
  // across-relationships claim needs distinct confirmed relationships, and a
  // change claim needs distinct verified dates.
  const byId = new Map(observations.map((o) => [o.id, o]));
  const keepRefs = (refs: unknown) => (Array.isArray(refs) ? refs.filter((r) => typeof r === "string" && byId.has(r)) : []) as string[];
  const distinctSourcesOf = (ids: string[]) => new Set(ids.map((id) => byId.get(id)!.journey_source_id)).size;
  const confirmedRelsOf = (ids: string[]) =>
    new Set(ids.map((id) => relOf(byId.get(id)!.journey_source_id)).filter((rel) => relById.get(rel)?.is_confirmed)).size;
  const distinctDatesOf = (ids: string[]) =>
    new Set(ids.map((id) => byId.get(id)!.observed_period_start).filter(Boolean)).size;

  // deno-lint-ignore no-explicit-any
  const patterns = (Array.isArray(content?.patterns) ? content.patterns : []).map((p: any, index: number) => {
    const evidence = keepRefs(p?.evidence);
    let question = ["noticing", "repeating", "changed", "across"].includes(p?.question) ? p.question : "noticing";
    let state = ["again", "different", "insufficient"].includes(p?.state) ? p.state : undefined;
    const sourcesBehind = distinctSourcesOf(evidence);
    // Downgrade rather than keep an unsupported shape.
    if (question === "repeating" && sourcesBehind < 2) { question = "noticing"; state = "insufficient"; }
    if (question === "across" && confirmedRelsOf(evidence) < 2) { question = "noticing"; state = "insufficient"; }
    if (question === "changed" && distinctDatesOf(evidence) < 2) { question = "noticing"; state = "insufficient"; }
    if (state === "again" && sourcesBehind < 2) state = "insufficient";
    return {
      id: String(p?.id ?? `p${index}`).slice(0, 60),
      question,
      title: String(p?.title ?? "").slice(0, 160),
      statement: String(p?.statement ?? "").slice(0, 1_200),
      whyItMatters: String(p?.whyItMatters ?? "").slice(0, 600) || undefined,
      state,
      confidence: sourcesBehind < 2 ? "low" : (["low", "medium", "high"].includes(p?.confidence) ? p.confidence : "low"),
      limitation: String(p?.limitation ?? "Based only on the conversations you included.").slice(0, 300),
      evidence,
      introspection: p?.introspection
        ? {
            openingQuestion: String(p.introspection.openingQuestion ?? "").slice(0, 400),
            // deno-lint-ignore no-explicit-any
            paths: (Array.isArray(p.introspection.paths) ? p.introspection.paths : []).slice(0, 2).map((path: any) => ({
              label: String(path?.label ?? "").slice(0, 120),
              questions: (Array.isArray(path?.questions) ? path.questions : []).slice(0, 2).map((q: unknown) => String(q).slice(0, 300)),
              evidenceRefs: keepRefs(path?.evidenceRefs),
            })).filter((path: { label: string; evidenceRefs: string[] }) => path.label && path.evidenceRefs.length > 0),
            closingQuestion: String(p.introspection.closingQuestion ?? "").slice(0, 400),
          }
        : undefined,
    };
  }).filter((p: { title: string; statement: string; evidence: string[] }) => p.title && p.statement && p.evidence.length > 0)
    .slice(0, 3);

  // deno-lint-ignore no-explicit-any
  const working = (Array.isArray(content?.working) ? content.working : []).map((w: any, index: number) => ({
    id: String(w?.id ?? `w${index}`).slice(0, 60),
    statement: String(w?.statement ?? "").slice(0, 600),
    evidence: keepRefs(w?.evidence),
  })).filter((w: { statement: string; evidence: string[] }) => w.statement && w.evidence.length > 0).slice(0, 3);

  // deno-lint-ignore no-explicit-any
  const recommendations = (Array.isArray(content?.recommendations) ? content.recommendations : []).map((r: any, index: number) => ({
    id: String(r?.id ?? `r${index}`).slice(0, 60),
    type: r?.type === "behavioral" ? "behavioral" : "communication",
    observation: String(r?.observation ?? "").slice(0, 600),
    action: String(r?.action ?? "").slice(0, 300),
    why: String(r?.why ?? "").slice(0, 600),
    evidence: keepRefs(r?.evidence),
  })).filter((r: { action: string; evidence: string[] }) => r.action && r.evidence.length > 0).slice(0, 3);

  const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);
  const narrativeWords = words(String(content?.narrative ?? ""));
  const validated = {
    headline: String(content?.headline ?? "What your included conversations show").slice(0, 200),
    // The overview is an overview: enforce the ceiling rather than trusting it.
    narrative: narrativeWords.length > 110 ? `${narrativeWords.slice(0, 110).join(" ")}…` : narrativeWords.join(" "),
    // deno-lint-ignore no-explicit-any
    takeaways: (Array.isArray(content?.takeaways) ? content.takeaways : []).slice(0, 3).map((t: any, index: number) => ({
      id: String(t?.id ?? patterns[index]?.id ?? `t${index}`).slice(0, 60),
      label: String(t?.label ?? "").slice(0, 160),
    })).filter((t: { label: string }) => t.label),
    patterns,
    working,
    recommendations,
  };

  const coverage = {
    sources: distinctSources,
    evaluation_scope: evalScope, // non-null only inside an explicit evaluation-scope test run
    input_source_ids: Array.from(new Set(observations.map((o) => o.journey_source_id))), // ids only, no content
    relationships: distinctRelationships,
    confirmed_relationships: confirmedRelationshipIds.size,
    observations: observations.length,
    omitted_observations: omitted,
    omitted_for_call_budget: budgetOmitted.count,
    context_version: R360_CONTEXT_VERSION,
    estimated_max_call_usd: Math.round(estimatedMaxUsd * 10000) / 10000,
    dated_observations: datedObservations,
    recent_window_observations: observations.filter((o) => String(o.observation_type).endsWith(".recent_window")).length,
    comparison,
    single_read: distinctSources === 1,
    self_reported_notes: reflections.length,
    generated_for: scope,
  };

  // Commit-time recheck: consent, opt-in and eligibility must still hold.
  const { data: commitProfile } = await admin
    .from("journey_profiles").select("opted_in_at,activation_consent_at,consent_version").eq("user_id", user.id).maybeSingle();
  if (!commitProfile?.opted_in_at || !commitProfile.activation_consent_at || (commitProfile.consent_version ?? 0) < CURRENT_CONSENT_VERSION) {
    await admin.from("journey_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(200, { state: "cancelled", message: "Your Relationship360 settings changed while this was building, so nothing was saved." });
  }
  // Personalization withdrawn/reset/deleted during the build: do not commit a
  // result shaped by signals the person no longer allows.
  const commitStyle = coachingPreferenceInstruction(await loadCoachingPreferences(admin as never, user.id));
  if (commitStyle !== r360Style) {
    await admin.from("journey_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(200, { state: "cancelled", message: "Your personalization settings changed while this was building, so nothing was saved. Build again." });
  }
  const { data: commitSources } = await admin
    .from("journey_sources").select("id").eq("user_id", user.id)
    .in("id", Array.from(new Set(observations.map((o) => o.journey_source_id))))
    .eq("identity_status", "confirmed").is("excluded_at", null).is("quarantined_at", null);
  if ((commitSources ?? []).length === 0) {
    await admin.from("journey_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(200, { state: "cancelled", message: "The conversations behind this changed while it was building, so nothing was saved." });
  }

  // Evaluation-scope builds are never saved as the account's Relationship360:
  // the result goes back to the metered test harness only, so test output can
  // never replace, feed the cache of, or be displayed as an ordinary summary.
  if (evalScope !== null) {
    await admin.from("journey_jobs").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(200, { state: "complete", job_id: job.id, persisted: false, evaluation_scope: evalScope, coverage, content: validated });
  }

  // The write is authorised as the person and refuses if anything they own
  // changed while this job ran (correction, exclusion or deletion).
  const { data: written, error: writeError } = await auth.rpc("journey_write_summary", {
    p_job_id: job.id,
    p_scope: scope,
    p_relationship_id: relationshipId,
    p_content: validated,
    p_evidence_source_ids: Array.from(new Set(observations.map((o) => o.journey_source_id))),
    p_coverage: coverage,
    p_model: MODEL,
    // deno-lint-ignore no-explicit-any
    p_usage: (response.data as any)?.usage ?? {},
  });
  if (writeError) return await failJob("Could not save the update.");
  if (written !== true) {
    await admin.from("journey_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", job.id);
    return json(200, { state: "cancelled", message: "Your Relationship360 changed while this was building, so nothing was saved. Build again." });
  }

  const fingerprintUpdate = admin.from("journey_summaries").update({ input_fingerprint: inputFingerprint })
    .eq("user_id", user.id).eq("scope", scope);
  await (relationshipId ? fingerprintUpdate.eq("relationship_id", relationshipId) : fingerprintUpdate.is("relationship_id", null));
  await admin.from("journey_jobs").update({ completed_at: new Date().toISOString() }).eq("id", job.id);

  return json(200, { state: "complete", job_id: job.id, coverage, content: validated });
}));
