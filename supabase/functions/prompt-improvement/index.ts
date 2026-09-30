// Persistent, operator-only prompt-improvement workflow (all analysis modes).
//
// Authority lives here and in the database, never in the browser:
//  - The operator is the authenticated caller with the admin role (has_role on
//    every request). There is no reviewer-name input. Synthetic test accounts
//    (@btln-test.dev) can only ever create records marked as test records.
//  - Versions, datasets, rubrics, reviews and notes are immutable rows; every
//    evaluation and decision is bound to one exact hash of all of them.
//  - Baselines are snapshots of the DEPLOYED instruction text (see modeEval.ts).
//    A database-backed baseline that no longer matches the active prompt row is
//    stale: evaluation, review and activation are refused.
//  - Only the SANDBOX runtime selection can change. Production is refused here
//    and by a database trigger. Active production prompts are never touched.
//  - Every model call goes through meteredCall: a conservative maximum cost is
//    reserved atomically before the call and reconciled after (unknown cost
//    keeps the full reservation). Limits live in the database, never in the body.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { extractJsonObject } from "../_shared/extractJson.ts";
import { dbBudget, meteredCall, MODEL_RATES, openRouterProvider, type BudgetDeps } from "../_shared/promptBudget.ts";
import {
  buildMessages, CASES, candidateSystem, codeBaseline, hardPass, judgeSystem, MODE_KEYS, MODE_RUBRIC_VERSION, modeRubric, MODES,
  modeVersionHash, promptConflicts, screen, sha256, unblind, validateJudge, type ModeCase, type ModeKey,
} from "../_shared/modeEval.ts";
import { EXPECTED_STAGES, FUNCTION_FOR, PIPELINE_CASES, PIPELINE_CODE_VERSIONS, PIPELINE_REVISION, pipelineRequest, RESULT_REF, withPayloadToken } from "../_shared/pipelineCases.ts";
import { payloadToken } from "../_shared/injectionDisclosure.ts";
import { ADVICE_SEMANTIC_VERSION, applySemanticVerdicts, SEMANTIC_MODEL, semanticRequest } from "../_shared/adviceRecipients.ts";
import { SEMANTIC_FIXTURES, SEMANTIC_FIXTURES_2, SEMANTIC_FIXTURES_3, SEMANTIC_FIXTURES_4, EXTERNAL_BENCHMARK_1 } from "../_shared/adviceSemanticFixtures.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SCOPE = "improvement";
const DATASET_REVISION = 2; // 2: grp-injection bait reclassified as invented_event_terms (mode-screen-4)
const JUDGE_MODEL = "openai/gpt-6-astra";
const JUDGE_MAX_TOKENS = 800;
const PROPOSAL_MAX_TOKENS = 700;
const CALL_TIMEOUT_MS = 150_000;
const ABANDON_MINUTES = 20;
const MAX_JOBS_PER_DAY = 30; // secondary guard; the dollar budget is authoritative
const MIN_COHORT = 5;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const TEST_EMAIL = /@btln-test\.dev$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Admin = any;

const audit = (admin: Admin, actor: string | null, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}) =>
  admin.from("prompt_audit_events").insert({ actor_id: actor, action, entity, entity_id: entityId, details });

const isMode = (m: unknown): m is ModeKey => typeof m === "string" && (MODE_KEYS as string[]).includes(m);

/** Resolves the deployed baseline text + model for a mode right now. */
const deployedBaseline = async (admin: Admin, key: ModeKey) => {
  const spec = MODES[key];
  if (spec.source.kind === "db") {
    const { data: row } = await admin.from("prompt_versions").select("id,prompt_text,model_string").eq("active", true).eq("kind", spec.source.pvKind).maybeSingle();
    if (!row) return null;
    const model = spec.source.modelFromRow ? String(row.model_string) : String(spec.codeModel);
    return { text: String(row.prompt_text), model, source: { kind: "prompt_versions", id: row.id, pv_kind: spec.source.pvKind, text_hash: await sha256(String(row.prompt_text)) } };
  }
  let model = spec.codeModel ?? "";
  if (key === "group_roast") {
    const { data: row } = await admin.from("prompt_versions").select("model_string").eq("active", true).eq("kind", "group").maybeSingle();
    model = String(row?.model_string ?? "");
  }
  const text = codeBaseline(key)!;
  return { text, model, source: { kind: "code", module: "_shared/modePrompts.ts", text_hash: await sha256(text) } };
};

/** Seeds (idempotently) the rubric, dataset and a baseline snapshot matching the deployed text. */
const ensureMode = async (admin: Admin, key: ModeKey) => {
  const rubric = modeRubric(key);
  const rHash = await sha256(rubric);
  const { data: r } = await admin.from("prompt_rubrics").select("id").eq("mode", key).eq("version", MODE_RUBRIC_VERSION).maybeSingle();
  if (!r) {
    const { error } = await admin.from("prompt_rubrics").insert({ mode: key, version: MODE_RUBRIC_VERSION, criteria: rubric, content_hash: rHash });
    if (error && error.code !== "23505") throw new Error(`seed rubric ${key}: ${error.message}`);
  }
  const name = `${key}-synthetic`;
  const cases = CASES[key];
  const { data: d } = await admin.from("prompt_datasets").select("id").eq("mode", key).eq("name", name).eq("revision", DATASET_REVISION).maybeSingle();
  if (!d) {
    const { error } = await admin.from("prompt_datasets").insert({ mode: key, name, revision: DATASET_REVISION, origin: "synthetic", cases, content_hash: await sha256({ mode: key, name, revision: DATASET_REVISION, cases }) });
    if (error && error.code !== "23505") throw new Error(`seed dataset ${key}: ${error.message}`);
  }
  const dep = await deployedBaseline(admin, key);
  if (!dep) return;
  if (!MODEL_RATES[dep.model]) return; // unknown pricing: never seed a runnable baseline
  const spec = MODES[key];
  const config = { temperature: spec.temperature, max_tokens: spec.max_tokens, parity: spec.parity, parity_note: spec.parityNote, source: dep.source };
  const row = { mode: key, kind: "baseline", prompt_text: dep.text, model: dep.model, config };
  const hash = await modeVersionHash(row);
  const { data: existing } = await admin.from("prompt_versions_eval").select("id").eq("mode", key).eq("kind", "baseline").eq("content_hash", hash).limit(1);
  if (!existing?.length) {
    await admin.from("prompt_versions_eval").insert({ ...row, label: `${spec.label} deployed baseline`, content_hash: hash, rationale: "Snapshot of the deployed instruction text (see config.source)." });
  }
};

const verifyVersion = async (v: Admin) => v && (await modeVersionHash(v)) === v.content_hash;

/** Loads and re-verifies everything an evaluation/decision binds to. */
const loadBinding = async (admin: Admin, candidateId: string) => {
  const { data: candidate } = await admin.from("prompt_versions_eval").select("*").eq("id", candidateId).maybeSingle();
  if (!candidate || candidate.kind !== "candidate") return { error: "Candidate not found." };
  if (!isMode(candidate.mode)) return { error: "Legacy simplified-baseline candidate: not production parity, so it cannot be evaluated, approved or activated." };
  const key = candidate.mode as ModeKey;
  const { data: baseline } = await admin.from("prompt_versions_eval").select("*").eq("id", candidate.parent_id).maybeSingle();
  const { data: dataset } = await admin.from("prompt_datasets").select("*").eq("mode", key).eq("name", `${key}-synthetic`).eq("revision", DATASET_REVISION).maybeSingle();
  const { data: rubric } = await admin.from("prompt_rubrics").select("*").eq("mode", key).eq("version", MODE_RUBRIC_VERSION).maybeSingle();
  if (!baseline || baseline.mode !== key || !dataset || !rubric) return { error: "Baseline, dataset or rubric missing or from another mode." };
  const ok = (await verifyVersion(candidate)) && (await verifyVersion(baseline)) &&
    (await sha256({ mode: dataset.mode, name: dataset.name, revision: dataset.revision, cases: dataset.cases })) === dataset.content_hash &&
    (await sha256(rubric.criteria)) === rubric.content_hash && candidate.config?.baseline_hash === baseline.content_hash;
  if (!ok) return { error: "A stored hash does not match its content. Refused." };
  const dep = await deployedBaseline(admin, key);
  const stale = !dep || dep.text !== baseline.prompt_text || dep.model !== baseline.model;
  const binding = await sha256({ mode: key, candidate: candidate.content_hash, baseline: baseline.content_hash, dataset: dataset.content_hash, rubric: rubric.content_hash });
  return { key, candidate, baseline, dataset, rubric, binding, stale };
};

const parseJson = (raw: string) => { try { return extractJsonObject(raw).value; } catch { return null; } };

type Deps = BudgetDeps;
const makeDeps = (admin: Admin, aiKey: string): Deps => ({ ...dbBudget(admin), provider: openRouterProvider(aiKey, "BetweenTheLines prompt evaluation") });

const generate = async (deps: Deps, jobId: string | null, kind: "generation" | "retry" | "sandbox", key: ModeKey, system: string, model: string, c: ModeCase) => {
  const spec = MODES[key];
  const body = { model, max_tokens: spec.max_tokens, temperature: spec.temperature, response_format: { type: "json_object" }, messages: buildMessages(key, system, c) };
  const r = await meteredCall(deps, { scope: SCOPE, jobId, kind, body, timeoutMs: CALL_TIMEOUT_MS });
  if (!r.ok) return r;
  const raw = String(r.data?.choices?.[0]?.message?.content ?? "");
  return { ...r, output: parseJson(raw), raw: raw.slice(0, 600) };
};

const systemOf = (v: Admin, baseline: Admin) => v.kind === "baseline" ? v.prompt_text : candidateSystem(baseline.prompt_text, v.prompt_text);

