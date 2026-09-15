import { describe, expect, it } from "vitest";
import { GROUP_POLL_MS, GROUP_TIMEOUT_MS, pollAction, showsFailureScreen } from "./poll";

/**
 * Deterministic simulation of a Group Read page left open far longer than the
 * 180s timeout window. Time is simulated, not waited for.
 */
describe("group read polling policy", () => {
  const drive = (statusAt: (elapsed: number) => string | undefined, untilMs: number) => {
    let elapsed = 0;
    let ticks = 0;
    let stoppedAt: number | null = null;
    let timedOut = false;
    let lastStatus: string | undefined;
    while (elapsed < untilMs) {
      elapsed += GROUP_POLL_MS;
      if (stoppedAt !== null) continue; // interval cleared: no more RPC calls
      lastStatus = statusAt(elapsed);
      const action = pollAction(lastStatus, elapsed);
      if (action === "stop") {
        stoppedAt = elapsed;
        continue;
      }
      if (action === "timeout") {
        timedOut = true;
        stoppedAt = elapsed;
        continue;
      }
      ticks += 1;
    }
    return { ticks, stoppedAt, timedOut, lastStatus };
  };

  it("a read that completes at 20s stops polling and never times out, even after 10 minutes", () => {
    const r = drive((e) => (e >= 20_000 ? "complete" : "analyzing"), 600_000);
    expect(r.stoppedAt).toBe(20_000);
    expect(r.timedOut).toBe(false);
    expect(showsFailureScreen("complete", r.timedOut)).toBe(false);
    // Polling really stopped: ~8 ticks before completion, none after.
    expect(r.ticks).toBeLessThan(10);
  });

  it("a completed read stays complete past the 180s window", () => {
    const elapsed = GROUP_TIMEOUT_MS + 120_000; // 5 minutes of simulated time
    expect(pollAction("complete", elapsed)).toBe("stop");
    expect(showsFailureScreen("complete", true)).toBe(false);
  });

  it("a read still pending past 180s times out once and stops", () => {
    const r = drive(() => "analyzing", 400_000);
    expect(r.timedOut).toBe(true);
    expect(r.stoppedAt).toBeGreaterThan(GROUP_TIMEOUT_MS);
    expect(r.stoppedAt).toBeLessThan(GROUP_TIMEOUT_MS + GROUP_POLL_MS * 2);
    expect(showsFailureScreen("analyzing", true)).toBe(true);
  });

  it("a failed read stops immediately and shows the failure screen", () => {
    const r = drive((e) => (e >= 10_000 ? "failed" : "pending"), 300_000);
    expect(r.stoppedAt).toBe(10_000);
    expect(r.timedOut).toBe(false);
    expect(showsFailureScreen("failed", false)).toBe(true);
  });
});
