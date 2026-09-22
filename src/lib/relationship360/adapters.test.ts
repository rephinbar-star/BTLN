import { describe, expect, it } from "vitest";
import {
  adaptDeepRead,
  adaptGroupRead,
  adaptGroupRoast,
  adaptInteractiveEvent,
  adaptQuickTake,
  classify,
} from "../../../supabase/functions/_shared/r360Adapters.ts";

const ctx = { subject: "Taylor", label: "Deep Read · analysed 2026-09-01", observedStart: "2026-08-01", observedEnd: "2026-08-30" };

describe("Relationship360 attribution", () => {
  it("never decides the actor from a name inside the sentence", () => {
    const out = adaptDeepRead({
      communication_diagnostic: {
        key_observation: "Alex avoids answering Taylor for days at a time.",
      },
    }, ctx);
    const only = out[0];
    // The old substring rule called this Taylor's behaviour. It is not.
    expect(only.subject_kind).toBe("relationship_context");
    expect(only.subject_label).toBeNull();
  });

  it("uses the structured speaker field when the report provides one", () => {
    const mine = adaptDeepRead({
      communication_diagnostic: { key_observation: { speaker: "Taylor", description: "Opens most threads with logistics." } },
    }, ctx)[0];
    const theirs = adaptDeepRead({
      communication_diagnostic: { key_observation: { speaker: "Morgan", description: "Replies quickly, rarely opens." } },
    }, ctx)[0];
    expect(mine.subject_kind).toBe("user_behavior");
    expect(mine.subject_label).toBe("Taylor");
    expect(theirs.subject_kind).toBe("other_behavior");
    expect(theirs.subject_label).toBe("Morgan");
  });

  it("stays ambiguous when both names appear, with pronouns, or in a quoted line", () => {
    const both = adaptDeepRead({ hidden_pattern: { description: "Taylor and Morgan both retreat after conflict." } }, ctx)[0];
    const pronoun = adaptDeepRead({ hidden_pattern: { description: "They tend to close the topic before it lands." } }, ctx)[0];
    const quoted = adaptDeepRead({ hidden_pattern: { description: "Morgan wrote \"Taylor never asks\" in the thread." } }, ctx)[0];
    for (const item of [both, pronoun, quoted]) {
      expect(item.subject_kind).toBe("relationship_context");
      expect(item.subject_label).toBeNull();
    }
  });

  it("does not match a short name that is only a substring of another word", () => {
    const short = { ...ctx, subject: "Al" };
    const out = adaptDeepRead({ hidden_pattern: { description: "Always alert to small slights, almost never says so." } }, short)[0];
    expect(out.subject_kind).toBe("relationship_context");
    // A structured actor named exactly "Al" still maps to the person.
    expect(classify("Al", short).kind).toBe("user_behavior");
    expect(classify("Alex", short).kind).toBe("other_behavior");
  });

  it("keeps suggested replies as advice and model prose as interpretation", () => {
    const out = adaptQuickTake({
      read: { subtext: "They are keeping the door open without committing." },
      reply_options: [{ text: "Let me know by six." }],
    }, ctx);
    expect(out.find((o) => o.observation_type === "read")?.subject_kind).toBe("generated_interpretation");
    const suggestion = out.find((o) => o.observation_type === "suggestion.not_sent");
    expect(suggestion?.subject_kind).toBe("ai_advice");
    expect(suggestion?.statement).toContain("not known to be sent");
    expect(out.some((o) => o.subject_kind === "user_behavior")).toBe(false);
  });

  it("treats a confirmed sent reply as the person's own behaviour and a self report as self reported", () => {
    const sent = adaptInteractiveEvent({ event_type: "sent_reply", created_at: "2026-09-10T10:00:00Z", result_json: {} }, ctx);
    expect(sent[0].subject_kind).toBe("user_behavior");
    expect(sent[0].subject_label).toBe("Taylor");
    const told = adaptInteractiveEvent({ event_type: "self_report", created_at: "2026-09-11T10:00:00Z", result_json: { note: "We met up." } }, ctx);
    expect(told[0].subject_kind).toBe("self_report");
    expect(told[0].statement).toContain("Self-reported by you");
  });

  it("never uses the submission date as the date of the exchange", () => {
    const noDate = adaptInteractiveEvent({ event_type: "sent_reply", created_at: "2026-09-10T10:00:00Z", result_json: {} }, ctx);
    // A later exchange with no known date stays undated: it never inherits the
    // period of the original conversation.
    expect(noDate[0].observed_period_start).toBeNull();
    const unknown = adaptInteractiveEvent(
      { event_type: "sent_reply", created_at: "2026-09-10T10:00:00Z", result_json: {} },
      { ...ctx, observedStart: null, observedEnd: null },
    );
    expect(unknown[0].observed_period_start).toBeNull();
    const dated = adaptInteractiveEvent(
      { event_type: "sent_reply", created_at: "2026-09-10T10:00:00Z", result_json: { exchange_date: "2026-08-14" } },
      ctx,
    );
    expect(dated[0].observed_period_start).toBe("2026-08-14");
  });

  it("never turns a Group Roast into psychological evidence", () => {
    expect(adaptGroupRoast()).toEqual([]);
  });

  it("only maps a group role card to the person when it names the participant they confirmed", () => {
    const out = adaptGroupRead({
      role_cards: [
        { display_name: "Taylor", role: "The planner", description: "Keeps dates moving." },
        { display_name: "Sam", role: "The ghost", description: "Replies late." },
        { role: "Unclaimed role", description: "Nobody owns this." },
      ],
    }, ctx);
    expect(out.find((o) => o.statement.startsWith("Taylor"))?.subject_kind).toBe("user_behavior");
    expect(out.find((o) => o.statement.startsWith("Sam"))?.subject_kind).toBe("other_behavior");
    expect(out.find((o) => o.statement.startsWith("A participant"))?.subject_kind).toBe("relationship_context");
  });

  it("carries derived evidence quotes but clips them", () => {
    const out = adaptDeepRead({
      hidden_pattern: { title: "Warmth without windows", description: "Pleasant, never personal.", evidence: "tonight was fun / it really was" },
    }, ctx);
    const pattern = out.find((o) => o.observation_type === "pattern");
    expect(pattern?.evidence_refs.map((e) => e.quote)).toEqual(["tonight was fun", "it really was"]);
    expect(pattern?.evidence_refs[0].label).toBe(ctx.label);
  });
});
