import { describe, expect, it } from "vitest";
import { ADVICE_SEMANTIC_VERSION, applySemanticVerdicts, semanticRequest, withholdMisattributed, removeItems } from "../../../supabase/functions/_shared/adviceRecipients";
import { SEMANTIC_FIXTURES, SEMANTIC_FIXTURES_4 } from "../../../supabase/functions/_shared/adviceSemanticFixtures";

const fx = SEMANTIC_FIXTURES[0];
const req = semanticRequest(fx.items, fx.parts, fx.msgs);
const good = (id: string, extra: Record<string, unknown> = {}) => ({ id, addressed_to: "recipient", action_type: "change_own_behavior", supported: "yes", evidence: [1], behavior_lines: [1], mostly_shown_by: "recipient", premise_lines: [1], ...extra });
const fut = (id: string, extra: Record<string, unknown> = {}) => good(id, { action_type: "new_action", behavior_lines: [], mostly_shown_by: "n/a", premise_lines: [0], evidence: [0], ...extra });

describe("advice semantic verdicts v4 (fail closed)", () => {
  it("keeps only explicit, supported, recipient verdicts with valid evidence", () => {
    const v = applySemanticVerdicts(fx.items, { verdicts: [
      good("cs.p1.0"),
      good("cs.p1.1", { addressed_to: "counterpart" }),
      good("cs.p2.0", { addressed_to: "unclear", behavior_lines: [0] }),
      fut("cs.p2.1", { evidence: [999] }),
      good("step.0", { addressed_to: "both", action_type: "joint_plan", behavior_lines: [], mostly_shown_by: "n/a" }),
    ] }, req);
    expect(v.get("cs.p1.0")!.ok).toBe(true);
    expect(v.get("cs.p1.1")!.reasons).toContain("semantic_addressed_to_counterpart");
    expect(v.get("cs.p2.0")!.reasons).toContain("semantic_recipient_unclear");
    expect(v.get("cs.p2.1")!.reasons).toContain("semantic_no_valid_evidence");
    expect(v.get("step.0")!.ok).toBe(true);
  });
  it("claims about the recipient's own behaviour need recipient-authored lines (server-verified)", () => {
    const v = applySemanticVerdicts(fx.items, { verdicts: [
      good("cs.p2.0", { behavior_lines: [1, 3], evidence: [1, 3] }),
      good("cs.p2.1", { behavior_lines: [0], evidence: [0], mostly_shown_by: "counterpart" }),
      good("cs.p1.0", { behavior_lines: [] }),
      good("cs.p1.1", { behavior_lines: [0], evidence: [0] }),
      good("step.0", { mostly_shown_by: "n/a" }),
    ] }, req);
    expect(v.get("cs.p2.0")!.reasons).toContain("semantic_behavior_lines_not_recipients");
    expect(v.get("cs.p2.1")!.reasons).toContain("semantic_behavior_mainly_counterparts");
    expect(v.get("cs.p1.0")!.reasons).toContain("semantic_no_behavior_lines");
    expect(v.get("cs.p1.1")!.reasons).toContain("semantic_behavior_lines_not_recipients");
    expect(v.get("step.0")!.reasons).toContain("semantic_malformed");
    const noAuth = applySemanticVerdicts(fx.items, { verdicts: [good("cs.p1.0")] }, { firstIndex: req.firstIndex, lastIndex: req.lastIndex });
    expect(noAuth.get("cs.p1.0")!.reasons).toContain("semantic_authors_unavailable");
    // Old v3 shape (behavior_actor, no action_type/premise_lines) is malformed.
    const old = applySemanticVerdicts(fx.items, { verdicts: [{ id: "cs.p1.0", addressed_to: "recipient", behavior_actor: "recipient", supported: "yes", evidence: [1], behavior_lines: [1], mostly_shown_by: "recipient" }] }, req);
    expect(old.get("cs.p1.0")!.reasons).toEqual(["semantic_malformed"]);
  });
  it("future recommendations responding to the other person are kept when grounded, not required to have happened", () => {
    const v = applySemanticVerdicts(fx.items, { verdicts: [
      fut("cs.p2.1"),                              // counterpart-authored premise is fine for a new action
      fut("cs.p1.0", { premise_lines: [] }),        // no situation shown -> withhold
      fut("cs.p1.1", { supported: "unclear" }),     // uncertainty -> withhold
      good("step.0", { action_type: "joint_plan", addressed_to: "recipient", behavior_lines: [], mostly_shown_by: "n/a" }),
    ] }, req);
    expect(v.get("cs.p2.1")!.ok).toBe(true);
    expect(v.get("cs.p1.0")!.reasons).toContain("semantic_no_premise");
    expect(v.get("cs.p1.1")!.reasons).toContain("semantic_support_unclear");
    expect(v.get("step.0")!.reasons).toContain("semantic_joint_mismatch");
  });
  it("set 4 keeps the original t1 fixture unchanged and marks the disputed item ambiguous", () => {
    expect(SEMANTIC_FIXTURES[0].items.find((i) => i.id === "cs.p2.0")!.expect).toBe("withhold");
    expect(SEMANTIC_FIXTURES_4[0].items.find((i) => i.id === "cs.p2.0")!.expect).toBe("ambiguous");
    expect(ADVICE_SEMANTIC_VERSION).toBe("advice-semantic-4");
  });
  it("withholds everything on malformed, missing or timed-out output", () => {
    for (const bad of [null, {}, { verdicts: "x" }, "garbage"]) {
      const v = applySemanticVerdicts(fx.items, bad, req);
      expect([...v.values()].every((x) => !x.ok && x.reasons[0] === "semantic_unavailable")).toBe(true);
    }
    const v = applySemanticVerdicts(fx.items, { verdicts: [good("cs.p1.0"), good("cs.p1.0"), good("cs.p2.0", { addressed_to: "sideways" })] }, req);
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
