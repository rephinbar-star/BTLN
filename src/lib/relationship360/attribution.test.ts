import { describe, expect, it } from "vitest";
import {
  daysFromStamps,
  deterministicObservations,
  toEvidenceMessages,
  validateModelObservations,
  type AttributedParticipant,
} from "../../../supabase/functions/_shared/attributedEvidence.ts";
import { adaptDeepRead } from "../../../supabase/functions/_shared/r360Adapters.ts";

const participants: AttributedParticipant[] = [
  { id: "p1", label: "Taylor", role: "name1" },
  { id: "p2", label: "Alex", role: "name2" },
];
const messages = toEvidenceMessages([
  { sender_role: "user", content: "Are we still on for Friday?", stamp: "03/03/2026, 10:00" },
  { sender_role: "partner", content: "Taylor never asks how my week went", stamp: "03/03/2026, 18:00" },
  { sender_role: "user", content: "Sorry, how was your week?", stamp: "14/03/2026, 09:00" },
  { sender_role: "partner", content: "busy", stamp: null },
]);

const obs = (o: Record<string, unknown>) => validateModelObservations({ observations: [o] }, participants, messages);

describe("structured Deep Read attribution", () => {
  it("assigns canonical ids and dates only from parsed stamps", () => {
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(messages[0].day).toBe("2026-03-03");
    expect(messages[3].day).toBeNull();
  });

  it("named object: Alex's words about Taylor cannot become Taylor's behaviour", () => {
    const r = obs({ actor: "p1", kind: "behavior", statement: "Taylor avoids asking about Alex's week.", evidence: ["m2"] });
    expect(r.accepted[0].actor).toBe("unknown");
    expect(r.reasons.speaker_mismatch).toBe(1);
  });

  it("quoted third-party speech inside a message stays with its sender", () => {
    const r = obs({ actor: "p2", kind: "behavior", statement: "Alex voiced a complaint about being asked little.", evidence: ["m2"] });
    expect(r.accepted[0].actor).toBe("p2");
  });

  it("rejects unknown message ids and unsupported actor ids", () => {
    expect(obs({ actor: "p1", kind: "behavior", statement: "Asked twice about plans.", evidence: ["m99"] }).accepted).toHaveLength(0);
    const forged = obs({ actor: "p7", kind: "behavior", statement: "Someone else acted here.", evidence: ["m1"] });
    expect(forged.accepted[0].actor).toBe("unknown");
    expect(forged.reasons.unsupported_actor).toBe(1);
  });

  it("joint behaviour needs evidence from both speakers", () => {
    expect(obs({ actor: "joint", kind: "behavior", statement: "Both kept things brief.", evidence: ["m1", "m2"] }).accepted[0].actor).toBe("joint");
    expect(obs({ actor: "joint", kind: "behavior", statement: "Both kept things brief.", evidence: ["m1"] }).accepted[0].actor).toBe("unknown");
  });

  it("interpretations stay interpretations and undated evidence leaves the claim undated", () => {
    const r = obs({ actor: "p2", kind: "interpretation", statement: "Alex may feel overlooked.", evidence: ["m2", "m4"] });
    expect(r.accepted[0].kind).toBe("generated_interpretation");
    expect(r.accepted[0].period.start).toBeNull();
  });

  it("deterministic counts are attributed by sender only", () => {
    const many = toEvidenceMessages(Array.from({ length: 8 }, (_, i) => ({
      sender_role: i % 2 ? "partner" : "user", content: i % 2 ? "ok" : "how are you?", stamp: null,
    }) as const));
    const d = deterministicObservations(participants, many);
    expect(d.map((o) => o.actor)).toEqual(["p1", "p2"]);
    expect(d[0].statement).toContain("4 of them questions");
  });
});

const result = (actor: string, kind = "observed_behavior") => ({
  attributed_evidence: {
    schema_version: 1,
    participants,
    observations: [{ actor, kind, statement: "Proposed a concrete time to meet.", evidence: [{ message_id: "m1", speaker_id: "p1", quote: "Friday?", day: "2026-03-03" }], period: { start: "2026-03-03", end: "2026-03-03" }, origin: "model" }],
  },
  communication_suggestions: ["Name the plan early."],
});
const ctx = { subject: "Taylor", subjectId: "p1", label: "Deep Read", observedStart: null, observedEnd: null };

