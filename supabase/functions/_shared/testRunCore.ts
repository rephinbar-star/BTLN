// Request-scoped metering for server-issued synthetic test runs.
//
// A live pipeline function (Deep Read, Quick Take, Group Read, ...) runs its
// handler inside a context when the caller presents a valid, server-issued
// test-run token (see testRun.ts). While that context is active, EVERY model
// call made through callOpenRouter — extraction, digests, the primary call,
// attribution, style rewrite, synthesis, retries — is routed through
// meteredCall: its maximum cost is reserved in the database before the
// provider is called, and reconciled afterwards (unknown cost stays reserved).
//
// Synthetic test accounts calling without a token get a "blocked" context:
// their model calls are refused, so no test can run unmetered through the
// customer path. Customer requests (no token, not a test account) are untouched.
//
// Node/Deno neutral (no Deno or npm: imports) so it can be unit tested.

import { AsyncLocalStorage } from "node:async_hooks";
import { meteredCall, type BudgetDeps, type ProviderResult } from "./promptBudget.ts";
import { candidateSystem, sha256 } from "./modeEval.ts";

export type Candidate = { mode: string; addendum: string; baselineTextHash: string } | null;

export type StageCall = { stage: string; kind: "generation" | "retry"; ok: boolean; reason?: string; reservationId?: string; reserved?: number; cost?: number | null };

export type MeteredCtx = {
  kind: "metered";
  runId: string;
  /** Server-side function name (from the wrapper, never the client). */
  fn: string;
  scope: string;
  deps: BudgetDeps;
  stage: string;
  maxCalls: number;
  candidate: Candidate;
  timeoutMs: number;
  shared: { calls: StageCall[]; seen: Map<string, number>; candidateUsed: string[] };
};
export type BlockedCtx = { kind: "blocked"; reason: string };
export type TestCtx = MeteredCtx | BlockedCtx;

export const testRunStore = new AsyncLocalStorage<TestCtx>();
export const currentTestRun = (): TestCtx | undefined => testRunStore.getStore();

/** Runs fn with a stage label; counters are shared with the parent run. */
export const inStage = <T>(stage: string, fn: () => Promise<T>): Promise<T> => {
  const ctx = testRunStore.getStore();
  if (!ctx || ctx.kind !== "metered") return fn();
  return testRunStore.run({ ...ctx, stage }, fn);
};

/** Output bound injected only when a pipeline body has none (test runs only). */
export const defaultMaxOut = (model: string) => (model.startsWith("anthropic/") ? 8000 : 4000);

/**
 * Metered replacement for the provider call. Keeps callOpenRouter's
 * semantics (one retry after a 5xx), but each attempt is its own reservation;
 * the retry is linked (retry_of) to the reservation it repeats.
 */
export const meteredOpenRouter = async (ctx: TestCtx, body: Record<string, unknown>): Promise<ProviderResult> => {
  if (ctx.kind === "blocked") return { ok: false, status: 403, errorText: ctx.reason };
  const model = String(body.model ?? "");
  const b = { ...body, model, max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : defaultMaxOut(model), messages: (body.messages ?? []) as { content: unknown }[] };
  let last: ProviderResult = { ok: false, status: 500, errorText: "not_run" };
  let prevId: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (ctx.shared.calls.length >= ctx.maxCalls) {
      ctx.shared.calls.push({ stage: ctx.stage, kind: "generation", ok: false, reason: "run_call_limit" });
      return { ok: false, status: 429, errorText: "run_call_limit" };
    }
    const n = ctx.shared.seen.get(ctx.stage) ?? 0;
    ctx.shared.seen.set(ctx.stage, n + 1);
    // Only the transport retry after a 5xx is a "retry", linked to the exact
    // reservation it repeats. Repeated or concurrent calls in one stage (digest
    // chunks, a pipeline's own JSON retry) are separate generation reservations.
    const kind = attempt === 0 ? "generation" : "retry";
    // Stage, function, call count and dollars are reserved in one atomic RPC.
    // deno-lint-ignore no-explicit-any
    const r: any = await meteredCall(ctx.deps, { scope: ctx.scope, jobId: ctx.runId, kind, stage: ctx.stage, fn: ctx.fn, retryOf: kind === "retry" ? prevId : null, body: b, timeoutMs: ctx.timeoutMs });
    if (r.reservationId) prevId = r.reservationId;
    if (!r.ok && r.stage === "budget") {
      ctx.shared.calls.push({ stage: ctx.stage, kind, ok: false, reason: `budget:${r.reason}` });
      return { ok: false, status: 429, errorText: `budget:${r.reason}` };
    }
    if (r.ok) {
      ctx.shared.calls.push({ stage: ctx.stage, kind, ok: true, reservationId: r.reservationId, reserved: r.reserved, cost: r.usage.cost });
      return { ok: true, status: 200, data: r.data };
    }
    ctx.shared.calls.push({ stage: ctx.stage, kind, ok: false, reason: r.reason, reservationId: r.reservationId, reserved: r.reserved });
    last = { ok: false, status: r.status ?? 502, errorText: r.reason };
    if (!(r.status && r.status >= 500)) return last;
  }
  return last;
};

/**
 * System prompt for a mode inside a test run. A candidate addendum applies
 * only to its own mode and only when the live baseline text is exactly the
 * text it was evaluated against; otherwise the run fails closed.
 * Outside a test run the production text is returned unchanged.
 */
export const systemFor = async (mode: string, baseText: string, hashBasis: string = baseText): Promise<string> => {
  const ctx = testRunStore.getStore();
  if (!ctx || ctx.kind !== "metered" || !ctx.candidate || ctx.candidate.mode !== mode) return baseText;
  // hashBasis: the template the candidate was evaluated against, when the live
  // text is rendered with per-request values (Relationship360 counts).
  if ((await sha256(hashBasis)) !== ctx.candidate.baselineTextHash) throw new Error("candidate_baseline_mismatch");
  ctx.shared.candidateUsed.push(mode);
  return candidateSystem(baseText, ctx.candidate.addendum);
};

/** Labels subsequent calls in the current (sequential) pipeline step. No-op outside a test run. */
export const markStage = (stage: string) => {
  const ctx = testRunStore.getStore();
  if (ctx && ctx.kind === "metered") ctx.stage = stage;
};
