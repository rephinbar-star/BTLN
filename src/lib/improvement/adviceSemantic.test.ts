import { describe, expect, it } from "vitest";
import { applySemanticVerdicts, semanticRequest, withholdMisattributed, removeItems } from "../../../supabase/functions/_shared/adviceRecipients";
import { SEMANTIC_FIXTURES } from "../../../supabase/functions/_shared/adviceSemanticFixtures";

const fx = SEMANTIC_FIXTURES[0];
const req = semanticRequest(fx.items, fx.parts, fx.msgs);
const good = (id: string, extra: Record<string, unknown> = {}) => ({ id, addressed_to: "recipient", behavior_actor: "recipient", supported: "yes", evidence: [1], ...extra });

describe("advice semantic verdicts (fail closed)", () => {
  it("keeps only explicit, supported, recipient verdicts with valid evidence", () => {
    const v = applySemanticVerdicts(fx.items, { verdicts: [
      good("cs.p1.0"),
      good("cs.p1.1", { behavior_actor: "counterpart" }),
      good("cs.p2.0", { addressed_to: "unclear" }),
      good("cs.p2.1", { evidence: [999] }),
      good("step.0", { addressed_to: "both", behavior_actor: "both" }),
    ] }, req);
    expect(v.get("cs.p1.0")!.ok).toBe(true);
    expect(v.get("cs.p1.1")!.reasons).toContain("semantic_behavior_is_counterparts");
    expect(v.get("cs.p2.0")!.reasons).toContain("semantic_recipient_unclear");
    expect(v.get("cs.p2.1")!.reasons).toContain("semantic_no_valid_evidence");
    expect(v.get("step.0")!.ok).toBe(true);
  });
  it("withholds everything on malformed, missing or timed-out output", () => {
    for (const bad of [null, {}, { verdicts: "x" }, "garbage"]) {
      const v = applySemanticVerdicts(fx.items, bad, req);
      expect([...v.values()].every((x) => !x.ok && x.reasons[0] === "semantic_unavailable")).toBe(true);
    }
    const v = applySemanticVerdicts(fx.items, { verdicts: [good("cs.p1.0"), good("cs.p1.0"), { id: "cs.p2.0", addressed_to: "sideways", behavior_actor: "recipient", supported: "yes", evidence: [1] }] }, req);
    expect(v.get("cs.p1.0")!.reasons).toEqual(["semantic_duplicate"]);
    expect(v.get("cs.p2.0")!.reasons).toEqual(["semantic_malformed"]);
    expect(v.get("step.0")!.reasons).toEqual(["semantic_missing"]);
  });
  it("sends transcript and advice as fenced untrusted data with person ids", () => {
    expect(req.system).toMatch(/untrusted data/);
    expect(req.user).toMatch(/<transcript[\s\S]*\[0\] p2: You never plan/);
    const same = SEMANTIC_FIXTURES.find((f) => f.id === "t3-same-name")!;
    expect(semanticRequest(same.items, same.parts, same.msgs).system).toMatch(/p1 = "Sam"; p2 = "Sam"/);
  });
  it("held-out swaps have no quotes or counterpart names, so rule checks alone let them through", () => {
    for (const f of SEMANTIC_FIXTURES) for (const i of f.items.filter((x) => x.expect === "withhold")) {
      expect(i.text).not.toMatch(/["\u201C]/);
      const r = { communication_suggestions: { person1: [] as string[], person2: [] as string[] } };
      (i.recipient_id === "p1" ? r.communication_suggestions.person1 : r.communication_suggestions.person2).push(i.text);
      expect(withholdMisattributed(r, f.parts, f.msgs).statuses.every((s) => s.status === "kept")).toBe(true);
    }
  });
  it("status ids follow surviving items after withholding; removeItems drops by current id", () => {
    const r: any = { communication_suggestions: { person1: ['Instead of "never", say what you need.', "Say it stung."], person2: [] } };
    const parts = fx.parts;
    const out = withholdMisattributed(r, parts, fx.msgs);
    expect(out.statuses.find((s) => s.status === "kept")!.id).toBe("cs.p1.0");
    removeItems(r, parts, new Set(["cs.p1.0"]));
    expect(r.communication_suggestions.person1).toEqual([]);
  });
});
