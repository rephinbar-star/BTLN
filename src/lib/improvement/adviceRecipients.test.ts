import { describe, expect, it } from "vitest";
import {
  adviceItems, checkRecipient, mergeById, rewritePayload, withholdMisattributed, type Msg, type Participant,
} from "../../../supabase/functions/_shared/adviceRecipients.ts";

const P: Participant[] = [{ id: "p1", label: "Taylor", role: "user" }, { id: "p2", label: "Alex", role: "partner" }];
// Canonical messages of the dr-attribution case (Alex complains, Taylor rebuts).
const M: Msg[] = [
  { sender_role: "partner", content: "Taylor never replies on time, it drives me mad" },
  { sender_role: "user", content: "I replied within the hour yesterday though" },
  { sender_role: "partner", content: "Whatever. Dinner Friday?" },
  { sender_role: "user", content: "Sure, 7pm" },
];

// Retained permanently: the exact remedial guidance of failing run ec8ce5d8-3a61-483b-a1e3-f94f0c21e116.
const EC8 = () => ({
  communication_suggestions: {
    person1: ["When Alex opens with a frustration, try acknowledging the feeling first before defending yourself — something like 'I hear that the timing bothers you' before citing yesterday's reply.", "Ask Alex at least one question about their day or feelings; in this entire exchange you asked nothing, which can read as disengagement."],
    person2: ["Replace 'never' with the specific incident that is actually bothering you, such as naming the day and the delay instead of using a blanket accusation.", "When you say 'Whatever' and pivot to logistics, you close the door on the very issue you just raised; try staying with it one more exchange before moving on."],
  },
  remedial_guidance: {
    specific_steps: [
      "Before your next conversation with Alex, identify the one specific incident that's actually bothering you — not the pattern, the moment — and lead with that instead of 'never.'",
      "When Alex raises a frustration, pause before defending yourself and say one sentence that names what Alex might be feeling.",
      "Agree together on a communication norm — a response-time expectation you both set, rather than one Alex enforces through criticism.",
    ],
    scripted_alternatives: [
      { instead_of: "Generalized criticism: 'Taylor never replies on time, it drives me mad'", try: "Name the specific moment: 'I waited two hours for your reply on Tuesday and felt anxious — can we talk about response times?'" },
      { instead_of: "Defensive rebuttal: 'I replied within the hour yesterday though'", try: "Lead with acknowledgment: 'It sounds like the waiting really bothers you — I want to understand when it feels worst.'" },
    ],
  },
});

// Retained permanently: c4b22897 (no rewrite) — the primary generation put Alex's advice under person1 and Taylor's under person2.
const C4B_SWAPPED = {
  communication_suggestions: {
    person1: ["Try replacing 'never' with something specific: instead of 'Taylor never replies on time,' try naming the actual instance.", "When Taylor offers a defense, resist the 'Whatever' — that word ends the conversation."],
    person2: ["Your counter-example ('I replied within the hour yesterday') is accurate but it reads as deflection. Try acknowledging Alex's feeling first.", "You accepted 'Whatever' and moved straight to dinner plans."],
  },
};

describe("actor references (advice-recipient-2)", () => {
  const forAlex = { id: "cs.p2.0", path: [], recipient_id: "p2", counterpart_ids: ["p1"], kind: "suggestion" as const, text: "" };
  const forTaylor = { ...forAlex, id: "cs.p1.0", recipient_id: "p1", counterpart_ids: ["p2"] };
  it("known escaped item: pronoun-only advice about accepting your own word is rejected", () => {
    expect(checkRecipient(forAlex, "You accepted 'Whatever' and moved straight to dinner plans.", P, M).ok).toBe(false);
    expect(checkRecipient(forTaylor, "You accepted 'Whatever' and moved straight to dinner plans.", P, M).ok).toBe(true);
  });
  it("possessive own words must be the recipient's", () => {
    expect(checkRecipient(forAlex, "Your counter-example ('I replied within the hour yesterday') reads as deflection.", P, M).ok).toBe(false);
    expect(checkRecipient(forTaylor, "Your counter-example ('I replied within the hour yesterday') reads as deflection.", P, M).ok).toBe(true);
  });
  it("counterpart possessive must be the counterpart's words", () => {
    expect(checkRecipient(forTaylor, "Alex's 'I replied within the hour yesterday' was fair.", P, M).ok).toBe(false);
    expect(checkRecipient(forTaylor, "Alex's 'Whatever' shut the talk down; name it gently.", P, M).ok).toBe(true);
  });
  it("reversed participant order keeps the same judgement", () => {
    const R: Participant[] = [{ id: "p1", label: "Alex", role: "user" }, { id: "p2", label: "Taylor", role: "partner" }];
    const RM: Msg[] = M.map((m) => ({ ...m, sender_role: m.sender_role === "user" ? "partner" : "user" }));
    expect(checkRecipient({ ...forTaylor }, "You accepted 'Whatever' and moved on.", R, RM).ok).toBe(false); // p1 is Alex here
  });
  it("same display names fall back to speaker roles, not names", () => {
    const S: Participant[] = [{ id: "p1", label: "Sam", role: "user" }, { id: "p2", label: "Sam", role: "partner" }];
    expect(checkRecipient(forAlex, "You accepted 'Whatever' and moved on.", S, M).ok).toBe(false);
  });
  it("joint advice and quoted third parties with no ownership claim pass", () => {
    expect(checkRecipient(forTaylor, "Together, agree a time to talk before Friday.", P, M).ok).toBe(true);
    expect(checkRecipient(forTaylor, "As your friend Jo put it, 'pick one thing'.", P, M).ok).toBe(true);
  });
});