const runEvaluation = async (admin: Admin, deps: Deps, jobId: string, b: Admin) => {
  const key: ModeKey = b.key;
  const cases = b.dataset.cases as ModeCase[];
  let calls = 0, failed = 0, pt = 0, ct = 0, cost = 0, unknownCost = 0;
  let stop: string | null = null;
  const track = (r: Admin) => {
    if (r.stage === "budget") return;
    calls += 1;
    if (r.ok && r.usage.cost !== null) cost += r.usage.cost; else unknownCost += r.reserved ?? 0;
    if (r.ok) { pt += r.usage.prompt_tokens ?? 0; ct += r.usage.completion_tokens ?? 0; }
  };
  const perCase: Record<string, Admin> = {};
  const runCase = async (c: ModeCase) => {
    const outs: Record<string, Admin> = {};
    await Promise.all((["baseline", "candidate"] as const).map(async (variant) => {
      const v = variant === "baseline" ? b.baseline : b.candidate;
      let attempts = 0;
      let r: Admin = null;
      for (const kind of ["generation", "retry"] as const) {
        if (stop) break;
        attempts += 1;
        r = await generate(deps, jobId, kind, key, systemOf(v, b.baseline), b.baseline.model, c);
        track(r);
        if (!r.ok && r.stage === "budget") { stop = stop ?? `budget:${r.reason}`; break; }
        if (r.ok && r.output) break;
      }
      const output = r?.ok ? r.output : null;
      const checks = screen(key, c, output, variant === "candidate" ? b.candidate.prompt_text : undefined);
      outs[variant] = { output, checks, pass: Boolean(output) && hardPass(checks), attempts,
        error: !r ? "not run" : !r.ok ? `${r.stage}:${r.reason}` : !output ? `unparseable: ${r.raw}` : null, usage: r?.ok ? r.usage : null };
      if (!output) failed += 1;
    }));
    let judge: Admin = { status: "not_run" };
    const order: "baseline_first" | "candidate_first" = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "baseline_first" : "candidate_first";
    if (outs.baseline.output && outs.candidate.output && !stop) {
      const [x, y] = order === "baseline_first" ? [outs.baseline.output, outs.candidate.output] : [outs.candidate.output, outs.baseline.output];
      const clip = (v: unknown) => JSON.stringify(v).slice(0, 7000);
      const caseText = buildMessages(key, "", c)[1].content.slice(0, 5000);
      const body = { model: JUDGE_MODEL, max_tokens: JUDGE_MAX_TOKENS, response_format: { type: "json_object" }, messages: [
        { role: "system", content: judgeSystem(key) },
        { role: "user", content: `<case>${caseText}${c.user_note ? `\n<person_note>${c.user_note}</person_note>` : ""}</case>\n<output_x>${clip(x)}</output_x>\n<output_y>${clip(y)}</output_y>` },
      ] };
      const jr = await meteredCall(deps, { scope: SCOPE, jobId, kind: "judge", body, timeoutMs: CALL_TIMEOUT_MS });
      track(jr);
      if (!jr.ok && jr.stage === "budget") { stop = stop ?? `budget:${jr.reason}`; judge = { status: "budget_stopped" }; }
      else if (!jr.ok) { judge = { status: "failed", why: jr.reason }; failed += 1; }
      else {
        const v = validateJudge(key, parseJson(String(jr.data?.choices?.[0]?.message?.content ?? "")));
        if (!v.ok) { judge = { status: "incomplete", why: v.why }; failed += 1; }
        else {
          const base = order === "baseline_first" ? v.x : v.y;
          const cand = order === "baseline_first" ? v.y : v.x;
          judge = { status: "complete", order, preferred_blind: v.preferred, preferred: unblind(order, v.preferred), scores: { baseline: base, candidate: cand }, reason: v.reason };
        }
      }
    }
    // Disagreement: the judge prefers the side that failed a hard screen while the other passed,
    // or its grounding score contradicts the deterministic screen.
    const pref = judge.preferred;
    const favoredFailing = judge.status === "complete" && pref !== "tie" && !outs[pref].pass && outs[pref === "baseline" ? "candidate" : "baseline"].pass;
    for (const variant of ["baseline", "candidate"] as const) {
      const o = outs[variant];
      const g = judge.status === "complete" ? Number(judge.scores[variant].grounding) : null;
      const disagreement = favoredFailing || (g !== null && ((o.pass && g <= 2) || (!o.pass && g >= 4)));
      const { error } = await admin.from("prompt_eval_results").upsert({
        job_id: jobId, case_id: c.id, variant, status: o.output ? "ok" : "failed", output: o.output, checks: o.checks,
        judge: { ...judge, favored_failing: favoredFailing, needs_human: true }, judge_order: judge.status === "complete" ? order : null,
        screen_passed: o.pass, disagreement, attempts: o.attempts, input_case: c,
        prompt_tokens: Number(o.usage?.prompt_tokens ?? 0), completion_tokens: Number(o.usage?.completion_tokens ?? 0), error_message: o.error,
      }, { onConflict: "job_id,case_id,variant" });
      if (error) failed += 1;
    }
    perCase[c.id] = { kind: c.kind, baseline: outs.baseline.pass, candidate: outs.candidate.pass, judge: judge.status, preferred: judge.preferred ?? null, favored_failing: favoredFailing };
    await admin.from("prompt_eval_jobs").update({ calls_made: calls, calls_failed: failed, prompt_tokens: pt, completion_tokens: ct, cost_usd: cost, heartbeat_at: new Date().toISOString() }).eq("id", jobId);
  };
  try {
    await Promise.all(cases.map(runCase));
    const ids = Object.keys(perCase);
    const { data: ledger } = await admin.from("prompt_spend_ledger").select("reserved_usd,actual_usd,status").eq("job_id", jobId);
    const spend = {
      reconciled_usd: (ledger ?? []).filter((l: Admin) => l.status === "reconciled").reduce((n: number, l: Admin) => n + Number(l.actual_usd), 0),
      unknown_usd_counted: (ledger ?? []).filter((l: Admin) => l.status !== "reconciled").reduce((n: number, l: Admin) => n + Number(l.reserved_usd), 0),
      calls: (ledger ?? []).length,
    };
    const summary = {
      mode: key, cases: ids.length,
      baseline_screen_passes: ids.filter((k) => perCase[k].baseline).length,
      candidate_screen_passes: ids.filter((k) => perCase[k].candidate).length,
      wins: ids.filter((k) => perCase[k].candidate && !perCase[k].baseline),
      regressions: ids.filter((k) => !perCase[k].candidate && perCase[k].baseline),
      judge_complete: ids.filter((k) => perCase[k].judge === "complete").length,
      judge_preferred_candidate: ids.filter((k) => perCase[k].preferred === "candidate").length,
      judge_favored_failing: ids.filter((k) => perCase[k].favored_failing),
      incomplete: Boolean(stop) || failed > 0 || ids.length !== cases.length || ids.some((k) => perCase[k].judge !== "complete"),
      stop_reason: stop, spend, parity: b.baseline.config?.parity, per_case: perCase,
      limitations: "Deterministic screens and model judging are aids, not proof of quality. Humor is advisory. Human review required.",
    };
    await admin.from("prompt_eval_jobs").update({
      status: stop ? "budget_stopped" : "complete", stop_reason: stop, summary, calls_made: calls, calls_failed: failed, prompt_tokens: pt, completion_tokens: ct, cost_usd: cost,
      completed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(),
    }).eq("id", jobId);
    await audit(admin, b.startedBy, stop ? "evaluation_budget_stopped" : "evaluation_completed", "prompt_eval_jobs", jobId, { calls, failed, incomplete: summary.incomplete, stop_reason: stop });
  } catch (e) {
    await admin.from("prompt_eval_jobs").update({ status: "failed", error_message: e instanceof Error ? e.message.slice(0, 300) : "failed", completed_at: new Date().toISOString() }).eq("id", jobId);
  }
};

