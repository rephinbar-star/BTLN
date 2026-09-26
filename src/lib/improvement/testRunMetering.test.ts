import { describe, expect, it, vi } from "vitest";
import type { BudgetDeps, ProviderResult, Reservation } from "../../../supabase/functions/_shared/promptBudget.ts";
import {
  inStage, markStage, meteredOpenRouter, systemFor, testRunStore, type MeteredCtx,
} from "../../../supabase/functions/_shared/testRunCore.ts";
import { candidateSystem, sha256 } from "../../../supabase/functions/_shared/modeEval.ts";

const PLAN: Record<string, string[]> = { "analyze-conversation": ["digest", "primary", "extraction", "attribution", "style_rewrite", "unlabelled"], "decode-conversation": ["primary"] };
// Mirrors reserve_prompt_spend (10-arg): stage/function/retry/count/dollars checked and written in one serialized step.
const ledger = (cfg: { global: number; perJob: number; perCall: number; maxCalls?: number; claimed?: string[] }) => {
  const rows: { id: string; job: string | null; reserved: number; actual: number | null; status: string; stage?: string; fn?: string; retryOf?: string | null }[] = [];
  let lock = Promise.resolve();
  const committed = (job?: string) => rows.filter((r) => job === undefined || r.job === job).reduce((n, r) => n + (r.status === "reconciled" ? (r.actual ?? 0) : r.reserved), 0);
  const deps: Pick<BudgetDeps, "reserve" | "reconcile"> = {
    reserve: (a) => {
      const run = lock.then(async (): Promise<Reservation> => {
        await new Promise((r) => setTimeout(r, 1));
        if (a.amount > cfg.perCall) return { ok: false, reason: "per_call_cap" };
        if (!a.fn || !(cfg.claimed ?? ["analyze-conversation"]).includes(a.fn)) return { ok: false, reason: "function_not_claimed" };
        if (!a.stage || !(PLAN[a.fn] ?? []).includes(a.stage)) return { ok: false, reason: "unplanned_stage" };
        if (a.kind === "retry") { const p = rows.find((x) => x.id === a.retryOf); if (!p || p.stage !== a.stage || p.fn !== a.fn) return { ok: false, reason: "retry_link_invalid" }; }
        else if (a.retryOf) return { ok: false, reason: "retry_link_invalid" };
        if (rows.filter((r) => r.job === a.jobId).length >= (cfg.maxCalls ?? 99)) return { ok: false, reason: "run_call_limit" };
        if (committed() + a.amount > cfg.global + 1e-9) return { ok: false, reason: "global_cap" };
        if (a.jobId && committed(a.jobId) + a.amount > cfg.perJob + 1e-9) return { ok: false, reason: "per_job_cap" };
        const id = `r${rows.length + 1}`;
        rows.push({ id, job: a.jobId, reserved: a.amount, actual: null, status: "reserved", stage: a.stage, fn: a.fn, retryOf: a.retryOf ?? null });
        return { ok: true, id };
      });
      lock = run.then(() => undefined);
      return run;
    },
    reconcile: async (a) => {
      const r = rows.find((x) => x.id === a.id);
      if (!r || r.status !== "reserved") return;
      r.actual = a.actual; r.status = a.actual === null ? "unknown" : "reconciled";
    },
  };
  return { deps, rows, committed };
};

const ok = (cost: number | null): ProviderResult => ({ ok: true, status: 200, data: { choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 5, completion_tokens: 5, ...(cost === null ? {} : { cost }) } } });

const ctxWith = (provider: BudgetDeps["provider"], l = ledger({ global: 15, perJob: 3.5, perCall: 0.6 }), over: Partial<MeteredCtx> = {}): MeteredCtx => ({
  kind: "metered", runId: "run-1", fn: "analyze-conversation", scope: "improvement", deps: { ...l.deps, provider }, stage: "unlabelled", maxCalls: 12, candidate: null, timeoutMs: 1000,
  shared: { calls: [], seen: new Map(), candidateUsed: [] }, ...over,
});
const body = (model = "anthropic/claude-sonnet-4.6", max_tokens?: number) => ({ model, ...(max_tokens ? { max_tokens } : {}), messages: [{ role: "user", content: "hi" }] });

