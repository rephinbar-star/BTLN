import { describe, it, expect, vi } from "vitest";

const calls: { fn: string; args: Record<string, unknown> }[] = [];
vi.mock("@/integrations/supabase/client", () => {
  // Mirrors the real client: rpc reads `this.rest`, so an unbound call throws.
  const client = {
    rest: { ok: true },
    rpc(this: { rest?: unknown }, fn: string, args: Record<string, unknown>) {
      if (!this?.rest) throw new TypeError("Cannot read properties of undefined (reading 'rest')");
      calls.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { supabase: client };
});

import { submitFeedback, clearFeedback } from "./api";

describe("feedback rpc binding", () => {
  it("calls the existing RPCs with the client bound", async () => {
    const target = { sourceKind: "analysis", sourceId: "00000000-0000-4000-8000-000000000001", targetKind: "report" } as never;
    expect(await submitFeedback({ target, rating: "helpful" as never })).toEqual({ ok: true });
    expect(await clearFeedback(target)).toEqual({ ok: true });
    expect(calls.map((c) => c.fn)).toEqual(["submit_ai_feedback", "clear_ai_feedback"]);
    expect(calls[0].args).toMatchObject({ p_source_kind: "analysis", p_target_key: "main", p_rating: "helpful" });
  });
});
