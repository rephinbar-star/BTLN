import { describe, expect, it, vi } from "vitest";
import {
  maxCostUsd, meteredCall, type BudgetDeps, type ProviderResult, type Reservation,
} from "../../../supabase/functions/_shared/promptBudget.ts";

/** In-memory ledger mirroring reserve_prompt_spend: committed = reconciled actual, else full reservation. */
const ledger = (cfg: { global: number; perJob: number; perCall: number }) => {
  const rows: { id: string; job: string | null; reserved: number; actual: number | null; status: "reserved" | "reconciled" | "unknown" }[] = [];
  let lock = Promise.resolve();
  const committed = (job?: string | null) => rows.filter((r) => job === undefined || r.job === job)
    .reduce((n, r) => n + (r.status === "reconciled" ? (r.actual ?? 0) : r.reserved), 0);
  const deps: Pick<BudgetDeps, "reserve" | "reconcile"> = {
    reserve: (a) => {
      // Serialised like the row lock in SQL; an await inside proves interleaving cannot overspend.
      const run = lock.then(async (): Promise<Reservation> => {
        await new Promise((r) => setTimeout(r, 1));
        if (!(a.amount > 0)) return { ok: false, reason: "unknown_pricing" };
        if (a.amount > cfg.perCall) return { ok: false, reason: "per_call_cap" };
        if (committed() + a.amount > cfg.global + 1e-9) return { ok: false, reason: "global_cap" };
        if (a.jobId && committed(a.jobId) + a.amount > cfg.perJob + 1e-9) return { ok: false, reason: "per_job_cap" };
        const id = `r${rows.length + 1}`;
        rows.push({ id, job: a.jobId, reserved: a.amount, actual: null, status: "reserved" });
        return { ok: true, id };
      });
      lock = run.then(() => undefined);
      return run;
    },
    reconcile: async (a) => {
      const r = rows.find((x) => x.id === a.id);
      if (!r || r.status !== "reserved") return; // idempotent
      r.actual = a.actual;
      r.status = a.actual === null ? "unknown" : "reconciled";
    },
  };
  return { deps, rows, committed };
};

const okProvider = (cost: number | null) => vi.fn(async (): Promise<ProviderResult> => ({
  ok: true, status: 200, data: { choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 10, completion_tokens: 10, ...(cost === null ? {} : { cost }) } },
}));
const body = (model = "anthropic/claude-sonnet-4.6", max_tokens = 1000) => ({ model, max_tokens, messages: [{ role: "user", content: "x".repeat(300) }] });
const reservedFor = (b: ReturnType<typeof body>) => maxCostUsd(b.model, Math.ceil(300 / 3) + 64 + 64, b.max_tokens)!;