describe("Relationship360 mapping of structured attribution", () => {
  it("maps self through the confirmed participant id and flips on correction", () => {
    const asA = adaptDeepRead(result("p1"), ctx)[0];
    expect(asA.subject_kind).toBe("user_behavior");
    expect(asA.subject_label).toBe("Taylor");
    expect(asA.observed_period_start).toBe("2026-03-03");
    const asB = adaptDeepRead(result("p1"), { ...ctx, subject: "Alex", subjectId: "p2" })[0];
    expect(asB.subject_kind).toBe("other_behavior");
    expect(asB.subject_label).toBe("Taylor");
  });

  it("same display names with distinct ids resolve only by id", () => {
    const same = { ...result("p2"), attributed_evidence: { ...result("p2").attributed_evidence, participants: [{ id: "p1", label: "Sam" }, { id: "p2", label: "Sam" }] } };
    expect(adaptDeepRead(same, { ...ctx, subject: "Sam", subjectId: null })[0].subject_kind).toBe("relationship_context");
    expect(adaptDeepRead(same, { ...ctx, subject: "Sam", subjectId: "p2" })[0].subject_kind).toBe("user_behavior");
  });

  it("joint, unknown, interpretation, absent user and advice never become personal behaviour", () => {
    expect(adaptDeepRead(result("joint"), ctx)[0].subject_kind).toBe("relationship_context");
    expect(adaptDeepRead(result("unknown"), ctx)[0].subject_kind).toBe("relationship_context");
    expect(adaptDeepRead(result("p1", "generated_interpretation"), ctx)[0].subject_kind).toBe("generated_interpretation");
    expect(adaptDeepRead(result("p1"), { ...ctx, subject: "Morgan", subjectId: null })[0].subject_kind).toBe("relationship_context");
    const advice = adaptDeepRead(result("p1"), ctx).find((o) => o.observation_type === "suggestion.not_sent");
    expect(advice?.subject_kind).toBe("ai_advice");
  });

  it("legacy reports without structured attribution stay unattributed", () => {
    const legacy = adaptDeepRead({ hidden_pattern: { description: "Taylor rarely asks questions back." } }, ctx)[0];
    expect(legacy.subject_kind).toBe("relationship_context");
  });
});

describe("shared date rule for attributed evidence", () => {
  it("all-ambiguous day/month stays unknown", () => {
    expect(daysFromStamps(["03/04/2026, 10:00", "05/06/2026, 11:00"])).toEqual([null, null]);
  });
  it("mixed conflicting formats stay unknown", () => {
    expect(daysFromStamps(["13/04/2026, 10:00", "04/13/2026, 11:00"])).toEqual([null, null]);
  });
  it("a proving value resolves the whole export either way", () => {
    expect(daysFromStamps(["13/04/2026", "05/06/2026"])).toEqual(["2026-04-13", "2026-06-05"]);
    expect(daysFromStamps(["04/13/2026", "05/06/2026"])).toEqual(["2026-04-13", "2026-05-06"]);
  });
  it("ISO stamps, date-only and zone offsets are read as written", () => {
    expect(daysFromStamps(["2026-02-03", "2026-02-04T23:30:00+05:00", "[2026-02-05 08:00]"])).toEqual(["2026-02-03", "2026-02-04", "2026-02-05"]);
  });
  it("invalid calendar dates are rejected", () => {
    expect(daysFromStamps(["2026-02-30", "31/04/2026"])).toEqual([null, null]);
  });
});

describe("evidence selection keeps the actor's support", () => {
  const six = toEvidenceMessages([
    { sender_role: "partner", content: "a1", stamp: "2026-05-01" },
    { sender_role: "partner", content: "a2", stamp: "2026-05-02" },
    { sender_role: "user", content: "t1", stamp: "2026-06-20" },
    { sender_role: "partner", content: "a3", stamp: "2026-05-03" },
  ]);
  const run = (o: Record<string, unknown>) => validateModelObservations({ observations: [o] }, participants, six);
  it("actor's only message in the third ref is retained and dates the claim", () => {
    const r = run({ actor: "p1", kind: "behavior", statement: "Taylor proposed a time.", evidence: ["m1", "m2", "m3"] });
    expect(r.accepted[0].actor).toBe("p1");
    expect(r.accepted[0].evidence.map((e) => e.message_id)).toContain("m3");
    expect(r.accepted[0].evidence.some((e) => e.speaker_id === "p1")).toBe(true);
    const days = r.accepted[0].evidence.map((e) => e.day).sort();
    expect(r.accepted[0].period).toEqual({ start: days[0], end: days[days.length - 1], provenance: "parsed" });
  });
  it("joint support from the third ref keeps one message from each person", () => {
    const r = run({ actor: "joint", kind: "behavior", statement: "Both kept planning together.", evidence: ["m1", "m2", "m3"] });
    expect(r.accepted[0].actor).toBe("joint");
    expect(new Set(r.accepted[0].evidence.map((e) => e.speaker_id)).size).toBe(2);
  });
  it("a mix of valid and invented refs rejects the claim", () => {
    const r = run({ actor: "p2", kind: "behavior", statement: "Alex kept replying late.", evidence: ["m1", "m99"] });
    expect(r.accepted).toHaveLength(0);
    expect(r.reasons.unknown_message_id).toBe(1);
  });
  it("model claims are labelled as reference-checked, not meaning-verified", () => {
    const r = run({ actor: "p2", kind: "behavior", statement: "Alex sent short replies.", evidence: ["m1"] });
    expect(r.accepted[0].support).toBe("references_and_speaker_checked");
  });
});

describe("long-history scope", () => {
  it("claims over a truncated history are tagged recent_window and adapt at low confidence", () => {
    const r = validateModelObservations({ observations: [{ actor: "p2", kind: "behavior", statement: "Alex sent short replies.", evidence: ["m2"] }] }, participants, messages, true);
    expect(r.accepted[0].scope).toBe("recent_window");
    const drafts = adaptDeepRead({ attributed_evidence: { schema_version: 1, participants, observations: r.accepted } }, { label: "Deep Read", subject: "Taylor" } as never);
    expect(drafts[0].observation_type).toBe("deep_read.behavior.recent_window");
    expect(drafts[0].confidence).toBe("low");
  });
});
