import { describe, expect, it } from "vitest";
import { checkGroupBrevity, groupBounds, groupBrevityContract, proseFields } from "../../../supabase/functions/_shared/groupBrevity";
import { compactContext, expandRefs } from "../../../supabase/functions/_shared/r360Context";
import { estimateInputTokens, maxCostUsd } from "../../../supabase/functions/_shared/promptBudget";

describe("group brevity (group-brevity-1)", () => {
  it("scales total bounds with group size, capped", () => {
    expect(groupBounds(3).total).toBe(610);
    expect(groupBounds(4).total).toBe(740);
    expect(groupBounds(12).total).toBe(900);
  });
  it("keeps every participant in the contract and excludes coverage from prose", () => {
    expect(groupBrevityContract(4)).toMatch(/Keep every participant/);
    expect(proseFields({ coverage: { unavailable_metrics: ["a b c"] }, repair: { note: "x y" } }).map((f) => f.path)).toEqual(["repair.note"]);
  });
  it("flags over-long fields, retold moments and cards repeating their own evidence", () => {
    const long = Array(60).fill("word").join(" ");
    const o = {
      repair: { note: `Cleo said "Ben what are you on about" at #2997. ${long}` },
      role_cards: [
        { participant_id: "p3", why: 'She says "Ben what are you on about" at the end.', evidence: "Ben what are you on about", headline: "h" },
        { participant_id: "p1", why: "Books things.", evidence: "ok I'll book somewhere else", headline: "h" },
      ],
    };
    const g = checkGroupBrevity(o, 4);
    expect(g.over.some((x) => x.startsWith("repair.note"))).toBe(true);
    expect(g.duplicated).toContain("ben what are you on about");
    expect(g.selfRepeat).toBe(1);
    expect(g.participantsCovered).toBe(2);
  });
});

describe("Relationship360 compact context (r360-context-1)", () => {
  const rels = new Map([["rel-a", { id: "rel-a", label: "Alex", is_confirmed: true }], ["rel-b", { id: "rel-b", label: "Sam", is_confirmed: true }]]);
  const sources = new Map([
    ["src-1", { id: "src-1", source_kind: "deep_read", relationship_id: "rel-a", observed_period_start: "2024-01-01", observed_period_end: "2024-12-13" }],
    ["src-2", { id: "src-2", source_kind: "deep_read", relationship_id: "rel-b", observed_period_start: null, observed_period_end: null }],
  ]);
  const obs = Array.from({ length: 85 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, journey_source_id: i % 2 ? "src-1" : "src-2", subject_kind: i % 3 ? "user_behavior" : "other_behavior",
    subject_label: i % 3 ? "Taylor" : "Alex", observation_type: "deep_read.pattern", statement: "x".repeat(135), confidence: "medium",
    observed_period_start: i % 2 ? "2024-11-29" : null, observed_period_end: i % 2 ? "2024-11-30" : null,
  }));
  it("keeps every statement, actor, date and relationship, and maps short refs back", () => {
    const c = compactContext(obs, sources, rels);
    expect(c.text.match(/^O\d+\|/gm)!.length).toBe(85);
    expect(c.text).toMatch(/\|2024-11-29\.\.2024-11-30\|/);
    expect(c.text).toMatch(/R1\|Sam\|confirmed/);
    const out = expandRefs({ patterns: [{ evidence: ["O1", "O2", "O999", "nope"] }] }, c.back) as any;
    expect(out.patterns[0].evidence.slice(0, 2)).toEqual([obs[0].id, obs[1].id]);
    expect(out.patterns[0].evidence.slice(2)).toEqual(["O999", "nope"]); // dropped later by validation
  });
  it("brings the 85-observation whole-account bound under the $0.60 call cap", () => {
    const c = compactContext(obs, sources, rels);
    const sys = "s".repeat(6000);
    const legacy = JSON.stringify(obs.map((o) => ({ observation_id: o.id, source_id: `${o.journey_source_id}-0000-4000-8000-000000000000`, source_kind: "deep_read", relationship_id: "rel-a-0000-0000-0000-000000000000", relationship_label: "Alex", relationship_confirmed: true, kind: o.subject_kind, actor: o.subject_label, type: o.observation_type, observed_from: o.observed_period_start, observed_to: o.observed_period_end, confidence: o.confidence, statement: o.statement })));
    const before = maxCostUsd("openai/gpt-6-astra", estimateInputTokens([{ content: sys }, { content: legacy }]), 2600)!;
    const after = maxCostUsd("openai/gpt-6-astra", estimateInputTokens([{ content: sys }, { content: c.text }]), 2600)!;
    expect(before).toBeGreaterThan(0.6);
    expect(after).toBeLessThan(0.5);
  });
});