describe("advice recipient integrity", () => {
  it("c4b22897: a fully swapped person1/person2 generation is withheld, not shown or name-swapped", () => {
    const r = JSON.parse(JSON.stringify(C4B_SWAPPED));
    const { statuses } = withholdMisattributed(r, P, M);
    // advice-recipient-2: the previously escaped "You accepted 'Whatever'" (cs.p2.1) is now caught.
    expect(statuses.filter((s) => s.status === "withheld").map((s) => s.id).sort()).toEqual(["cs.p1.0", "cs.p1.1", "cs.p2.0", "cs.p2.1"]);
    expect(r.communication_suggestions.person1).toEqual([]);
  });

  it("ec8ce5d8: withholds exactly the step and script that ask Taylor to change Alex's words", () => {
    const r = EC8();
    const { statuses, items } = withholdMisattributed(r, P, M);
    const withheld = statuses.filter((s) => s.status === "withheld");
    expect(withheld.map((s) => s.id).sort()).toEqual(["script.0", "step.0"]);
    expect(withheld.find((s) => s.id === "step.0")!.reasons[0]).toMatch(/^behavior_owner_mismatch:never/);
    expect(r.communication_suggestions.person2).toHaveLength(2); // Alex's own "never" advice kept
    expect(r.remedial_guidance.specific_steps).toHaveLength(2);
    expect(items.every((i) => !/instead of 'never/.test(i.text))).toBe(true);
  });

  it("same two people in reversed order resolve by role, not array position", () => {
    const rev = [P[1], P[0]];
    const a = adviceItems(EC8(), rev).map((i) => [i.id, i.recipient_id]);
    const b = adviceItems(EC8(), P).map((i) => [i.id, i.recipient_id]);
    expect(a).toEqual(b);
    expect(withholdMisattributed(EC8(), rev, M).statuses.filter((s) => s.status === "withheld").map((s) => s.id).sort()).toEqual(["script.0", "step.0"]);
  });

  it("same display name with distinct ids still checks behaviour ownership by id/role", () => {
    const same: Participant[] = [{ id: "p1", label: "Sam", role: "user" }, { id: "p2", label: "Sam", role: "partner" }];
    const msgs: Msg[] = [{ sender_role: "partner", content: "you always do this" }, { sender_role: "user", content: "ok" }];
    const it = { id: "step.0", path: [], recipient_id: "p1", counterpart_ids: ["p2"], kind: "step" as const, text: "Try naming one moment instead of 'always'." };
    expect(checkRecipient(it, it.text, same, msgs).reasons).toEqual(["behavior_owner_mismatch:always"]);
    expect(checkRecipient({ ...it, recipient_id: "p2", counterpart_ids: ["p1"] }, it.text, same, msgs).ok).toBe(true);
  });

  it("a quoted third party name and pronouns are allowed; naming the recipient as a third party is not", () => {
    const it = { id: "cs.p1.0", path: [], recipient_id: "p1", counterpart_ids: ["p2"], kind: "suggestion" as const, text: "" };
    expect(checkRecipient(it, "Tell Alex how she made you feel when she mentioned 'Jordan said Taylor forgot'.", P, M).ok).toBe(true);
    expect(checkRecipient(it, "Ask Taylor what she needs from Alex.", P, M).reasons).toContain("recipient_named_as_third_party");
    expect(checkRecipient(it, "Alex, try asking one question first.", P, M).reasons).toContain("addresses_counterpart");
    // Traced in ac16108c: correct direct address to the recipient is not a third-party mention.
    expect(checkRecipient(it, "Next time Alex raises a complaint, you (Taylor) name the feeling first.", P, M).ok).toBe(true);
    expect(checkRecipient(it, "Taylor, ask Alex one question first.", P, M).ok).toBe(true);
  });

  it("advice containing the counterpart's name and joint advice pass", () => {
    const it = { id: "step.2", path: [], recipient_id: "p1", counterpart_ids: ["p2"], kind: "step" as const, text: "" };
    expect(checkRecipient(it, "Agree with Alex on a reply-time norm you both set.", P, M).ok).toBe(true);
    expect(checkRecipient(it, "Together, pick one evening to talk it through.", P, M).ok).toBe(true);
  });

  it("the recipient's own words may be replaced (Taylor rebuts → Taylor's advice)", () => {
    const it = { id: "step.1", path: [], recipient_id: "p1", counterpart_ids: ["p2"], kind: "step" as const, text: "" };
    expect(checkRecipient(it, "Instead of 'I replied within the hour', say you hear the worry.", P, M).ok).toBe(true);
  });

  it("merge is by id: reordered, repeated and unknown items cannot land on the wrong advice", () => {
    const items = adviceItems(EC8(), P);
    const m = mergeById(items, { items: [{ id: "step.1", text: "B" }, { id: "cs.p1.0", text: "A" }, { id: "step.1", text: "DUP" }, { id: "cs.p9.0", text: "X" }, { id: "step.2", text: 5 }] });
    expect([...m.entries()]).toEqual([["step.1", "B"], ["cs.p1.0", "A"]]);
  });

  it("rewrite payload names recipient vs counterpart explicitly and carries the immutable pattern", () => {
    const pl = rewritePayload(adviceItems(EC8(), P), P);
    const s = pl.find((x) => x.id === "script.1")!;
    expect(s.recipient).toMatch(/^Taylor \[p1\]/);
    expect(s.counterpart).toMatch(/^Alex \[p2\]/);
    expect(s.replaces_pattern).toContain("I replied within the hour");
    expect(pl.find((x) => x.id === "cs.p2.0")!.recipient).toMatch(/^Alex \[p2\]/);
  });
});
