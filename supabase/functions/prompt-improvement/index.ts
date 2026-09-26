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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SCOPE = "improvement";
const DATASET_REVISION = 1;
const JUDGE_MODEL = "openai/gpt-6-astra";
const JUDGE_MAX_TOKENS = 800;
const PROPOSAL_MAX_TOKENS = 700;
const CALL_TIMEOUT_MS = 150_000;
const ABANDON_MINUTES = 20;
const MAX_JOBS_PER_DAY = 12;
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
    const { data: fb, error: fbErr } = await admin.from("ai_feedback").select("source_kind,target_kind,rating,reason_codes,prompt_version").gte("updated_at", since).eq("product_improvement_consent", true).limit(5000);
    if (fbErr) return json(500, { error: "Could not read feedback aggregate." });
    const buckets = new Map<string, Admin>();
    for (const r of fb ?? []) {
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
    const items = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
    if (!items.length || !body.title) return json(400, { error: "title and items required" });
    for (const it of items) {
      if (!UUID_RE.test(String(it.job_id ?? ""))) return json(400, { error: "each item needs a job_id" });
      const { data: j } = await admin.from("prompt_eval_jobs").select("id,mode,binding_hash").eq("id", it.job_id).maybeSingle();
      if (!j) return json(404, { error: `job ${it.job_id} not found` });
      it.mode = j.mode; it.binding_hash = j.binding_hash; it.highlight = String(it.highlight ?? "").slice(0, 400);
    }
    const { data, error } = await admin.from("prompt_review_packets").insert({ title: String(body.title).slice(0, 160), items, created_by: user.id }).select("id").single();
    if (error) return json(500, { error: "Could not save packet." });
    await audit(admin, user.id, "review_packet_created", "prompt_review_packets", data.id, { items: items.length });
    return json(200, { packet_id: data.id });
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

  return json(400, { error: "Unknown action." });
});