describe("hard spending control (deterministic fake provider)", () => {
  it("refuses unknown model pricing before any provider call", async () => {
    const l = ledger({ global: 10, perJob: 10, perCall: 10 });
    const provider = okProvider(0.01);
    const r = await meteredCall({ ...l.deps, provider }, { scope: "t", jobId: null, kind: "generation", body: body("mystery/model"), timeoutMs: 1000 });
    expect(r).toMatchObject({ ok: false, stage: "budget", reason: "unknown_pricing" });
    expect(provider).not.toHaveBeenCalled();
    expect(l.rows).toHaveLength(0);
  });

  it("allows a call that lands exactly on the cap and refuses the next cent", async () => {
    const b = body();
    const each = reservedFor(b);
    const l = ledger({ global: each * 2, perJob: 100, perCall: 100 });
    const provider = vi.fn(async (): Promise<ProviderResult> => ({ ok: true, status: 200, data: { usage: { cost: each } } }));
    const deps = { ...l.deps, provider };
    expect((await meteredCall(deps, { scope: "t", jobId: null, kind: "generation", body: b, timeoutMs: 1000 })).ok).toBe(true);
    expect((await meteredCall(deps, { scope: "t", jobId: null, kind: "generation", body: b, timeoutMs: 1000 })).ok).toBe(true);
    const third = await meteredCall(deps, { scope: "t", jobId: null, kind: "generation", body: b, timeoutMs: 1000 });
    expect(third).toMatchObject({ ok: false, reason: "global_cap" });
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("concurrent calls cannot overspend the shared reservation", async () => {
    const b = body();
    const each = reservedFor(b);
    const l = ledger({ global: each * 5 + each / 2, perJob: 100, perCall: 100 });
    const provider = vi.fn(async (): Promise<ProviderResult> => { await new Promise((r) => setTimeout(r, 5)); return { ok: true, status: 200, data: { usage: { cost: each } } }; });
    const results = await Promise.all(Array.from({ length: 12 }, () => meteredCall({ ...l.deps, provider }, { scope: "t", jobId: null, kind: "generation", body: b, timeoutMs: 1000 })));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(provider).toHaveBeenCalledTimes(5);
    expect(l.committed()).toBeLessThanOrEqual(each * 5.5);
  });

  it("retries reserve separately and hit the per-job cap", async () => {
    const b = body();
    const each = reservedFor(b);
    const l = ledger({ global: 100, perJob: each * 2, perCall: 100 });
    const provider = vi.fn(async (): Promise<ProviderResult> => ({ ok: false, status: 503, errorText: "down" }));
    const deps = { ...l.deps, provider };
    const first = await meteredCall(deps, { scope: "t", jobId: "job1", kind: "generation", body: b, timeoutMs: 1000 });
    const retry = await meteredCall(deps, { scope: "t", jobId: "job1", kind: "retry", body: b, timeoutMs: 1000 });
    const again = await meteredCall(deps, { scope: "t", jobId: "job1", kind: "retry", body: b, timeoutMs: 1000 });
    expect(first).toMatchObject({ ok: false, stage: "provider" });
    expect(retry).toMatchObject({ ok: false, stage: "provider" });
    expect(again).toMatchObject({ ok: false, stage: "budget", reason: "per_job_cap" });
    // Failed calls without a reported cost stay counted at the full reservation.
    expect(l.rows.every((r) => r.status === "unknown")).toBe(true);
    expect(l.committed("job1")).toBeCloseTo(each * 2, 6);
  });

  it("a timeout aborts the provider fetch and keeps the reservation counted", async () => {
    const l = ledger({ global: 100, perJob: 100, perCall: 100 });
    let aborted = false;
    const provider = vi.fn((_b: Record<string, unknown>, signal: AbortSignal) => new Promise<ProviderResult>((_, rej) => {
      signal.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); });
    }));
    const r = await meteredCall({ ...l.deps, provider }, { scope: "t", jobId: null, kind: "judge", body: body(), timeoutMs: 20 });
    expect(r).toMatchObject({ ok: false, stage: "provider", reason: "timeout" });
    expect(aborted).toBe(true);
    expect(l.rows[0].status).toBe("unknown");
    expect(l.committed()).toBeCloseTo(l.rows[0].reserved, 6);
  });

  it("missing provider cost is unknown, never zero", async () => {
    const l = ledger({ global: 100, perJob: 100, perCall: 100 });
    const r = await meteredCall({ ...l.deps, provider: okProvider(null) }, { scope: "t", jobId: null, kind: "sandbox", body: body(), timeoutMs: 1000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usage.cost).toBeNull();
    expect(l.rows[0].status).toBe("unknown");
    expect(l.committed()).toBeGreaterThan(0);
  });

  it("zero cost, token-less usage and failed calls keep the full reservation (never free)", async () => {
    const zero = ledger({ global: 100, perJob: 100, perCall: 100 });
    await meteredCall({ ...zero.deps, provider: okProvider(0) }, { scope: "t", jobId: null, kind: "generation", body: body(), timeoutMs: 1000 });
    expect(zero.rows[0].status).toBe("unknown");
    const noTok = ledger({ global: 100, perJob: 100, perCall: 100 });
    await meteredCall({ ...noTok.deps, provider: vi.fn(async () => ({ ok: true, status: 200, data: { usage: { prompt_tokens: 0, completion_tokens: 0, cost: 0.01 } } })) }, { scope: "t", jobId: null, kind: "generation", body: body(), timeoutMs: 1000 });
    expect(noTok.rows[0].status).toBe("unknown");
    const failed = ledger({ global: 100, perJob: 100, perCall: 100 });
    const r = await meteredCall({ ...failed.deps, provider: vi.fn(async () => ({ ok: false, status: 502, data: { usage: { prompt_tokens: 10, cost: 0 } } })) }, { scope: "t", jobId: null, kind: "generation", body: body(), timeoutMs: 1000 });
    expect(r.ok).toBe(false);
    expect(failed.rows[0].status).toBe("unknown");
    expect(failed.committed()).toBeCloseTo(reservedFor(body()), 6);
  });

  it("reconciliation is idempotent", async () => {
    const l = ledger({ global: 100, perJob: 100, perCall: 100 });
    const r = await meteredCall({ ...l.deps, provider: okProvider(0.002) }, { scope: "t", jobId: null, kind: "proposal", body: body(), timeoutMs: 1000 });
    expect(r.ok).toBe(true);
    await l.deps.reconcile({ id: l.rows[0].id, actual: 0, pt: 0, ct: 0, outcome: "replay" });
    expect(l.rows[0].actual).toBe(0.002);
  });

  it("per-call cap bounds a single oversized request", async () => {
    const l = ledger({ global: 100, perJob: 100, perCall: 0.05 });
    const provider = okProvider(0.01);
    const r = await meteredCall({ ...l.deps, provider }, { scope: "t", jobId: null, kind: "generation", body: body("openai/gpt-6-astra", 8000), timeoutMs: 1000 });
    expect(r).toMatchObject({ ok: false, reason: "per_call_cap" });
    expect(provider).not.toHaveBeenCalled();
  });
});