/** Server-computed review state. Screens passing is never approval. */
const reviewState = (job: Admin, reviews: Admin[], notes: Admin[]) => {
  const human = reviews.filter((r) => r.job_id === job.id && !r.is_test_record);
  const test = reviews.filter((r) => r.job_id === job.id && r.is_test_record);
  const last = human[0];
  if (last) return { state: last.decision, by_test_account: false };
  if (job.status === "running") return { state: "running" };
  if (job.status !== "complete") return { state: "incomplete", reason: job.stop_reason ?? job.status };
  const s = job.summary ?? {};
  if (s.incomplete !== false) return { state: "incomplete", reason: "missing outputs or judge results" };
  if (s.candidate_screen_passes !== s.cases) return { state: "needs_review", reason: "candidate fails at least one required check; approval blocked", test_decisions: test.length };
  const needNotes = (s.judge_favored_failing ?? []).filter((cid: string) => !notes.some((n) => n.job_id === job.id && n.case_id === cid));
  if (needNotes.length) return { state: "needs_review", reason: `judge disagreement on ${needNotes.join(", ")}: add a case note before approving`, test_decisions: test.length };
  return { state: "eligible_for_review", test_decisions: test.length };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json(401, { error: "Sign in required." });
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleErr) return json(500, { error: "Role check failed." });
  if (isAdmin !== true) return json(403, { error: "Operator access only." });
  const testAccount = TEST_EMAIL.test(user.email ?? "");

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON." }); }
  const action = String(body?.action ?? "");
  const aiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const deps = makeDeps(admin, aiKey);

  try { for (const k of MODE_KEYS) await ensureMode(admin, k); }
  catch (e) { return json(500, { error: e instanceof Error ? e.message : "seed failed" }); }

  if (action === "dashboard") {
    // Abandoned jobs and stale reservations: counted as unknown spend, never released.
    const cutoff = new Date(Date.now() - ABANDON_MINUTES * 60_000).toISOString();
    await admin.from("prompt_eval_jobs").update({ status: "abandoned", stop_reason: "no heartbeat", completed_at: new Date().toISOString() }).eq("status", "running").lt("heartbeat_at", cutoff);
    await admin.rpc("expire_prompt_reservations", { p_minutes: ABANDON_MINUTES });
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: fb, error: fbErr } = await admin.from("ai_feedback").select("source_kind,source_id,user_id,target_kind,rating,reason_codes,prompt_version").gte("updated_at", since).eq("product_improvement_consent", true).limit(5000);
    if (fbErr) return json(500, { error: "Could not read feedback aggregate." });
    // Evaluation isolation: drop feedback on test-run artifacts and from registered test accounts.
    const [{ data: evArts }, { data: evAccts }] = await Promise.all([
      admin.from("evaluation_artifacts").select("source_id").limit(5000),
      admin.from("evaluation_accounts").select("user_id"),
    ]);
    const evSrc = new Set((evArts ?? []).map((a: { source_id: string }) => String(a.source_id)));
    const evUsr = new Set((evAccts ?? []).map((a: { user_id: string }) => String(a.user_id)));
    const buckets = new Map<string, Admin>();
    for (const r of (fb ?? []).filter((x: any) => !evSrc.has(String(x.source_id)) && !evUsr.has(String(x.user_id)))) {
      const tk = String(r.target_kind).split(":")[0];
      const k = `${r.source_kind}|${tk}|${r.prompt_version ?? ""}`;
      const b = buckets.get(k) ?? { source_kind: r.source_kind, target_kind: tk, prompt_version: r.prompt_version, up: 0, down: 0, reasons: {} };
      if (r.rating === "up") b.up += 1; else b.down += 1;
      for (const code of r.reason_codes ?? []) b.reasons[code] = (b.reasons[code] ?? 0) + 1;
      buckets.set(k, b);
    }
    const aggregates = [...buckets.values()].map((b) => {
      const n = b.up + b.down;
      return n < MIN_COHORT ? { ...b, up: null, down: null, reasons: {}, sample_size: `<${MIN_COHORT}`, suppressed: true } : { ...b, sample_size: n, suppressed: false };
    });
    const [versions, jobs, reviews, selection, auditRows, notes, packets, budget, ledger] = await Promise.all([
      admin.from("prompt_versions_eval").select("id,mode,kind,parent_id,label,prompt_text,model,config,content_hash,rationale,is_test_record,created_by,created_at").order("created_at", { ascending: false }).limit(80),
      admin.from("prompt_eval_jobs").select("*").order("created_at", { ascending: false }).limit(40),
      admin.from("prompt_reviews").select("*").order("created_at", { ascending: false }).limit(80),
      admin.from("prompt_runtime_selection").select("*"),
      admin.from("prompt_audit_events").select("id,actor_id,action,entity,entity_id,details,created_at").order("created_at", { ascending: false }).limit(40),
      admin.from("prompt_review_notes").select("*").order("created_at", { ascending: false }).limit(200),
      admin.from("prompt_review_packets").select("*").order("created_at", { ascending: false }).limit(5),
      admin.rpc("prompt_budget_status", { p_scope: SCOPE }),
      admin.from("prompt_spend_ledger").select("id,job_id,kind,model,reserved_usd,actual_usd,status,outcome,created_at").eq("scope", SCOPE).order("created_at", { ascending: false }).limit(25),
    ]);
    const stale: Record<string, boolean> = {};
    for (const k of MODE_KEYS) {
      const dep = await deployedBaseline(admin, k);
      stale[k] = !(versions.data ?? []).some((v: Admin) => v.mode === k && v.kind === "baseline" && dep && v.prompt_text === dep.text && v.model === dep.model);
    }
    const jobsOut = (jobs.data ?? []).map((j: Admin) => ({ ...j, review_state: isMode(j.mode) ? reviewState(j, reviews.data ?? [], notes.data ?? []) : { state: "legacy", reason: "simplified baseline, not production parity" } }));
    return json(200, {
      operator: user.id, operator_is_test_account: testAccount, min_cohort: MIN_COHORT, aggregates,
      versions: versions.data ?? [], jobs: jobsOut, reviews: reviews.data ?? [], selection: selection.data ?? [], audit: auditRows.data ?? [],
      notes: notes.data ?? [], packets: packets.data ?? [], budget: budget.data, ledger: ledger.data ?? [], rates: MODEL_RATES,
      production_promotion: "disabled", baseline_stale: stale,
      modes: MODE_KEYS.map((k) => ({ key: k, label: MODES[k].label, parity: MODES[k].parity, parity_note: MODES[k].parityNote, cases: CASES[k] })),
    });
  }

  if (action === "results") {
    if (!UUID_RE.test(String(body.job_id ?? ""))) return json(400, { error: "job_id required" });
    const { data, error } = await admin.from("prompt_eval_results").select("*").eq("job_id", body.job_id).order("case_id");
    if (error) return json(500, { error: "Could not read results." });
    const { data: ledger } = await admin.from("prompt_spend_ledger").select("kind,model,reserved_usd,actual_usd,status,outcome").eq("job_id", body.job_id);
    return json(200, { results: data ?? [], ledger: ledger ?? [] });
  }

  if (action === "suggest_candidate") {
    if (!isMode(body.mode)) return json(400, { error: "mode required" });
    if (!aiKey) return json(503, { error: "Model key unavailable." });
    const issue = { target: String(body.target ?? "").slice(0, 80), reasons: (Array.isArray(body.reasons) ? body.reasons : []).map(String).slice(0, 6), sample_size: Number(body.sample_size ?? 0) };
    const r = await meteredCall(deps, { scope: SCOPE, jobId: null, kind: "proposal", timeoutMs: 60_000, body: {
      model: JUDGE_MODEL, max_tokens: PROPOSAL_MAX_TOKENS, messages: [
        { role: "system", content: "You propose a short ADDENDUM (under 800 characters) to append to a production coaching prompt. It cannot remove anything and a frozen guard is always appended after it. Never propose agreeing with users, removing uncertainty, flattering, inventing details or changing the output format. Return only the addendum text." },
        { role: "user", content: `Mode: ${MODES[body.mode as ModeKey].label}\nAggregate feedback signal (counts only, subjective, not ground truth): ${JSON.stringify(issue)}` },
      ] } });
    if (!r.ok) return json(r.stage === "budget" ? 429 : 502, { error: r.stage === "budget" ? `Budget stop: ${r.reason}` : "Suggestion model did not respond." });
    await audit(admin, user.id, "suggestion_drafted", "prompt_versions_eval", null, { mode: body.mode, issue, cost_usd: r.usage.cost });
    return json(200, { suggestion: String(r.data?.choices?.[0]?.message?.content ?? "").slice(0, 1500), note: "Draft only. Save it as a candidate to evaluate it." });
  }

  if (action === "create_candidate") {
    if (!isMode(body.mode)) return json(400, { error: "mode required" });
    const key = body.mode as ModeKey;
    const text = String(body.prompt_text ?? "").trim();
    const label = String(body.label ?? "").trim().slice(0, 120);
    if (text.length < 20 || text.length > 1500 || !label) return json(400, { error: "Label and an addendum of 20-1500 characters are required." });
    const dep = await deployedBaseline(admin, key);
    const { data: parents } = await admin.from("prompt_versions_eval").select("*").eq("mode", key).eq("kind", "baseline").order("created_at", { ascending: false });
    const parent = (parents ?? []).find((p: Admin) => dep && p.prompt_text === dep.text && p.model === dep.model);
    if (!parent) return json(409, { error: "No baseline matches the deployed text for this mode." });
    const row = { mode: key, kind: "candidate", prompt_text: text, model: parent.model, config: { assembly: "baseline + addendum + frozen guard", baseline_hash: parent.content_hash, temperature: MODES[key].temperature, max_tokens: MODES[key].max_tokens } };
    const hash = await modeVersionHash(row);
    const { data, error } = await admin.from("prompt_versions_eval").insert({
      ...row, parent_id: parent.id, label, content_hash: hash, rationale: String(body.rationale ?? "").slice(0, 1000) || null,
      issue_ref: typeof body.issue_ref === "object" && body.issue_ref ? body.issue_ref : {}, is_test_record: testAccount || body.is_test_record === true, created_by: user.id,
    }).select("id,content_hash").single();
    if (error) return json(500, { error: "Could not save candidate." });
    const conflicts = promptConflicts(text);
    await audit(admin, user.id, "candidate_created", "prompt_versions_eval", data.id, { mode: key, content_hash: data.content_hash, frozen_conflicts: conflicts });
    return json(200, { candidate: data, frozen_conflicts: conflicts });
  }

  if (action === "evaluate") {
    if (!UUID_RE.test(String(body.candidate_id ?? ""))) return json(400, { error: "candidate_id required" });
    if (!aiKey) return json(503, { error: "Model key unavailable." });
    const b = await loadBinding(admin, body.candidate_id);
    if ("error" in b) return json(409, { error: b.error });
    if (b.stale) return json(409, { error: "The deployed instruction text changed since this baseline was captured. Create a new candidate against the current baseline." });
    const { data: done } = await admin.from("prompt_eval_jobs").select("id,status").eq("binding_hash", b.binding).in("status", ["complete", "running"]).order("created_at", { ascending: false }).limit(1);
    if (done?.length) return json(200, { job_id: done[0].id, status: done[0].status, reused: true });
    const { count } = await admin.from("prompt_eval_jobs").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400_000).toISOString());
    if ((count ?? 0) >= MAX_JOBS_PER_DAY) return json(429, { error: `Daily evaluation limit (${MAX_JOBS_PER_DAY}) reached.` });
    const { data: status } = await admin.rpc("prompt_budget_status", { p_scope: SCOPE });
    if (!status || Number(status.remaining_usd) < Number(status.per_call_cap_usd)) return json(429, { error: "Budget stop: not enough remaining in the improvement budget.", budget: status });
    const cases = b.dataset.cases as ModeCase[];
    const { data: job, error } = await admin.from("prompt_eval_jobs").insert({
      mode: b.key, candidate_id: b.candidate.id, baseline_id: b.baseline.id, dataset_id: b.dataset.id, rubric_id: b.rubric.id,
      binding_hash: b.binding, cases_total: cases.length, started_by: user.id, parity: { parity: b.baseline.config?.parity, note: b.baseline.config?.parity_note, source: b.baseline.config?.source },
    }).select("id").single();
    if (error) return json(error.code === "23505" ? 409 : 500, { error: error.code === "23505" ? "An evaluation for this exact version is already running." : "Could not start evaluation." });
    await audit(admin, user.id, "evaluation_started", "prompt_eval_jobs", job.id, { mode: b.key, binding_hash: b.binding });
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil(runEvaluation(admin, deps, job.id, { ...b, startedBy: user.id }));
    return json(202, { job_id: job.id, status: "running", binding_hash: b.binding });
  }

  if (action === "add_note") {
    const note = String(body.note ?? "").trim();
    if (!UUID_RE.test(String(body.job_id ?? "")) || !note || note.length > 2000 || typeof body.case_id !== "string") return json(400, { error: "job_id, case_id and a note are required." });
    const { data: job } = await admin.from("prompt_eval_jobs").select("id,binding_hash,dataset_id").eq("id", body.job_id).maybeSingle();
    if (!job) return json(404, { error: "Evaluation not found." });
    if (body.expected_binding_hash !== job.binding_hash) return json(409, { error: "The evaluated version does not match what you reviewed." });
    const { data: ds } = await admin.from("prompt_datasets").select("cases").eq("id", job.dataset_id).maybeSingle();
    if (!(ds?.cases ?? []).some((c: Admin) => c.id === body.case_id)) return json(400, { error: "Unknown case for this evaluation." });
    const { data, error } = await admin.from("prompt_review_notes").insert({ job_id: job.id, case_id: body.case_id, binding_hash: job.binding_hash, note, author_id: user.id, is_test_record: testAccount }).select("id").single();
    if (error) return json(500, { error: "Could not save note." });
    await audit(admin, user.id, "case_note_added", "prompt_review_notes", data.id, { job_id: job.id, case_id: body.case_id, is_test_record: testAccount });
    return json(200, { note_id: data.id });
  }

  if (action === "review") {
    const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : null;
    const rationale = String(body.rationale ?? "").trim();
    if (!decision || rationale.length < 10 || !UUID_RE.test(String(body.job_id ?? "")) || typeof body.expected_binding_hash !== "string") return json(400, { error: "job_id, expected_binding_hash, decision and a rationale (10+ characters) are required." });
    const { data: job } = await admin.from("prompt_eval_jobs").select("*").eq("id", body.job_id).maybeSingle();
    if (!job) return json(404, { error: "Evaluation not found." });
    if (body.expected_binding_hash !== job.binding_hash) return json(409, { error: "The evaluated version does not match what you reviewed." });
    if (body.mode !== undefined && body.mode !== job.mode) return json(409, { error: "Mode mismatch." });
    if (job.status !== "complete") return json(409, { error: "Only a completed evaluation can be reviewed." });
    const b = await loadBinding(admin, job.candidate_id);
    if ("error" in b) return json(409, { error: b.error });
    if (b.binding !== job.binding_hash || b.key !== job.mode) return json(409, { error: "Versions changed since this evaluation. Re-evaluate." });
    if (b.stale && decision === "approved") return json(409, { error: "The deployed baseline changed since this evaluation; approval refused." });
    if (decision === "approved") {
      const [{ data: reviews }, { data: notes }] = await Promise.all([
        admin.from("prompt_reviews").select("*").eq("job_id", job.id).order("created_at", { ascending: false }),
        admin.from("prompt_review_notes").select("job_id,case_id").eq("job_id", job.id),
      ]);
      const st = reviewState(job, (reviews ?? []).filter((r: Admin) => r.is_test_record), notes ?? []);
      if (st.state !== "eligible_for_review") return json(409, { error: `Approval refused: ${st.reason ?? st.state}.` });
      const { data: rows } = await admin.from("prompt_eval_results").select("screen_passed,status").eq("job_id", job.id).eq("variant", "candidate");
      if ((rows ?? []).length !== job.cases_total || (rows ?? []).some((r: Admin) => r.status !== "ok" || r.screen_passed !== true)) return json(409, { error: "The candidate failed at least one required check. It cannot be approved." });
    }
    const { data: review, error } = await admin.from("prompt_reviews").insert({
      candidate_id: job.candidate_id, job_id: job.id, binding_hash: job.binding_hash, decision, rationale: rationale.slice(0, 2000),
      reviewer_id: user.id, is_test_record: testAccount || body.is_test_record === true,
    }).select("id,is_test_record").single();
    if (error) return json(500, { error: "Could not save review." });
    await audit(admin, user.id, `review_${decision}`, "prompt_reviews", review.id, { mode: job.mode, binding_hash: job.binding_hash, is_test_record: review.is_test_record });
    return json(200, { review_id: review.id, decision, is_test_record: review.is_test_record });
  }

  if (action === "activate") {
    if (body.environment !== "sandbox") {
      await audit(admin, user.id, "activation_refused", "prompt_runtime_selection", null, { environment: String(body.environment ?? "") });
      return json(403, { error: "Production promotion is disabled pending explicit owner approval." });
    }
    if (!UUID_RE.test(String(body.review_id ?? "")) || !isMode(body.mode)) return json(400, { error: "review_id and mode required" });
    const { data: review } = await admin.from("prompt_reviews").select("*").eq("id", body.review_id).maybeSingle();
    if (!review || review.decision !== "approved") return json(409, { error: "Only an approved review can be activated." });
    if (body.version_id && body.version_id !== review.candidate_id) return json(409, { error: "This approval belongs to a different version." });
    const b = await loadBinding(admin, review.candidate_id);
    if ("error" in b) return json(409, { error: b.error });
    if (b.key !== body.mode) return json(409, { error: "Mode mismatch: this approval belongs to another mode." });
    if (b.binding !== review.binding_hash) return json(409, { error: "Versions changed since approval. Re-evaluate and re-review." });
    if (b.stale) return json(409, { error: "The deployed baseline changed since approval." });
    const { data: current } = await admin.from("prompt_runtime_selection").select("version_id").eq("environment", "sandbox").eq("mode", b.key).maybeSingle();
    const { error } = await admin.from("prompt_runtime_selection").upsert({
      environment: "sandbox", mode: b.key, version_id: review.candidate_id, review_id: review.id, binding_hash: review.binding_hash,
      previous_version_id: current?.version_id ?? b.baseline.id, selected_by: user.id, selected_at: new Date().toISOString(),
    }, { onConflict: "environment,mode" });
    if (error) return json(500, { error: "Could not activate in sandbox." });
    await audit(admin, user.id, "sandbox_activated", "prompt_runtime_selection", review.candidate_id, { mode: b.key, review_id: review.id, is_test_record: review.is_test_record });
    return json(200, { environment: "sandbox", mode: b.key, version_id: review.candidate_id, is_test_record: review.is_test_record });
  }

  if (action === "rollback") {
    if (body.environment !== "sandbox") return json(403, { error: "Only the sandbox can be rolled back here." });
    if (!isMode(body.mode)) return json(400, { error: "mode required" });
    const { data: current } = await admin.from("prompt_runtime_selection").select("*").eq("environment", "sandbox").eq("mode", body.mode).maybeSingle();
    if (!current) return json(200, { environment: "sandbox", mode: body.mode, version_id: null, note: "Already on the deployed baseline." });
    const { data: prev } = await admin.from("prompt_versions_eval").select("id,kind").eq("id", current.previous_version_id).maybeSingle();
    const { data: prevReview } = prev && prev.kind === "candidate"
      ? await admin.from("prompt_reviews").select("id,binding_hash").eq("candidate_id", prev.id).eq("decision", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    const { error } = prevReview
      ? await admin.from("prompt_runtime_selection").upsert({ environment: "sandbox", mode: body.mode, version_id: prev.id, review_id: prevReview.id, binding_hash: prevReview.binding_hash, previous_version_id: null, selected_by: user.id, selected_at: new Date().toISOString() }, { onConflict: "environment,mode" })
      : await admin.from("prompt_runtime_selection").delete().eq("environment", "sandbox").eq("mode", body.mode);
    if (error) return json(500, { error: "Rollback failed." });
    await audit(admin, user.id, "sandbox_rolled_back", "prompt_runtime_selection", current.version_id, { mode: body.mode, to: prevReview ? prev.id : "baseline" });
    return json(200, { environment: "sandbox", mode: body.mode, rolled_back_from: current.version_id, now: prevReview ? prev.id : "baseline" });
  }

  if (action === "sandbox_generate") {
    // Resolves the exact reviewed, evaluated version server-side. Anything unverifiable falls back to the deployed baseline.
    if (!isMode(body.mode)) return json(400, { error: "mode required" });
    if (!aiKey) return json(503, { error: "Model key unavailable." });
    const key = body.mode as ModeKey;
    const c = CASES[key].find((x) => x.id === body.case_id) ?? CASES[key][0];
    const dep = await deployedBaseline(admin, key);
    const { data: baselines } = await admin.from("prompt_versions_eval").select("*").eq("mode", key).eq("kind", "baseline");
    const baseline = (baselines ?? []).find((v: Admin) => dep && v.prompt_text === dep.text && v.model === dep.model);
    if (!baseline) return json(409, { error: "No verified baseline for this mode." });
    const { data: sel } = await admin.from("prompt_runtime_selection").select("*").eq("environment", "sandbox").eq("mode", key).maybeSingle();
    let version = baseline, fallback = true, reason = "no sandbox selection";
    if (sel) {
      const b = await loadBinding(admin, sel.version_id);
      const { data: rv } = sel.review_id ? await admin.from("prompt_reviews").select("decision,binding_hash,candidate_id").eq("id", sel.review_id).maybeSingle() : { data: null };
      if (!("error" in b) && !b.stale && rv?.decision === "approved" && rv.candidate_id === sel.version_id && rv.binding_hash === sel.binding_hash && b.binding === sel.binding_hash) {
        version = b.candidate; fallback = false; reason = "selected approved version (hash verified)";
      } else reason = "selection failed verification; deployed baseline used";
    }
    const r = await generate(deps, null, "sandbox", key, systemOf(version, baseline), baseline.model, c);
    await audit(admin, user.id, "sandbox_generation", "prompt_versions_eval", version.id, { mode: key, fallback, case_id: c.id, ok: r.ok });
    if (!r.ok) return json(r.stage === "budget" ? 429 : 502, { error: r.stage === "budget" ? `Budget stop: ${r.reason}` : "Sandbox generation failed.", metadata: { version_id: version.id, fallback } });
    return json(200, {
      output: r.output, checks: screen(key, c, r.output, version.kind === "candidate" ? version.prompt_text : undefined),
      metadata: { environment: "sandbox", mode: key, version_id: version.id, label: version.label, content_hash: version.content_hash, fallback, reason, model: baseline.model, case_id: c.id, cost_usd: r.usage.cost },
    });
  }

  if (action === "create_packet") {
    const items = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
    if (!items.length || !body.title) return json(400, { error: "title and items required" });
    const items2: Admin[] = [];
    for (const it of items) {
      if (it.result_id) {
        // Full-pipeline result item (immutable prompt_pipeline_results row).
        if (!UUID_RE.test(String(it.result_id))) return json(400, { error: "bad result_id" });
        const { data: pr } = await admin.from("prompt_pipeline_results").select("id,mode,binding,stage_coverage,pipeline_parity,output").eq("id", it.result_id).maybeSingle();
        if (!pr) return json(404, { error: `result ${it.result_id} not found` });
        // Parity is derived from the stages that actually ran, never from the caller.
        const cov = Object.entries((pr.stage_coverage ?? {}) as Record<string, string>);
        const ran = cov.filter(([, v]) => v === "exercised");
        const parity = cov.length === 0 ? "unrecorded" : (ran.length === 0 || pr.output == null) ? "blocked"
          : (ran.length === cov.length && pr.pipeline_parity === "full_pipeline") ? "full_pipeline"
          : (ran.length === 1 && ran[0][0] === "primary") ? "final_call_only" : "partial";
        items2.push({ result_id: pr.id, mode: pr.mode, binding_hash: pr.binding?.binding_hash, parity, highlight: String(it.highlight ?? "").slice(0, 400), group: String(it.group ?? "").slice(0, 80) });
        continue;
      }
      if (!UUID_RE.test(String(it.job_id ?? ""))) return json(400, { error: "each item needs a job_id or result_id" });
      const { data: j } = await admin.from("prompt_eval_jobs").select("id,mode,binding_hash").eq("id", it.job_id).maybeSingle();
      if (!j) return json(404, { error: `job ${it.job_id} not found` });
      it.mode = j.mode; it.binding_hash = j.binding_hash; it.highlight = String(it.highlight ?? "").slice(0, 400);
      items2.push(it);
    }
    if (body.supersedes && !UUID_RE.test(String(body.supersedes))) return json(400, { error: "bad supersedes id" });
    const { data, error } = await admin.from("prompt_review_packets").insert({ title: String(body.title).slice(0, 160), items: body.supersedes ? [{ supersedes_packet: body.supersedes }, ...items2] : items2, created_by: user.id }).select("id").single();
    if (error) return json(500, { error: "Could not save packet." });
    await audit(admin, user.id, "review_packet_created", "prompt_review_packets", data.id, { items: items.length });
    return json(200, { packet_id: data.id });
  }


  // ---------------- Full-pipeline test runs (metered, synthetic accounts only) ----------------
  // pipeline_start: issues a short-lived server-side test run bound to one synthetic
  // account, one pipeline function, mode, case and version, then calls the DEPLOYED
  // function as that account. Every model call inside it reserves spend first.
  // pipeline_finalize: advances multi-step runs, reads the persisted result, checks
  // stage coverage from the spend ledger and stores an immutable result row.
  if (action === "pipeline_start" || action === "ownership_probe" || action === "pipeline_finalize" || action === "synthetic_as_user") {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // Synthetic accounts only. The password is derived server-side from the
    // service key and never stored or returned; magic links are rate-limited per
    // email, so concurrent runs used to fail.
    const sessionFor = async (userId: string): Promise<string | null> => {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      const email = u?.user?.email ?? "";
      if (!TEST_EMAIL.test(email)) return null;
      const password = (await sha256(`btln-synthetic:${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}:${userId}`)).slice(0, 40);
      const anon = createClient(supaUrl, anonKey, { auth: { persistSession: false } });
      let { data: v } = await anon.auth.signInWithPassword({ email, password });
      if (!v?.session) {
        await admin.auth.admin.updateUserById(userId, { password });
        ({ data: v } = await anon.auth.signInWithPassword({ email, password }));
      }
      return v?.session?.access_token ?? null;
    };
    const callFn = async (fn: string, access: string, header: string, payload: unknown) => {
      const r = await fetch(`${supaUrl}/functions/v1/${fn}`, { method: "POST", headers: { Authorization: `Bearer ${access}`, apikey: anonKey, "Content-Type": "application/json", ...(header ? { "x-btln-test-run": header } : {}) }, body: JSON.stringify(payload) });
      const t = await r.text();
      let j: Admin = null; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
      return { status: r.status, body: j };
    };

    // Acts AS a synthetic account through its own signed-in session, so every
    // normal ownership / identity / consent guard applies. Whitelisted calls
    // only; no model call can run unmetered (synthetic accounts without a test
    // token are refused by testRun.ts).
    if (action === "synthetic_as_user") {
      const target = String(body.target_user_id ?? "");
      if (!UUID_RE.test(target)) return json(400, { error: "target_user_id required" });
      const access = await sessionFor(target);
      if (!access) return json(403, { error: "Synthetic accounts only." });
      const RPCS = new Set(["journey_confirm_identity", "journey_confirm_relationship", "journey_source_participants", "journey_assign_source", "journey_set_source_excluded", "journey_auto_include"]);
      const as = createClient(supaUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${access}` } } });
      if (body.rpc) {
        if (!RPCS.has(String(body.rpc))) return json(400, { error: "rpc not allowed" });
        const { data, error } = await as.rpc(String(body.rpc), body.args ?? {});
        await audit(admin, user.id, "synthetic_as_user", "rpc", target, { rpc: body.rpc });
        return json(200, { data, error: error?.message ?? null });
      }
      if (body.select === "journey_sources") {
        const { data, error } = await as.from("journey_sources").select("id,source_kind,source_id,identity_status,subject_participant,excluded_at,quarantined_at,evaluation_run_id,relationship_id,dated_count,observed_period_start,observed_period_end").eq("id", String(body.id ?? ""));
        return json(200, { data, error: error?.message ?? null });
      }
      if (body.fn === "relationship360") {
        // Ordinary (non-test) call: used to prove evaluation output is not eligible outside the scope.
        const r = await callFn("relationship360", access, "", body.payload ?? {});
        return json(200, r);
      }
      return json(400, { error: "nothing to do" });
    }

    if (action === "ownership_probe") {
      // No-model integration fixture: synthetic accounts calling Deep Read with
      // no metered token run in the blocked context, so any model call is
      // refused and nothing is spent. Verifies owner binding on the deployed code.
      const accts = [body.a, body.b].map(String);
      if (!accts.every((x) => UUID_RE.test(x))) return json(400, { error: "a and b synthetic ids required" });
      const payload = () => ({ session_id: crypto.randomUUID(), input_method: "paste", context_data: { name1: "Robin", name2: "Sam" }, raw_text: "Robin: ownership probe line one\nSam: ownership probe line two\nRobin: probe three" });
      const out: Admin = {};
      const ids: string[] = [];
      for (const [i, u] of accts.entries()) {
        const tok = await sessionFor(u);
        if (!tok) return json(403, { error: "Synthetic accounts only" });
        const r = await callFn("analyze-conversation", tok, "", payload());
        const id = r.body?.analysis_id;
        ids.push(id);
        const { data: row } = id ? await admin.from("analyses").select("user_id").eq("id", id).maybeSingle() : { data: null };
        out[`account_${i ? "b" : "a"}`] = { status: r.status, owner_bound: r.body?.owner_bound, persisted_owner_matches: row?.user_id === u };
      }
      const tokB = await sessionFor(accts[1]);
      const cross = await callFn("analyze-conversation", tokB!, "", { ...payload(), analysis_id: ids[0] });
      out.cross_account_rerun = { status: cross.status };
      const bad = await callFn("analyze-conversation", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.forged", "", payload());
      out.forged_token = { status: bad.status };
      await new Promise((r) => setTimeout(r, 6000));
      const { data: after } = await admin.from("analyses").select("id,user_id,status").in("id", ids.filter(Boolean));
      out.after_completion = (after ?? []).map((r: Admin) => ({ id: r.id, owner_kept: r.user_id === accts[ids.indexOf(r.id)], status: r.status }));
      return json(200, out);
    }

    if (action === "pipeline_start") {
      const key = body.mode;
      if (!isMode(key)) return json(400, { error: "Unknown mode." });
      const c0 = PIPELINE_CASES[key].find((x) => x.id === body.case_id);
      if (!c0) return json(400, { error: "Unknown pipeline case for this mode." });
      // Unseen per-run injection payload (never the fixed dataset canary).
      const payloadSeed = c0.expect.canary ? crypto.randomUUID() : null;
      const c = withPayloadToken(c0, payloadSeed ? await payloadToken(payloadSeed) : null);
      const variant = body.variant === "candidate" ? "candidate" : body.variant === "personalization" ? "personalization" : "baseline";
      const target = String(body.target_user_id ?? "");
      if (!UUID_RE.test(target)) return json(400, { error: "target_user_id required" });
      let cand: Admin = null; let baselineHash: string | null = null; let binding: Admin = null;
      const dep = await deployedBaseline(admin, key);
      if (!dep) return json(409, { error: "No deployed baseline for this mode." });
      if (variant === "candidate") {
        if (!UUID_RE.test(String(body.candidate_id ?? ""))) return json(400, { error: "candidate_id required" });
        const b = await loadBinding(admin, body.candidate_id);
        if ("error" in b) return json(409, { error: b.error });
        if (b.key !== key) return json(409, { error: "Candidate is for another mode." });
        if (b.stale) return json(409, { error: "Deployed baseline changed since this candidate was bound; re-evaluate." });
        cand = b.candidate; baselineHash = await sha256(b.baseline.prompt_text);
        binding = { binding_hash: b.binding, candidate: b.candidate.content_hash, baseline: b.baseline.content_hash, dataset: b.dataset.content_hash, rubric: b.rubric.content_hash };
      }
      const access = await sessionFor(target);
      if (!access) return json(403, { error: "Target must be a synthetic @btln-test.dev account." });
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((x) => x.toString(16).padStart(2, "0")).join("");
      const maxCalls = key === "interactive" ? 8 : key === "deep_read_full" ? (c.id === "dr-long-10k" ? 16 : 10) : c.id.endsWith("-long") ? 8 : 6;
      const { data: run, error: runErr } = await admin.from("prompt_test_runs").insert({
        secret_hash: await sha256(secret), target_user_id: target, operator_id: user.id, function_name: FUNCTION_FOR[key], mode: key, variant,
        candidate_id: cand?.id ?? null, candidate_addendum: cand?.prompt_text ?? null, baseline_text_hash: baselineHash, case_id: c.id,
        purpose: String(body.purpose ?? "").slice(0, 300), max_calls: maxCalls,
        // Explicit, operator-set evaluation scope: baseline Relationship360 only; never candidates.
        eval_scope: body.eval_scope === true && key === "relationship360" && variant === "baseline", expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        state: { binding, deployed_source: dep.source, model: dep.model, personalization: body.personalization ?? null, payload_seed: payloadSeed },
      }).select("id").single();
      if (runErr || !run) return json(500, { error: "Could not create test run." });
      const header = `${run.id}.${secret}`;
      if (key === "group_roast") {
        // Group Roast reuses a finished roast for identical input. Remove earlier
        // pipeline-test roasts of this synthetic account so this run really generates.
        const { data: prior } = await admin.from("prompt_test_runs").select("state").eq("mode", "group_roast").eq("target_user_id", target).neq("id", run.id);
        const ids = (prior ?? []).map((x: Admin) => x.state?.first?.body?.group_roast_id).filter((x: unknown) => typeof x === "string");
        if (ids.length) await admin.from("group_roasts").delete().eq("user_id", target).in("id", ids);
      }
      await audit(admin, user.id, "pipeline_run_started", "prompt_test_runs", run.id, { mode: key, case_id: c.id, variant, target_is_synthetic: true });
      // Interactive: the source Quick Take is created inside the same run (baseline Quick Take prompt).
      const firstKey: ModeKey = key === "interactive" ? "quick_take" : key;
      const firstCase = key === "interactive" ? { ...c, speakers: ["You", "Them"], messages: [{ id: "s1", speaker: "Them", text: String(c.interactive?.original_take?.read ?? "") }, { id: "s2", speaker: "You", text: String(c.interactive?.prior_updates?.[0]?.result_json?.context_summary ?? "See you soon") }, ...c.messages.slice(0, 1).map((m) => ({ ...m, speaker: "Them" }))] } : c;
      const payload = pipelineRequest(firstKey, firstCase as ModeCase);
      // Relationship-level Relationship360 (a normal product scope), owner-checked by the function itself.
      if (key === "relationship360" && UUID_RE.test(String(body.relationship_id ?? ""))) (payload as Admin).relationship_id = String(body.relationship_id);
      if (key === "deep_read_full" && body.personalization?.free_text !== undefined) (payload.context_data as Admin).free_text = String(body.personalization.free_text).slice(0, 500);
      const r = await callFn(FUNCTION_FOR[firstKey], access, header, payload);
      // Server-owned provenance (eval-isolation-1): the result is recorded as
      // evaluation output at once; a DB trigger quarantines candidate output
      // even if it was already staged, and staging paths refuse it later.
      {
        const kindFor: Record<string, [string, string]> = { quick_take: ["quick_take", "decode_id"], interactive: ["quick_take", "decode_id"], deep_read_full: ["deep_read", "analysis_id"], group_read: ["group_read", "group_read_id"], group_roast: ["group_roast", "group_roast_id"] };
        const kf = kindFor[key];
        const sid = kf ? r.body?.[kf[1]] : null;
        if (kf && typeof sid === "string" && UUID_RE.test(sid)) {
          await admin.from("evaluation_artifacts").upsert({ source_kind: kf[0], source_id: sid, run_id: run.id, candidate_id: cand?.id ?? null, variant, target_user_id: target }, { onConflict: "source_kind,source_id", ignoreDuplicates: true });
        }
      }
      await admin.from("prompt_test_runs").update({ state: { binding, deployed_source: dep.source, model: dep.model, personalization: body.personalization ?? null, payload_seed: payloadSeed, secret, first: { status: r.status, body: r.body, session_id: payload.session_id ?? null } } }).eq("id", run.id);
      return json(r.status < 300 ? 200 : 502, { run_id: run.id, status: r.status, response: r.body });
    }

    // pipeline_finalize
    const runId = String(body.run_id ?? "");
    if (!UUID_RE.test(runId)) return json(400, { error: "run_id required" });
    const { data: run } = await admin.from("prompt_test_runs").select("*").eq("id", runId).maybeSingle();
    if (!run) return json(404, { error: "Unknown run." });
    const { data: existing } = await admin.from("prompt_pipeline_results").select("*").eq("test_run_id", runId).maybeSingle();
    if (existing) return json(200, { result: existing, already: true });
    const key = run.mode as ModeKey;
    const st = run.state ?? {};
    const c = withPayloadToken(PIPELINE_CASES[key].find((x) => x.id === run.case_id)!, st.payload_seed ? await payloadToken(st.payload_seed) : null);
    const header = `${run.id}.${st.secret}`;
    let output: Admin = null; let pending = false; let extraNotes: string[] = [];
    const nonModelStages: Record<string, string> = {};
    const readRow = async (table: string, id: string, col: string) => {
      const { data } = await admin.from(table).select(`status,${col},error_message`).eq("id", id).maybeSingle();
      return data;
    };
    if (key === "relationship360") {
      output = st.first?.body?.content ?? null;
      if (st.first?.body?.state !== "complete") extraNotes.push(`build state: ${st.first?.body?.state ?? st.first?.status}`);
    } else if (key === "interactive") {
      const decodeId = st.first?.body?.decode_id;
      const d = decodeId ? await readRow("decodes", decodeId, "result_json") : null;
      if (!d) extraNotes.push("source Quick Take was not created");
      else if (d.status !== "complete" && d.status !== "failed") pending = true;
      else if (d.status === "failed") extraNotes.push(`source Quick Take failed: ${d.error_message ?? ""}`);
      else if (!st.followup) {
        const access = await sessionFor(run.target_user_id);
        if (!access) return json(403, { error: "Synthetic session unavailable." });
        const sentText = String(c.interactive?.prior_updates?.[0]?.result_json?.context_summary ?? "").match(/'([^']+)'/)?.[1] ?? "See you then!";
        const sent = c.interactive?.prior_updates?.length
          ? await callFn("interactive-mode", access, header, { decode_id: decodeId, client_request_id: crypto.randomUUID(), event_type: "sent_reply", action: "continue", raw_text: sentText, speaker_order: ["you"] })
          : null;
        const follow = await callFn("interactive-mode", access, header, pipelineRequest("interactive", c, { decodeId }));
        const { data: evs } = await admin.from("interactive_events").select("id,event_type,provenance,status").eq("user_id", run.target_user_id).in("id", [sent?.body?.event_id, follow.body?.event_id].filter(Boolean));
        await admin.from("prompt_test_runs").update({ state: { ...st, followup: { sent: sent ? { status: sent.status, event_id: sent.body?.event_id, thread_id: sent.body?.thread_id } : null, follow: { status: follow.status, event_id: follow.body?.event_id, thread_id: follow.body?.thread_id }, events: evs ?? [] } } }).eq("id", run.id);
        output = follow.body?.result ?? null;
        nonModelStages.same_thread = sent ? (sent.body?.thread_id && sent.body.thread_id === follow.body?.thread_id ? "verified" : "failed") : "not_applicable";
        nonModelStages.sent_provenance = (evs ?? []).some((e: Admin) => e.event_type === "sent_reply" && e.provenance?.source === "confirmed_sent") || !sent ? "verified" : "failed";
        if (follow.status >= 300) extraNotes.push(`follow-up returned ${follow.status}: ${JSON.stringify(follow.body).slice(0, 200)}`);
      }
    } else {
      const ref = RESULT_REF[key]!;
      const id = st.first?.body?.[ref.idField];
      const row = id ? await readRow(ref.table, id, ref.column) : null;
      if (!row) extraNotes.push(`no ${ref.table} row: first response ${st.first?.status} ${JSON.stringify(st.first?.body ?? {}).slice(0, 200)}`);
      else if (!["complete", "completed", "failed", "error"].includes(String(row.status))) pending = true;
      else { output = row[ref.column] ?? null; if (row.status !== "complete") extraNotes.push(`pipeline status ${row.status}: ${row.error_message ?? ""}`); }
      if (key === "deep_read_full" && id && !pending) {
        const { count } = await admin.from("messages_temp").select("id", { count: "exact", head: true }).eq("analysis_id", id);
        nonModelStages.raw_message_deletion = count === 0 ? "verified" : `failed (${count} temporary rows remain)`;
        nonModelStages.attributed_evidence = output?.attributed_evidence ? "present" : "missing";
        nonModelStages.quote_integrity = output?.quote_integrity ? `checked ${output.quote_integrity.quotes_checked}, supported ${output.quote_integrity.quotes_supported}, removed ${output.quote_integrity.sentences_removed?.length ?? 0}, duplicates ${output.quote_integrity.duplicate_sentences_removed}` : (row?.status === "complete" ? "missing" : "not_reached");
        if (output?.coverage) nonModelStages.history_coverage = `supplied ${output.coverage.messages_supplied}, analyzed ${output.coverage.messages_analyzed}, read by AI ${output.coverage.messages_read_by_ai}, quoted verbatim ${output.coverage.messages_quoted_verbatim}, slices ${output.coverage.chunk_count} (failed ${output.coverage.failed_chunks}); attribution covers the recent window only`;
        nonModelStages.style_rewrite = output?.personalization ? `report: ${output.personalization.rewrite}, ${output.personalization.fields_applied}/${output.personalization.fields_total} fields` : "not_requested";
      }
    }
    if (pending) return json(202, { state: "pending" });
    if (key === "group_roast") {
      // Fresh evaluation only: the result row must be created inside this run.
      const rid = st.first?.body?.[RESULT_REF.group_roast!.idField];
      const { data: fr } = rid ? await admin.from("group_roasts").select("created_at").eq("id", rid).maybeSingle() : { data: null };
      nonModelStages.fresh_result = fr && new Date(fr.created_at) >= new Date(run.created_at) ? "verified" : "failed (cached or pre-existing result)";
    }

    const { data: ledger } = await admin.from("prompt_spend_ledger").select("id,stage,kind,model,reserved_usd,actual_usd,status,outcome").eq("job_id", run.id).order("created_at");
    const rows = ledger ?? [];
    const stagesSeen = [...new Set(rows.map((x: Admin) => x.stage ?? "unlabelled"))];
    const expected = c.id.endsWith("-long") || c.id === "dr-long-10k" ? [...new Set(["digest", ...EXPECTED_STAGES[key]])] : EXPECTED_STAGES[key];
    const coverage: Record<string, string> = {};
    for (const s of expected) coverage[s] = rows.some((x: Admin) => x.stage === s && String(x.outcome ?? "").startsWith("ok")) ? "exercised" : rows.some((x: Admin) => x.stage === s) ? "failed" : "missing";
    for (const s of stagesSeen) if (!(s in coverage)) coverage[s] = "exercised";
    if (["deep_read_full", "group_read", "group_roast"].includes(key) && !("digest" in coverage)) coverage.digest = "not_exercised (short input; long-history digest queued with 10k release checks)";
    Object.assign(coverage, nonModelStages);
    const coreOk = expected.every((s) => coverage[s] === "exercised") && Object.values(nonModelStages).every((v) => !String(v).startsWith("failed") && v !== "missing") && output !== null;
    const parity = !coreOk ? "partial_pipeline" : String(coverage.digest ?? "").startsWith("not_exercised") ? "partial_pipeline" : "full_pipeline";
    let caseForScreen: ModeCase = c;
    if (key === "relationship360") {
      const { data: obsRows } = await admin.from("journey_observations").select("id,journey_source_id,relationship_id,subject_kind,observed_period_start").eq("user_id", run.target_user_id).is("excluded_at", null).limit(500);
      caseForScreen = { ...c, r360: { observations: (obsRows ?? []).map((o: Admin) => ({ observation_id: o.id, source_id: o.journey_source_id, relationship_id: o.relationship_id, relationship_confirmed: true, kind: o.subject_kind, observed_from: o.observed_period_start })) } } as Admin;
    }
    if (key === "interactive") caseForScreen = c;
    const checks: Admin[] = output ? screen(key, caseForScreen, output, run.variant === "candidate" ? run.candidate_addendum : undefined) : [{ id: "json_valid", hard: true, passed: false, detail: "no pipeline output" }];
    // An output not produced by this run's own model stages (e.g. a cached result) never counts as a pass.
    const missingStages = expected.filter((x) => coverage[x] !== "exercised");
    checks.push({ id: "pipeline_stages_exercised", hard: true, passed: missingStages.length === 0, detail: missingStages.length ? `not exercised in this run: ${missingStages.join(", ")}` : "all expected model stages ran in this run" });
    const reserved = rows.reduce((n: number, x: Admin) => n + Number(x.reserved_usd ?? 0), 0);
    const actual = rows.filter((x: Admin) => x.actual_usd !== null).reduce((n: number, x: Admin) => n + Number(x.actual_usd), 0);
    const unknown = rows.filter((x: Admin) => x.actual_usd === null).length;
    const bindingRec = {
      mode: key, pipeline_cases: PIPELINE_REVISION, pipeline_code: PIPELINE_CODE_VERSIONS[key], rubric: MODE_RUBRIC_VERSION,
      deployed_source: st.deployed_source, models: [...new Set(rows.map((x: Admin) => x.model))], candidate: st.binding ?? null,
      case_hash: await sha256(c), variant: run.variant, personalization: st.personalization ?? null,
    };
    const { data: saved, error: saveErr } = await admin.from("prompt_pipeline_results").insert({
      test_run_id: run.id, mode: key, case_id: c.id, variant: run.variant, candidate_id: run.candidate_id,
      binding: { ...bindingRec, binding_hash: await sha256(bindingRec) }, stage_coverage: coverage, pipeline_parity: parity,
      output, checks, screen_passed: output ? hardPass(checks) : false,
      spend: { calls: rows.length, reserved_usd: reserved, actual_usd: actual, unknown_cost_calls: unknown, ledger: rows.map((x: Admin) => ({ stage: x.stage, kind: x.kind, model: x.model, reserved: x.reserved_usd, actual: x.actual_usd, outcome: x.outcome })) },
      notes: [...extraNotes, key === "interactive" ? "source Quick Take created inside the run with the deployed Quick Take prompt" : ""].filter(Boolean).join("; ") || null,
      created_by: user.id,
    }).select("*").single();
    if (saveErr) return json(500, { error: "Could not store pipeline result." });
    await admin.from("prompt_test_runs").update({ status: "finalized", finalized_at: new Date().toISOString(), state: { ...st, secret: null } }).eq("id", run.id);
    await audit(admin, user.id, "pipeline_run_finalized", "prompt_pipeline_results", saved.id, { mode: key, parity, screen_passed: saved.screen_passed });
    return json(200, { result: saved });
  }


  if (action === "pipeline_results") {
    const q = admin.from("prompt_pipeline_results").select("*, prompt_pipeline_rescreens(rubric_version,checks,screen_passed,reason,created_at)").order("created_at", { ascending: false }).limit(200);
    const { data } = isMode(body.mode) ? await q.eq("mode", body.mode) : await q;
    return json(200, { results: data ?? [], rubric_version: MODE_RUBRIC_VERSION });
  }

  // Operator-only component review of a RECORDED Relationship360 test build.
  // Reads the immutable test-run record (never the ordinary summary tables) and
  // only for synthetic evaluation accounts. Not an authenticated customer view.
  if (action === "r360_component_review") {
    if (!UUID_RE.test(String(body.result_id ?? ""))) return json(400, { error: "result_id required" });
    const { data: pr } = await admin.from("prompt_pipeline_results").select("id,mode,test_run_id,created_at").eq("id", body.result_id).maybeSingle();
    if (!pr || pr.mode !== "relationship360") return json(404, { error: "Not a Relationship360 result." });
    const { data: run } = await admin.from("prompt_test_runs").select("id,target_user_id,eval_scope,state,created_at").eq("id", pr.test_run_id).maybeSingle();
    const { data: evalAcct } = run ? await admin.from("evaluation_accounts").select("user_id").eq("user_id", run.target_user_id).maybeSingle() : { data: null };
    if (!run || !evalAcct) return json(403, { error: "Synthetic evaluation accounts only." });
    const b = run.state?.first?.body ?? {};
    const content = b.content ?? null;
    const ids = new Set<string>();
    for (const k of ["patterns", "working", "recommendations"]) for (const x of (content?.[k] ?? [])) for (const e of (x?.evidence ?? [])) if (typeof e === "string" && UUID_RE.test(e)) ids.add(e);
    const { data: obs } = ids.size ? await admin.from("journey_observations").select("id,journey_source_id,subject_kind,subject_label,observation_type,statement,evidence_refs,confidence,observed_period_start,observed_period_end,created_at").eq("user_id", run.target_user_id).in("id", [...ids]) : { data: [] };
    const srcIds = Array.isArray(b.coverage?.input_source_ids) ? b.coverage.input_source_ids.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x as string)) : [];
    const { data: sources } = srcIds.length ? await admin.from("journey_sources").select("id,source_kind,dated_count,undated_count,date_provenance,date_precision,observed_period_start,observed_period_end,evaluation_run_id,quarantined_at").eq("user_id", run.target_user_id).in("id", srcIds) : { data: [] };
    await audit(admin, user.id, "r360_component_review", "prompt_pipeline_results", pr.id, {});
    return json(200, { recorded: true, run_id: run.id, eval_scope: run.eval_scope, generated_at: run.created_at, content, coverage: b.coverage ?? null, observations: obs ?? [], sources: sources ?? [] });
  }

  // Re-applies the CURRENT versioned rubric to stored outputs (no model call).
  // The original result row is immutable; the re-screen is a separate record.
  if (action === "pipeline_rescreen") {
    const reason = String(body.reason ?? "").slice(0, 300);
    if (!reason) return json(400, { error: "reason required" });
    const { data: rows } = await admin.from("prompt_pipeline_results").select("*, prompt_test_runs!inner(target_user_id, candidate_addendum, state)").neq("binding->>rubric", MODE_RUBRIC_VERSION).limit(200);
    let n = 0;
    for (const r of rows ?? []) {
      const key = r.mode as ModeKey;
      let c: Admin = PIPELINE_CASES[key]?.find((x) => x.id === r.case_id);
      if (!c) continue;
      if (r.prompt_test_runs?.state?.payload_seed) c = withPayloadToken(c, await payloadToken(r.prompt_test_runs.state.payload_seed));
      if (key === "relationship360") {
        const { data: obsRows } = await admin.from("journey_observations").select("id,journey_source_id,relationship_id,subject_kind,observed_period_start").eq("user_id", r.prompt_test_runs.target_user_id).is("excluded_at", null).limit(500);
        c = { ...c, r360: { observations: (obsRows ?? []).map((o: Admin) => ({ observation_id: o.id, source_id: o.journey_source_id, relationship_id: o.relationship_id, relationship_confirmed: true, kind: o.subject_kind, observed_from: o.observed_period_start })) } };
      }
      const checks: Admin[] = r.output ? screen(key, c, r.output, r.variant === "candidate" ? r.prompt_test_runs.candidate_addendum : undefined) : [{ id: "json_valid", hard: true, passed: false, detail: "no pipeline output" }];
      const stageCheck = (r.checks ?? []).find((x: Admin) => x.id === "pipeline_stages_exercised")
        ?? { id: "pipeline_stages_exercised", hard: true, passed: Object.entries(r.stage_coverage ?? {}).every(([k, v]) => !["primary", "synthesis", "attribution"].includes(k) || v === "exercised"), detail: "derived from stored stage coverage" };
      checks.push(stageCheck);
      const { error } = await admin.from("prompt_pipeline_rescreens").insert({ result_id: r.id, rubric_version: MODE_RUBRIC_VERSION, checks, screen_passed: r.output ? hardPass(checks) : false, reason, created_by: user.id });
      if (!error) n++;
    }
    await audit(admin, user.id, "pipeline_rescreen", "prompt_pipeline_rescreens", null, { rubric: MODE_RUBRIC_VERSION, count: n });
    return json(200, { rescreened: n, rubric_version: MODE_RUBRIC_VERSION });
  }

  // Test fixture for personalization runs: sets or clears the consented style
  // feedback of a SYNTHETIC account only (the same rows the product's
  // "Helpful / Don't Like It" control writes). Never usable on a real account.
  if (action === "synthetic_preferences") {
    const target = String(body.target_user_id ?? "");
    const { data: u } = UUID_RE.test(target) ? await admin.auth.admin.getUserById(target) : { data: null };
    if (!TEST_EMAIL.test(u?.user?.email ?? "")) return json(403, { error: "Synthetic accounts only." });
    const tag = "pipeline-eval-fixture";
    // Synthetic account: start every fixture from a clean slate so "off" really is off.
    await admin.from("ai_feedback").delete().eq("user_id", target);
    if (body.op === "set") {
      const note = String(body.note ?? "").slice(0, 240);
      const { error } = await admin.from("ai_feedback").insert({ user_id: target, source_kind: "deep_read", source_id: crypto.randomUUID(), target_kind: "recommendation", target_key: tag, rating: body.rating === "down" ? "down" : "up", reason_codes: Array.isArray(body.reason_codes) ? body.reason_codes.slice(0, 5).map(String) : [], comment: note, personalization_consent: body.consent !== false, product_improvement_consent: false });
      if (error) return json(500, { error: `Could not set fixture: ${error.message}` });
    }
    await audit(admin, user.id, "synthetic_preferences", "ai_feedback", target, { op: body.op });
    return json(200, { ok: true });
  }

  if (action === "advice_semantic_eval") {
    // Held-out semantic recipient check: one metered judge call per fixture, same prompt/model as production.
    if (!aiKey) return json(503, { error: "Model key unavailable." });
    const jobId = crypto.randomUUID();
    const rows: Admin[] = [];
    // "current" suite: t1 is replaced by its adjudicated v2 (set 4); the original stays runnable as set 1.
    const sets: typeof SEMANTIC_FIXTURES_4 = body.set === 1 ? SEMANTIC_FIXTURES : body.set === 2 ? SEMANTIC_FIXTURES_2 : body.set === 3 ? SEMANTIC_FIXTURES_3 : body.set === 4 ? SEMANTIC_FIXTURES_4
      : [...SEMANTIC_FIXTURES.filter((f) => f.id !== "t1-pronoun-noquote"), ...SEMANTIC_FIXTURES_2, ...SEMANTIC_FIXTURES_3, ...SEMANTIC_FIXTURES_4];
    for (const fx of sets) {
      const req = semanticRequest(fx.items, fx.parts, fx.msgs);
      const r = await meteredCall(deps, { scope: SCOPE, jobId, kind: "judge", timeoutMs: 60_000, body: {
        model: SEMANTIC_MODEL, max_tokens: 1500, temperature: 0, response_format: { type: "json_object" },
        messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }] } as Admin });
      let parsed: unknown = null;
      try { if (r.ok) parsed = extractJsonObject(String(r.data?.choices?.[0]?.message?.content ?? "")).value; } catch { parsed = null; }
      const v = applySemanticVerdicts(fx.items, parsed, req);
      for (const i of fx.items) { const x = v.get(i.id)!; rows.push({ fixture: fx.id, id: i.id, expect: i.expect, got: x.ok ? "keep" : "withhold", reasons: x.reasons, evidence: x.evidence, behavior_lines: x.behavior_lines, set4: SEMANTIC_FIXTURES_4.some((f) => f.id === fx.id), note: i.note }); }
      if (!r.ok) rows.push({ fixture: fx.id, call_failed: r.stage === "budget" ? `budget:${r.reason}` : r.reason });
    }
    const items = rows.filter((r) => r.expect);
    const summary = {
      items: items.length,
      false_accepts: items.filter((r) => r.expect === "withhold" && r.got === "keep").length,
      false_rejects: items.filter((r) => r.expect === "keep" && r.got === "withhold").length,
      valid_items: items.filter((r) => r.expect === "keep").length,
      swapped_items: items.filter((r) => r.expect === "withhold").length,
      ambiguous_items: items.filter((r) => r.expect === "ambiguous").map((r) => `${r.fixture}/${r.id}:${r.got}`),
    };
    const { data: ledger } = await admin.from("prompt_spend_ledger").select("reserved_usd,actual_usd,status").eq("job_id", jobId);
    await audit(admin, user.id, "advice_semantic_eval", "prompt_spend_ledger", null, { job_id: jobId, summary });
    return json(200, { job_id: jobId, model: SEMANTIC_MODEL, version: ADVICE_SEMANTIC_VERSION, summary, rows, ledger });
  }

  // No-model DB self-test of advice-review-1: concurrent claims, shared cap, stale finish, expiry, cleanup.
  // Uses a throwaway synthetic analysis row (session "selftest-advice-review") and deletes it afterwards.
  if (action === "advice_review_selftest") {
    const out: Admin = {};
    const mk = async (extra: Admin = {}) => {
      const { data: an, error } = await admin.from("analyses").insert({ session_id: `selftest-advice-review-${crypto.randomUUID()}`, context_data: { selftest: true }, input_method: "paste", status: "complete",
        result_json: { communication_suggestions: { person1: [], person2: [] }, advice_integrity: { review: { status: "pending", verified: 0, rejected: 0, unresolved: 1, attempts: 2, max_attempts: 3, can_retry: true }, note: "x", withheld_count: 1 } } }).select("id").single();
      if (error) throw new Error(error.message);
      await admin.from("advice_reviews").insert({ analysis_id: an.id, status: "pending", attempts: 0, max_attempts: 3, checker_version: ADVICE_SEMANTIC_VERSION,
        pending: [{ key: "k", text: "t" }], evidence: { transcript: "x" }, evidence_expires_at: new Date(Date.now() + 3600_000).toISOString(), ...extra });
      return an.id as string;
    };
    const claim = (id: string, gap = 0) => admin.rpc("claim_advice_review", { p_analysis_id: id, p_lease_seconds: 75, p_min_gap_seconds: gap }).then((r: Admin) => r.data);
    const ids: string[] = [];
    try {
      // 1. 12 simultaneous claims against one review with 3 attempts free: exactly 1 wins (single-flight lease).
      const a = await mk(); ids.push(a);
      const res = await Promise.all(Array.from({ length: 12 }, () => claim(a)));
      out.concurrent_single_flight = { requests: 12, accepted: res.filter((r: Admin) => r?.ok).length, reasons: res.filter((r: Admin) => !r?.ok).map((r: Admin) => r?.reason) };
      const { data: ra } = await admin.from("advice_reviews").select("attempts").eq("analysis_id", a).single();
      out.concurrent_attempts_recorded = ra.attempts;
      // 2. Shared cap: releases between rounds, 3 rounds of 6 concurrent claims -> at most 3 attempts ever; 4th round terminal.
      const b = await mk(); ids.push(b);
      let wins = 0;
      for (let round = 0; round < 4; round++) {
        const rr = await Promise.all(Array.from({ length: 6 }, () => claim(b)));
        const w = rr.find((r: Admin) => r?.ok); if (w) { wins++; await admin.rpc("release_advice_review", { p_analysis_id: b, p_attempt: w.attempt }); }
      }
      const { data: rb } = await admin.from("advice_reviews").select("status,attempts,evidence,pending,terminal_reason").eq("analysis_id", b).single();
      out.shared_cap = { rounds: 4, per_round: 6, accepted: wins, final: { status: rb.status, attempts: rb.attempts, evidence_cleared: rb.evidence === null && rb.pending === null, reason: rb.terminal_reason } };
      // 3. Stale result: report changes after claim -> finish refused, nothing written, review terminal.
      const c = await mk(); ids.push(c);
      const cc = await claim(c);
      await admin.from("analyses").update({ result_json: { corrected: true } }).eq("id", c);
      const fin = await admin.rpc("finish_advice_review", { p_analysis_id: c, p_attempt: cc.attempt, p_base_hash: cc.base_hash, p_new_result: { should_not: "apply" }, p_remaining: [], p_status: "complete", p_terminal_reason: null });
      const { data: ac } = await admin.from("analyses").select("result_json").eq("id", c).single();
      const { data: rc } = await admin.from("advice_reviews").select("status,terminal_reason,evidence").eq("analysis_id", c).single();
      out.stale_result = { finish: fin.data, report_untouched: !!(ac.result_json as Admin)?.corrected && !(ac.result_json as Admin)?.should_not, review: { status: rc.status, reason: rc.terminal_reason, evidence_cleared: rc.evidence === null } };
      // 4. Old attempt number cannot finish after a newer claim.
      const d = await mk(); ids.push(d);
      const d1 = await claim(d); await admin.rpc("release_advice_review", { p_analysis_id: d, p_attempt: d1.attempt });
      const d2 = await claim(d);
      const late = await admin.rpc("finish_advice_review", { p_analysis_id: d, p_attempt: d1.attempt, p_base_hash: d1.base_hash, p_new_result: { late: true }, p_remaining: [], p_status: "complete", p_terminal_reason: null });
      out.late_attempt = { first: d1.attempt, second: d2?.attempt, late_finish: late.data };
      // 5. Expired evidence: claim refused, evidence cleared, customer note set to unavailable.
      const e = await mk({ evidence_expires_at: new Date(Date.now() - 1000).toISOString() }); ids.push(e);
      const ce = await claim(e);
      const { data: re } = await admin.from("advice_reviews").select("status,evidence,pending,terminal_reason").eq("analysis_id", e).single();
      const { data: ae } = await admin.from("analyses").select("result_json").eq("id", e).single();
      out.expired_evidence = { claim: ce, status: re.status, evidence_cleared: re.evidence === null && re.pending === null, reason: re.terminal_reason, report_review_status: (ae.result_json as Admin)?.advice_integrity?.review?.status, note: (ae.result_json as Admin)?.advice_integrity?.note };
      // 6. Backoff gap: immediate second claim after release is refused.
      const f = await mk(); ids.push(f);
      const f1 = await claim(f, 5); await admin.rpc("release_advice_review", { p_analysis_id: f, p_attempt: f1.attempt });
      out.backoff = { first: f1.ok, immediate_second: (await claim(f, 5))?.reason };
      // 7. Report deletion cascades the review (and its evidence).
      await admin.from("analyses").delete().eq("id", a);
      const { data: gone } = await admin.from("advice_reviews").select("analysis_id").eq("analysis_id", a).maybeSingle();
      out.delete_cascade = gone === null;
    } finally {
      await admin.from("analyses").delete().in("id", ids);
    }
    const { data: left } = await admin.from("advice_reviews").select("analysis_id").in("analysis_id", ids);
    out.fixtures_left = left?.length ?? 0;
    await audit(admin, user.id, "advice_review_selftest", "advice_reviews", null, out);
    return json(200, out);
  }

  // Tuned regression run (advice-semantic-5+): ext-1 (dataset unchanged; config differs, so labelled
  // "tuned_regression", never held-out) plus reg-prospective-1. Metered through meteredCall.
  if (action === "advice_regression_run") {
    if (!aiKey) return json(503, { error: "Model key unavailable." });
    const jobId = crypto.randomUUID();
    const rows: Admin[] = [];
    const calls: Admin[] = [];
    for (const set of [{ label: "ext-1 (tuned regression)", B: EXTERNAL_BENCHMARK_1 }, { label: "reg-prospective-1 (regression, authored post ext-1)", B: REGRESSION_PROSPECTIVE_1 }]) {
      for (const fx of set.B.fixtures) {
        const req = semanticRequest(fx.items, fx.parts, fx.msgs);
        const r = await meteredCall(deps, { scope: SCOPE, jobId, kind: "judge", timeoutMs: 60_000, body: {
          model: SEMANTIC_MODEL, max_tokens: 1500, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }] } as Admin });
        let parsed: unknown = null;
        try { if (r.ok) parsed = extractJsonObject(String(r.data?.choices?.[0]?.message?.content ?? "")).value; } catch { parsed = null; }
        calls.push({ set: set.label, fixture: fx.id, ok: r.ok, failure: r.ok ? null : (r.stage === "budget" ? `budget:${r.reason}` : r.reason), parsed: parsed !== null });
        const v = applySemanticVerdicts(fx.items, parsed, req);
        for (const i of fx.items) { const x = v.get(i.id)!; rows.push({ set: set.label, ext: i.ext, id: i.id, expect: i.expect, got: x.ok ? "keep" : "withhold", reasons: x.reasons }); }
      }
    }
    const by = (s: string) => rows.filter((r) => r.set.startsWith(s));
    const sum = (rs: Admin[]) => ({ items: rs.length, keep_total: rs.filter((r) => r.expect === "keep").length, withhold_total: rs.filter((r) => r.expect === "withhold").length,
      false_accepts: rs.filter((r) => r.expect === "withhold" && r.got === "keep").map((r) => r.ext), false_rejects: rs.filter((r) => r.expect === "keep" && r.got === "withhold").map((r) => `${r.ext}:${r.reasons.join("|")}`),
      malformed_or_unavailable: rs.filter((r) => r.reasons.some((x: string) => ["semantic_malformed", "semantic_unavailable", "semantic_missing", "semantic_duplicate"].includes(x))).map((r) => r.ext) });
    const summary = { ext1_tuned: sum(by("ext-1")), reg_prospective_1: sum(by("reg-")), call_failures: calls.filter((c) => !c.ok).map((c) => `${c.fixture}:${c.failure}`) };
    const { data: ledger } = await admin.from("prompt_spend_ledger").select("reserved_usd,actual_usd,status").eq("job_id", jobId);
    await audit(admin, user.id, "advice_regression_run", "prompt_spend_ledger", null, { job_id: jobId, version: ADVICE_SEMANTIC_VERSION, label: "tuned_regression_not_held_out", summary, rows });
    return json(200, { job_id: jobId, version: ADVICE_SEMANTIC_VERSION, label: "tuned_regression_not_held_out", summary, rows, calls, ledger });
  }

  // External benchmark ext-1: frozen immutably (cases + labels + checker config hash) BEFORE any model call.
  if (action === "advice_benchmark_freeze" || action === "advice_benchmark_run") {
    const B = EXTERNAL_BENCHMARK_1;
    const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const contentHash = await sha(JSON.stringify(B));
    const configHash = await sha(JSON.stringify({ version: ADVICE_SEMANTIC_VERSION, model: SEMANTIC_MODEL, prompts: B.fixtures.map((f) => semanticRequest(f.items, f.parts, f.msgs).system), validator: applySemanticVerdicts.toString(), request: semanticRequest.toString() }));
    if (action === "advice_benchmark_freeze") {
      const { data: existing } = await admin.from("prompt_datasets").select("id,content_hash,cases,created_at").eq("mode", "advice-semantic").eq("name", B.name).maybeSingle();
      if (existing) return json(200, { already_frozen: true, id: existing.id, content_hash: existing.content_hash, config_hash: existing.cases?.config_hash, created_at: existing.created_at, matches: existing.content_hash === contentHash });
      const { data, error } = await admin.from("prompt_datasets").insert({ mode: "advice-semantic", name: B.name, revision: 1, origin: "synthetic", content_hash: contentHash, cases: { benchmark: B, config_hash: configHash, checker_version: ADVICE_SEMANTIC_VERSION, model: SEMANTIC_MODEL, frozen_by: user.id } }).select("id,created_at").single();
      if (error) return json(500, { error: error.message });
      await audit(admin, user.id, "advice_benchmark_freeze", "prompt_datasets", data.id, { content_hash: contentHash, config_hash: configHash });
      return json(200, { id: data.id, created_at: data.created_at, content_hash: contentHash, config_hash: configHash, checker_version: ADVICE_SEMANTIC_VERSION });
    }
    const { data: frozen } = await admin.from("prompt_datasets").select("id,content_hash,cases,created_at").eq("mode", "advice-semantic").eq("name", B.name).maybeSingle();
    if (!frozen || frozen.content_hash !== contentHash) return json(409, { error: "Benchmark not frozen or cases changed." });
    const configMatches = frozen.cases?.config_hash === configHash;
    if (!configMatches && !body.allow_new_config) return json(409, { error: "Checker config differs from the frozen first-pass config; rerun must be reported as a separate version.", frozen_config: frozen.cases?.config_hash, current_config: configHash });
    if (!aiKey) return json(503, { error: "Model key unavailable." });
    const jobId = crypto.randomUUID();
    const rows: Admin[] = [];
    const calls: Admin[] = [];
    for (const fx of B.fixtures) {
      const req = semanticRequest(fx.items, fx.parts, fx.msgs); // labels/notes/ext never serialised
      const r = await meteredCall(deps, { scope: SCOPE, jobId, kind: "judge", timeoutMs: 60_000, body: {
        model: SEMANTIC_MODEL, max_tokens: 1500, temperature: 0, response_format: { type: "json_object" },
        messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }] } as Admin });
      let parsed: unknown = null;
      try { if (r.ok) parsed = extractJsonObject(String(r.data?.choices?.[0]?.message?.content ?? "")).value; } catch { parsed = null; }
      calls.push({ fixture: fx.id, ok: r.ok, failure: r.ok ? null : (r.stage === "budget" ? `budget:${r.reason}` : r.reason), parsed: parsed !== null, raw_verdicts: (parsed as Admin)?.verdicts ?? null });
      const v = applySemanticVerdicts(fx.items, parsed, req);
      for (const i of fx.items) { const x = v.get(i.id)!; rows.push({ ext: i.ext, fixture: fx.id, id: i.id, expect: i.expect, got: x.ok ? "keep" : "withhold", reasons: x.reasons, evidence: x.evidence, behavior_lines: x.behavior_lines }); }
    }
    const summary = {
      items: rows.length,
      true_keep: rows.filter((r) => r.expect === "keep" && r.got === "keep").length,
      true_withhold: rows.filter((r) => r.expect === "withhold" && r.got === "withhold").length,
      false_accepts: rows.filter((r) => r.expect === "withhold" && r.got === "keep").map((r) => r.ext),
      false_rejects: rows.filter((r) => r.expect === "keep" && r.got === "withhold").map((r) => `${r.ext}:${r.reasons.join("|")}`),
      malformed_or_unavailable: rows.filter((r) => r.reasons.some((x: string) => ["semantic_malformed", "semantic_unavailable", "semantic_missing", "semantic_duplicate"].includes(x))).map((r) => r.ext),
      call_failures: calls.filter((c) => !c.ok).map((c) => `${c.fixture}:${c.failure}`),
    };
    const { data: ledger } = await admin.from("prompt_spend_ledger").select("reserved_usd,actual_usd,status").eq("job_id", jobId);
    await audit(admin, user.id, "advice_benchmark_run", "prompt_datasets", frozen.id, { job_id: jobId, first_pass_config: configMatches, config_hash: configHash, version: ADVICE_SEMANTIC_VERSION, summary, rows, calls });
    return json(200, { job_id: jobId, dataset_id: frozen.id, version: ADVICE_SEMANTIC_VERSION, config_matches_frozen: configMatches, config_hash: configHash, summary, rows, calls, ledger });
  }

  if (action === "budget_selftest") {
    // Reservation-only concurrency test on the separate 'selftest' scope. Never calls a model.
    await admin.from("prompt_spend_ledger").delete().eq("scope", "selftest");
    const reserve = (job: string | null, amount: number) => admin.rpc("reserve_prompt_spend", { p_scope: "selftest", p_job: job, p_kind: "selftest", p_model: "fixture", p_in: 1, p_out: 1, p_amount: amount });
    const g = await Promise.all(Array.from({ length: 14 }, () => reserve(null, 0.1)));
    const globalAccepted = g.filter((r: Admin) => r.data?.ok).length;
    await admin.from("prompt_spend_ledger").delete().eq("scope", "selftest");
    const jobId = crypto.randomUUID();
    const j = await Promise.all(Array.from({ length: 8 }, () => reserve(jobId, 0.1)));
    const jobAccepted = j.filter((r: Admin) => r.data?.ok).length;
    const first = j.find((r: Admin) => r.data?.ok)?.data?.id;
    const rc1 = await admin.rpc("reconcile_prompt_spend", { p_id: first, p_actual: null, p_pt: null, p_ct: null, p_outcome: "fixture_missing_cost" });
    const rc2 = await admin.rpc("reconcile_prompt_spend", { p_id: first, p_actual: 0, p_pt: 0, p_ct: 0, p_outcome: "fixture_second_reconcile" });
    const overCall = await reserve(null, 0.31);
    const zero = await reserve(null, 0);
    const status = await admin.rpc("prompt_budget_status", { p_scope: "selftest" });
    await admin.from("prompt_spend_ledger").delete().eq("scope", "selftest");
    const result = {
      global: { attempted: 14, amount_each: 0.1, cap: 1.0, accepted: globalAccepted, expected: 10 },
      per_job: { attempted: 8, amount_each: 0.1, cap: 0.5, accepted: jobAccepted, expected: 5 },
      missing_cost: { first: rc1.data, second_reconcile_ignored: rc2.data, unknown_counted_usd: status.data?.unknown_usd },
      per_call_cap_refused: overCall.data?.reason, zero_amount_refused: zero.data?.reason,
    };
    await audit(admin, user.id, "budget_selftest", "prompt_spend_ledger", null, result);
    return json(200, result);
  }

  if (action === "stage_selftest") {
    // Truly concurrent, no-model test of the 10-arg stage reservation RPC. Every
    // reserve is a separate HTTP request (its own PostgREST transaction), fired together.
    const F = "selftest-fixture";
    const mkRun = async (maxCalls: number) => {
      const { data, error } = await admin.from("prompt_test_runs").insert({ secret_hash: `selftest-${crypto.randomUUID()}`, target_user_id: user.id, operator_id: user.id,
        function_name: "analyze-conversation", mode: "selftest", variant: "baseline", purpose: "stage_selftest_fixture", max_calls: maxCalls, expires_at: new Date(Date.now() + 600_000).toISOString() }).select("id").single();
      if (error) throw new Error(error.message);
      await admin.from("prompt_test_run_claims").insert({ run_id: data.id, function_name: F, seq: 1 });
      return data.id as string;
    };
    const R = (job: string, stage: string, kind = "generation", retryOf: string | null = null, fn = F) =>
      admin.rpc("reserve_prompt_spend", { p_scope: "selftest", p_job: job, p_kind: kind, p_model: "fixture", p_in: 1, p_out: 1, p_amount: 0.001, p_stage: stage, p_function: fn, p_retry_of: retryOf });
    const count = async (job: string, stage?: string) => { let q = admin.from("prompt_spend_ledger").select("id", { count: "exact", head: true }).eq("job_id", job); if (stage) q = q.eq("stage", stage); return (await q).count ?? 0; };
    const tally = (rs: Admin[]) => { const t: Record<string, number> = {}; for (const r of rs) { const k = r.data?.ok ? "ok" : (r.data?.reason ?? r.error?.message ?? "error"); t[k] = (t[k] ?? 0) + 1; } return t; };
    await admin.from("prompt_spend_ledger").delete().eq("scope", "selftest");
    const runs: string[] = [];
    try {
      // 1) One slot left, 10 simultaneous requests.
      const a = await mkRun(3); runs.push(a);
      await R(a, "beta"); await R(a, "beta");
      const one = await Promise.all(Array.from({ length: 10 }, () => R(a, "beta")));
      const oneSlot = { attempted: 10, results: tally(one), ledger_rows: await count(a), cap: 3 };
      // 2) Per-stage ceiling (alpha = 2) with a large run ceiling.
      const b = await mkRun(40); runs.push(b);
      const st = await Promise.all(Array.from({ length: 12 }, () => R(b, "alpha")));
      const stage = { attempted: 12, results: tally(st), alpha_rows: await count(b, "alpha"), stage_cap: 2 };
      // 3) Total run ceiling across stages, mixed concurrent requests.
      const c = await mkRun(5); runs.push(c);
      const tot = await Promise.all([...Array.from({ length: 8 }, () => R(c, "beta")), ...Array.from({ length: 4 }, () => R(c, "alpha"))]);
      const total = { attempted: 12, results: tally(tot), ledger_rows: await count(c), run_cap: 5, alpha_rows: await count(c, "alpha") };
      // 4) Retry/function binding.
      const d = await mkRun(20); runs.push(d);
      const base = (await R(d, "beta")).data?.id;
      const other = await mkRun(20); runs.push(other);
      const otherId = (await R(other, "beta")).data?.id;
      const binding = {
        good_retry: (await R(d, "beta", "retry", base)).data?.ok === true,
        retry_wrong_stage: (await R(d, "alpha", "retry", base)).data?.reason,
        retry_other_run: (await R(d, "beta", "retry", otherId)).data?.reason,
        retry_missing_link: (await R(d, "beta", "retry", null)).data?.reason,
        generation_with_link: (await R(d, "beta", "generation", base)).data?.reason,
        unclaimed_function: (await R(d, "primary", "generation", null, "decode-conversation")).data?.reason,
        unplanned_stage: (await R(d, "not_a_stage")).data?.reason,
        ledger_rows: await count(d),
      };
      // 5) Unrelated jobs are independent under simultaneous load.
      const e1 = await mkRun(2); const e2 = await mkRun(2); runs.push(e1, e2);
      const ind = await Promise.all([...Array.from({ length: 6 }, () => R(e1, "beta")), ...Array.from({ length: 6 }, () => R(e2, "beta"))]);
      const independent = { attempted: 12, results: tally(ind), e1_rows: await count(e1), e2_rows: await count(e2), cap_each: 2 };
      const invariants = {
        one_slot_exactly_one_accepted: oneSlot.results.ok === 1 && oneSlot.ledger_rows === 3,
        stage_cap_held: stage.alpha_rows === 2 && stage.results.ok === 2,
        run_cap_held: total.ledger_rows === 5 && total.alpha_rows <= 2,
        rejected_left_no_rows: oneSlot.ledger_rows === 3 && stage.alpha_rows === 2 && total.ledger_rows === 5,
        binding_held: binding.good_retry && binding.ledger_rows === 2,
        jobs_independent: independent.e1_rows === 2 && independent.e2_rows === 2,
      };
      const result = { one_slot: oneSlot, stage, total, binding, independent, invariants, all_pass: Object.values(invariants).every(Boolean) };
      await audit(admin, user.id, "stage_selftest", "prompt_spend_ledger", null, result);
      return json(200, result);
    } catch (e) {
      return json(500, { error: String((e as Error)?.message ?? e) });
    } finally {
      await admin.from("prompt_spend_ledger").delete().eq("scope", "selftest");
      if (runs.length) { await admin.from("prompt_test_run_claims").delete().in("run_id", runs); await admin.from("prompt_test_runs").delete().in("id", runs); }
    }
  }

  return json(400, { error: "Unknown action." });
});
