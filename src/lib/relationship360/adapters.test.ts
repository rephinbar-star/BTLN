import { describe, expect, it } from "vitest";
import {
  adaptDeepRead,
  adaptGroupRead,
  adaptGroupRoast,
  adaptInteractiveEvent,
  adaptQuickTake,
} from "../../../supabase/functions/_shared/r360Adapters.ts";

const ctx = { subject: "Taylor", label: "Deep Read · analysed 2026-09-01", observedStart: "2026-08-01", observedEnd: "2026-08-30" };

describe("Relationship360 source adapters", () => {
  it("attributes behaviour to the person only when the confirmed participant is named", () => {
    const out = adaptDeepRead({
      communication_diagnostic: {
        key_observation: "Taylor starts most threads and keeps them logistical.",
        initiator_balance: "Morgan replies quickly but rarely opens a thread.",
      },
    }, ctx);
    const mine = out.find((o) => o.observation_type === "communication.key_observation");
    const theirs = out.find((o) => o.observation_type === "communication.initiator_balance");
    expect(mine?.subject_kind).toBe("user_behavior");
    expect(theirs?.subject_kind).toBe("other_behavior");
  });

  it("keeps suggested replies as advice, never as something the person did", () => {
    const out = adaptQuickTake({
      read: { subtext: "They are keeping the door open without committing." },
      reply_options: [{ text: "Let me know by six." }],
    }, ctx);
    const suggestion = out.find((o) => o.observation_type === "suggestion.not_sent");
    expect(suggestion?.subject_kind).toBe("ai_advice");
    expect(suggestion?.statement).toContain("not known to be sent");
    expect(out.some((o) => o.subject_kind === "user_behavior")).toBe(false);
  });

  it("treats a confirmed sent reply as the person's own behaviour and a self report as self reported", () => {
    const sent = adaptInteractiveEvent({ event_type: "sent_reply", created_at: "2026-09-10T10:00:00Z", result_json: {} }, ctx);
    expect(sent[0].subject_kind).toBe("user_behavior");
    expect(sent[0].observed_period_start).toBe("2026-09-10");
    const told = adaptInteractiveEvent({ event_type: "self_report", created_at: "2026-09-11T10:00:00Z", result_json: { note: "We met up." } }, ctx);
    expect(told[0].subject_kind).toBe("self_report");
    expect(told[0].statement).toContain("Self-reported by you");
  });

  it("never turns a Group Roast into psychological evidence", () => {
    expect(adaptGroupRoast()).toEqual([]);
  });

  it("only maps a group role card to the person when it is the participant they confirmed", () => {
    const out = adaptGroupRead({
      role_cards: [
        { display_name: "Taylor", role: "The planner", description: "Keeps dates moving." },
        { display_name: "Sam", role: "The ghost", description: "Replies late." },
      ],
    }, ctx);
    expect(out.find((o) => o.statement.startsWith("Taylor"))?.subject_kind).toBe("user_behavior");
    expect(out.find((o) => o.statement.startsWith("Sam"))?.subject_kind).toBe("other_behavior");
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