describe("metered test runs", () => {
  it("reserves before calling and records the stage", async () => {
    const l = ledger({ global: 15, perJob: 3.5, perCall: 0.6 });
    const provider = vi.fn(async () => { expect(l.rows).toHaveLength(1); return ok(0.01); });
    const ctx = ctxWith(provider, l);
    await testRunStore.run(ctx, async () => { markStage("extraction"); expect((await meteredOpenRouter(ctx, body())).ok).toBe(true); });
    expect(ctx.shared.calls[0]).toMatchObject({ stage: "extraction", kind: "generation", ok: true });
    expect(l.rows[0].status).toBe("reconciled");
  });

  it("injects a bounded output limit when the pipeline body has none", async () => {
    let seen: Record<string, unknown> = {};
    const ctx = ctxWith(async (b) => { seen = b; return ok(0.01); });
    await meteredOpenRouter(ctx, body());
    expect(seen.max_tokens).toBe(8000);
  });

  it("refuses unknown pricing without calling the provider", async () => {
    const provider = vi.fn(async () => ok(0.01));
    const ctx = ctxWith(provider);
    const r = await meteredOpenRouter(ctx, body("some/unpriced-model", 100));
    expect(r.ok).toBe(false);
    expect(provider).not.toHaveBeenCalled();
  });

  it("stops at the per-call cap (Astra with a large default bound)", async () => {
    const provider = vi.fn(async () => ok(0.01));
    const r = await meteredOpenRouter(ctxWith(provider), body("openai/gpt-6-astra", 8000));
    expect(r.errorText).toBe("budget:per_call_cap");
    expect(provider).not.toHaveBeenCalled();
  });

  it("concurrent stages cannot overspend the per-run cap", async () => {
    const l = ledger({ global: 15, perJob: 1.0, perCall: 0.6 });
    const ctx = ctxWith(async () => ok(null), l, { maxCalls: 40 });
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => inStage(`digest`, () => meteredOpenRouter(ctx, body("anthropic/claude-sonnet-4.6", 12000 + i)))));
    expect(l.committed("run-1")).toBeLessThanOrEqual(1.0 + 1e-9);
    expect(results.some((r) => r.errorText === "budget:per_job_cap")).toBe(true);
  });

  it("5xx retry is a separate, linked reservation; a repeated stage call is its own generation", async () => {
    const l = ledger({ global: 15, perJob: 3.5, perCall: 0.6 });
    const provider = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue(ok(0.02));
    const ctx = ctxWith(provider, l);
    await testRunStore.run(ctx, async () => { markStage("primary"); await meteredOpenRouter(ctx, body()); await meteredOpenRouter(ctx, body()); });
    expect(ctx.shared.calls.map((c) => c.kind)).toEqual(["generation", "retry", "generation"]);
    expect(l.rows).toHaveLength(3);
    expect(l.rows[1].retryOf).toBe(l.rows[0].id); // retry linked to the exact call it repeats
    expect(l.rows[2].retryOf).toBeNull();
    expect(l.rows.every((r) => r.stage === "primary" && r.fn === "analyze-conversation")).toBe(true);
  });

  it("a timeout aborts the fetch and keeps the full reservation as unknown", async () => {
    const l = ledger({ global: 15, perJob: 3.5, perCall: 0.6 });
    let aborted = false;
    const provider = (_b: unknown, signal: AbortSignal) => new Promise<ProviderResult>((_r, rej) => { signal.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); }); });
    const ctx = ctxWith(provider, l, { timeoutMs: 20 });
    const r = await meteredOpenRouter(ctx, body());
    expect(aborted).toBe(true);
    expect(r.ok).toBe(false);
    expect(l.rows[0].status).toBe("unknown");
    expect(l.committed()).toBeGreaterThan(0);
  });

  it("enforces the run's call limit", async () => {
    const ctx = ctxWith(async () => ok(0.001), undefined, { maxCalls: 2 });
    await meteredOpenRouter(ctx, body()); await meteredOpenRouter(ctx, body());
    expect((await meteredOpenRouter(ctx, body())).errorText).toBe("run_call_limit");
  });

  it("synthetic accounts without a run are refused, never unmetered", async () => {
    const r = await meteredOpenRouter({ kind: "blocked", reason: "synthetic_account_requires_metered_test_run" }, body());
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("candidate addendum applies only to its mode and exact baseline text", async () => {
    const base = "BASE PROMPT";
    const ctx = ctxWith(async () => ok(0), undefined, { candidate: { mode: "quick_take", addendum: "Be brief.", baselineTextHash: await sha256(base) } });
    await testRunStore.run(ctx, async () => {
      expect(await systemFor("quick_take", base)).toBe(candidateSystem(base, "Be brief."));
      expect(await systemFor("group_read", base)).toBe(base);
      await expect(systemFor("quick_take", "DIFFERENT")).rejects.toThrow("candidate_baseline_mismatch");
    });
    expect(await systemFor("quick_take", base)).toBe(base); // outside a run: production text
  });

  it("every reservation row is born with its stage and function (no later labelling step)", async () => {
    const l = ledger({ global: 15, perJob: 3.5, perCall: 0.6 });
    let seenAtCall: unknown;
    const ctx = ctxWith(async () => { seenAtCall = { ...l.rows[0] }; throw new Error("crash"); }, l);
    await testRunStore.run(ctx, async () => { markStage("attribution"); await meteredOpenRouter(ctx, body()); });
    expect(seenAtCall).toMatchObject({ stage: "attribution", fn: "analyze-conversation", status: "reserved" });
    expect(l.rows[0].status).toBe("unknown"); // crash after reserve: full reservation retained, still labelled
  });

  it("unplanned stages and unclaimed or cross-function calls are refused before any provider call", async () => {
    const provider = vi.fn(async () => ok(0.01));
    const a = ctxWith(provider, ledger({ global: 15, perJob: 3.5, perCall: 0.6 }));
    await testRunStore.run(a, async () => { markStage("free_bonus_stage"); expect((await meteredOpenRouter(a, body())).errorText).toBe("budget:unplanned_stage"); });
    const b = ctxWith(provider, ledger({ global: 15, perJob: 3.5, perCall: 0.6 }), { fn: "decode-conversation" });
    await testRunStore.run(b, async () => { markStage("primary"); expect((await meteredOpenRouter(b, body())).errorText).toBe("budget:function_not_claimed"); });
    const c = ctxWith(provider, ledger({ global: 15, perJob: 3.5, perCall: 0.6, claimed: ["analyze-conversation", "decode-conversation"] }), { fn: "decode-conversation" });
    await testRunStore.run(c, async () => { markStage("attribution"); expect((await meteredOpenRouter(c, body())).errorText).toBe("budget:unplanned_stage"); });
    expect(provider).not.toHaveBeenCalled();
  });

  it("concurrent requests sharing one run cannot exceed the server-side call count", async () => {
    const l = ledger({ global: 15, perJob: 3.5, perCall: 0.6, maxCalls: 3 });
    // Two separate requests (separate in-memory counters) share the same run: only the DB count is authoritative.
    const mk = () => ctxWith(async () => ok(0.001), l, { maxCalls: 99, shared: { calls: [], seen: new Map(), candidateUsed: [] } });
    const [x, y] = [mk(), mk()];
    const res = await Promise.all([...Array(4)].flatMap(() => [inStage("digest", () => meteredOpenRouter(x, body())), inStage("digest", () => meteredOpenRouter(y, body()))]));
    expect(l.rows).toHaveLength(3);
    expect(res.filter((r) => r.errorText === "budget:run_call_limit")).toHaveLength(5);
  });
});
