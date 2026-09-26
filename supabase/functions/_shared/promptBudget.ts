// Hard spending control for the operator improvement workflow.
//
// Every model call this workflow makes goes through `meteredCall`:
//   1. Estimate a conservative MAXIMUM cost from bounded input and output
//      tokens and an explicit per-model rate. Unknown model => refused.
//   2. Reserve that amount atomically in the database BEFORE calling the
//      provider (reserve_prompt_spend locks the scope row, so concurrent
//      requests and retries cannot overspend the shared cap).
//   3. Call the provider once, with a real AbortController on the fetch.
//   4. Reconcile with the provider-reported cost. A missing cost, a timeout,
//      an abort or a network failure is reconciled as UNKNOWN, which keeps the
//      full reservation counted. Nothing is ever recorded as zero by default.
// Retries are separate metered calls with their own reservation.
// These are internal operator test limits, not customer allowances.

/** USD per 1M tokens. Deliberately above list prices; an upper bound, not a bill. */
export const MODEL_RATES: Record<string, { input: number; output: number; basis: string }> = {
  "openai/gpt-6-astra": { input: 20, output: 100, basis: "conservative bound above observed OpenRouter cost (~$25/M blended on 2026-09-26 runs)" },
  "anthropic/claude-sonnet-4.6": { input: 6, output: 30, basis: "2x published list price" },
  "google/gemini-3-flash-preview": { input: 1, output: 6, basis: "2x published list price" },
};

/** Conservative token estimate: ~3 characters per token plus framing overhead. */
export const estimateInputTokens = (messages: { content: unknown }[]) =>
  Math.ceil(messages.reduce((n, m) => n + String(typeof m.content === "string" ? m.content : JSON.stringify(m.content)).length, 0) / 3) + 64 * messages.length + 64;

export const maxCostUsd = (model: string, inputTokens: number, outputTokens: number): number | null => {
  const r = MODEL_RATES[model];
  if (!r || !Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || outputTokens <= 0) return null;
  return Math.ceil(((inputTokens * r.input + outputTokens * r.output) / 1_000_000) * 1e6) / 1e6;
};

export type SpendKind = "generation" | "retry" | "judge" | "proposal" | "sandbox" | "selftest";
export type Reservation = { ok: true; id: string } | { ok: false; reason: string; detail?: unknown };
export type ProviderResult = { ok: boolean; status: number; data?: any; errorText?: string };

export type BudgetDeps = {
  reserve: (a: { scope: string; jobId: string | null; kind: SpendKind; model: string; inTok: number; outTok: number; amount: number }) => Promise<Reservation>;
  reconcile: (a: { id: string; actual: number | null; pt: number | null; ct: number | null; outcome: string }) => Promise<void>;
  provider: (body: Record<string, unknown>, signal: AbortSignal) => Promise<ProviderResult>;
};

export type MeteredResult =
  | { ok: true; data: any; usage: { prompt_tokens: number | null; completion_tokens: number | null; cost: number | null }; reservationId: string; reserved: number }
  | { ok: false; stage: "budget"; reason: string; detail?: unknown }
  | { ok: false; stage: "provider"; reason: string; status?: number; reservationId: string; reserved: number };

export const meteredCall = async (
  deps: BudgetDeps,
  opts: { scope: string; jobId: string | null; kind: SpendKind; body: Record<string, unknown> & { model: string; max_tokens: number; messages: { content: unknown }[] }; timeoutMs: number },
): Promise<MeteredResult> => {
  const { body } = opts;
  const inTok = estimateInputTokens(body.messages);
  const amount = maxCostUsd(body.model, inTok, body.max_tokens);
  if (amount === null) return { ok: false, stage: "budget", reason: "unknown_pricing" };
  const res = await deps.reserve({ scope: opts.scope, jobId: opts.jobId, kind: opts.kind, model: body.model, inTok, outTok: body.max_tokens, amount });
  if (res.ok === false) return { ok: false, stage: "budget", reason: res.reason, detail: res.detail };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), opts.timeoutMs);
  let result: ProviderResult;
  try {
    result = await deps.provider(body, ctrl.signal);
  } catch (e) {
    clearTimeout(timer);
    const reason = ctrl.signal.aborted ? "timeout" : "network_error";
    // The provider may still have billed: keep the whole reservation (unknown).
    await deps.reconcile({ id: res.id, actual: null, pt: null, ct: null, outcome: reason });
    return { ok: false, stage: "provider", reason, reservationId: res.id, reserved: amount };
  }
  clearTimeout(timer);
  const u = result.data?.usage ?? null;
  const cost = typeof u?.cost === "number" && Number.isFinite(u.cost) && u.cost >= 0 ? u.cost : null;
  const pt = typeof u?.prompt_tokens === "number" ? u.prompt_tokens : null;
  const ct = typeof u?.completion_tokens === "number" ? u.completion_tokens : null;
  await deps.reconcile({ id: res.id, actual: cost, pt, ct, outcome: result.ok ? (cost === null ? "ok_cost_missing" : "ok") : `http_${result.status}` });
  if (!result.ok) return { ok: false, stage: "provider", reason: `http_${result.status}`, status: result.status, reservationId: res.id, reserved: amount };
  return { ok: true, data: result.data, usage: { prompt_tokens: pt, completion_tokens: ct, cost }, reservationId: res.id, reserved: amount };
};

/** Single-attempt OpenRouter fetch that honours the abort signal (no hidden internal retry). */
export const openRouterProvider = (apiKey: string, title: string) =>
  async (body: Record<string, unknown>, signal: AbortSignal): Promise<ProviderResult> => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://betweenthelines.app", "X-Title": title, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, usage: { include: true } }),
    });
    if (!res.ok) return { ok: false, status: res.status, errorText: (await res.text()).slice(0, 300) };
    return { ok: true, status: res.status, data: await res.json() };
  };

/** Database-backed reservation using the service-role client. */
// deno-lint-ignore no-explicit-any
export const dbBudget = (admin: any): Pick<BudgetDeps, "reserve" | "reconcile"> => ({
  reserve: async (a) => {
    const { data, error } = await admin.rpc("reserve_prompt_spend", {
      p_scope: a.scope, p_job: a.jobId, p_kind: a.kind, p_model: a.model, p_in: a.inTok, p_out: a.outTok, p_amount: a.amount,
    });
    if (error || !data) return { ok: false, reason: "reservation_error" };
    return data.ok ? { ok: true, id: String(data.id) } : { ok: false, reason: String(data.reason), detail: data };
  },
  reconcile: async (a) => {
    await admin.rpc("reconcile_prompt_spend", { p_id: a.id, p_actual: a.actual, p_pt: a.pt, p_ct: a.ct, p_outcome: a.outcome });
  },
});
