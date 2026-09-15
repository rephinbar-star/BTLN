import { describe, expect, it } from "vitest";
import {
  buildDyadicDigest,
  buildGroupDigest,
} from "../../../supabase/functions/_shared/roastSource";

describe("buildDyadicDigest", () => {
  const base = {
    headline: { score: 72, tier_label: "Warm", vibe_summary: "Easy, if lopsided" },
    sub_scores: { warmth: 80 },
    communication_diagnostic: { initiator_balance: "Ada starts 4 of 5 threads" },
    attachment_profiles: {
      Ada: { primary_style: "anxious", confidence: "medium", evidence_quotes: ["you up?"] },
    },
    four_horsemen: { criticism: { present: true, evidence_quote: "you always do this" } },
    green_flags: [{ title: "Repairs fast" }],
    meta: {},
  };

  it("pulls names, facts and permitted quotes", () => {
    const d = buildDyadicDigest(base, { name1: "Ada", name2: "Bo" }, "romantic");
    expect(d.subjects.map((s) => s.display_name)).toEqual(["Ada", "Bo"]);
    expect(d.facts.some((f) => f.includes("Overall score: 72"))).toBe(true);
    expect(d.evidence).toContain("you up?");
    expect(d.safetyFlag).toBe(false);
    expect(d.workContext).toBe(false);
  });

  it("honours an explicit safety concern on the source report", () => {
    const d = buildDyadicDigest(
      { ...base, meta: { safety_concern: true, safety_note: "Concerning content" } },
      { name1: "Ada", name2: "Bo" },
      "romantic",
    );
    expect(d.safetyFlag).toBe(true);
    expect(d.safetyReason).toBe("Concerning content");
  });

  it("flags safety from the findings text even when the source did not", () => {
    const d = buildDyadicDigest(
      { ...base, red_flags: [{ title: "Bo threatened to hurt Ada" }] },
      { name1: "Ada", name2: "Bo" },
      "romantic",
    );
    expect(d.safetyFlag).toBe(true);
  });

  it("falls back to placeholder names when context is empty", () => {
    const d = buildDyadicDigest(base, {}, "friend");
    expect(d.subjects.map((s) => s.display_name)).toEqual(["Person A", "Person B"]);
    expect(d.category).toBe("friend");
  });
});

describe("buildGroupDigest", () => {
  const result = {
    group_title: "The plan-makers",
    participants: [
      { id: "p1", display_name: "Maya" },
      { id: "p2", display_name: "Dev" },
    ],
    role_cards: [
      { participant_id: "p1", role: "Organizer", headline: "Books everything", why: "3 polls", evidence: "who's in?" },
      { participant_id: "p2", role: "Ghost", headline: "Reads, never types" },
    ],
    group_strengths: ["Nobody holds grudges"],
    safety_mode: false,
  };
  const stats = { participants: [{ id: "p1", share_pct: 61 }], total_unanswered_questions: 4 };

  it("summarises roles with their real share of messages", () => {
    const d = buildGroupDigest(result, stats, "friends");
    expect(d.context).toBe("group");
    expect(d.subjects).toHaveLength(2);
    expect(d.facts.some((f) => f.includes("Maya") && f.includes("61%"))).toBe(true);
    expect(d.evidence).toEqual(["who's in?"]);
  });

  it("marks work groups so the model avoids performance humour", () => {
    expect(buildGroupDigest(result, stats, "work").workContext).toBe(true);
    expect(buildGroupDigest(result, stats, "friends").workContext).toBe(false);
  });

  it("carries the group read's own safety flag through", () => {
    const d = buildGroupDigest({ ...result, safety_mode: true }, stats, "friends");
    expect(d.safetyFlag).toBe(true);
  });

  it("never exposes more than the caps", () => {
    const many = {
      ...result,
      group_strengths: Array.from({ length: 99 }, (_, i) => `s${i}`),
    };
    const d = buildGroupDigest(many, stats, "friends");
    expect(d.facts.length).toBeLessThanOrEqual(40);
    expect(d.evidence.length).toBeLessThanOrEqual(8);
  });
});
