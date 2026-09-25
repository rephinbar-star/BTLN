import { describe, expect, it } from "vitest";
import {
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
  { sender_role: "user", content: "Sorry, how was your week?", stamp: "04/03/2026, 09:00" },
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
