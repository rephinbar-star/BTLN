// Held-out fixtures for the advice semantic check (advice-semantic-1).
// These cases were written after the checker prompt and are not shown to it.
// "expect" is the operator's intended label: keep = correctly addressed and
// supported; withhold = meant for the other person / about their behaviour.
// No quotes and no counterpart names appear in the swapped items, so the
// deterministic rules (advice-recipient-2) cannot catch them.
import type { AdviceItem, Msg, Participant } from "./adviceRecipients.ts";

type Fx = { id: string; parts: Participant[]; msgs: Msg[]; items: (AdviceItem & { expect: "keep" | "withhold"; note: string })[] };

const TA: Participant[] = [{ id: "p1", label: "Taylor", role: "user" }, { id: "p2", label: "Alex", role: "partner" }];
const REV: Participant[] = [{ id: "p1", label: "Alex", role: "user" }, { id: "p2", label: "Taylor", role: "partner" }];
const SAM: Participant[] = [{ id: "p1", label: "Sam", role: "user" }, { id: "p2", label: "Sam", role: "partner" }];

// Taylor = user role (p1). Alex (partner) uses absolutes; Taylor brushes things off.
const T1: Msg[] = [
  { sender_role: "partner", content: "You never plan anything, I always have to do it." },
  { sender_role: "user", content: "Whatever, fine." },
  { sender_role: "partner", content: "See, this is exactly what I mean." },
  { sender_role: "user", content: "I said fine, can we just drop it" },
  { sender_role: "partner", content: "Forget it. Dinner at 8?" },
  { sender_role: "user", content: "ok" },
];
// Reversed roles: Alex is now the user (p1) and uses absolutes.
const T1R: Msg[] = T1.map((m) => ({ ...m, sender_role: m.sender_role === "user" ? "partner" : "user" }));
const T2: Msg[] = [
  { sender_role: "user", content: "My sister Jordan thinks we rush everything." },
  { sender_role: "partner", content: "What do you think though?" },
  { sender_role: "user", content: "I don't know, maybe she's right" },
  { sender_role: "partner", content: "I'd like to hear your view, not hers." },
];
// Same display names. p1 Sam (user) over-apologises; p2 Sam (partner) criticises.
const T3: Msg[] = [
  { sender_role: "partner", content: "You forgot the tickets again." },
  { sender_role: "user", content: "I'm so sorry, I'm sorry, it's my fault, I'm useless" },
  { sender_role: "partner", content: "It's not a big deal, I just wanted you to remember." },
  { sender_role: "user", content: "Sorry. Sorry again." },
];

// Held-out set 2: written after round 1 (and before round 2 prompt changes were evaluated on it).
const JR: Participant[] = [{ id: "p1", label: "Jordan", role: "user" }, { id: "p2", label: "Riley", role: "partner" }];
const T4: Msg[] = [
  { sender_role: "partner", content: "I've been really anxious about my job lately" },
  { sender_role: "user", content: "haha you'll be fine, anyway did you see the game" },
  { sender_role: "partner", content: "yeah I guess" },
  { sender_role: "user", content: "we should get tacos" },
];
const T5: Msg[] = [
  { sender_role: "user", content: "oh wow, only 40 minutes late, a new record" },
  { sender_role: "partner", content: "sorry, traffic was bad" },
  { sender_role: "user", content: "sure it was" },
];

const it = (id: string, rid: string, cid: string, kind: AdviceItem["kind"], text: string, expect: "keep" | "withhold", note: string) =>
  ({ id, path: [id], recipient_id: rid, counterpart_ids: [cid], kind, text, expect, note });

export const SEMANTIC_FIXTURES: Fx[] = [
  { id: "t1-pronoun-noquote", parts: TA, msgs: T1, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "When a comment stings, say that it stung instead of closing the topic.", "keep", "Taylor closed the topic"),
    it("cs.p1.1", "p1", "p2", "suggestion", "Try voicing your frustration without the all-or-nothing word that makes it sound like a verdict.", "withhold", "absolutes were the partner's"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Next time, stay in the conversation instead of brushing it off and moving to logistics.", "withhold", "the user brushed it off, not the partner"),
    it("cs.p2.1", "p2", "p1", "suggestion", "Ask for help with planning as a specific request rather than a statement about their character.", "keep", "partner generalised"),
    it("step.0", "p1", "p2", "step", "Together, pick one evening this week to plan the next few days.", "keep", "joint action"),
  ] },
  { id: "t1-reversed", parts: REV, msgs: T1R, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "Try voicing your frustration without the all-or-nothing word that makes it sound like a verdict.", "keep", "same text, now for the person who used absolutes"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Try voicing your frustration without the all-or-nothing word that makes it sound like a verdict.", "withhold", "reversed: partner did not use absolutes"),
  ] },
  { id: "t2-third-party", parts: TA, msgs: T2, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "Your sister's view is hers; share what you yourself think.", "keep", "third party mentioned"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Keep inviting their own view, as you did, without dismissing the family opinion.", "keep", "partner did invite the view"),
  ] },
  { id: "t3-same-name", parts: SAM, msgs: T3, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "Try one apology, then say what you'll do differently, instead of calling yourself names.", "keep", "p1 over-apologised"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Try one apology, then say what you'll do differently, instead of calling yourself names.", "withhold", "same display name; p2 did not apologise"),
  ] },
];

export const SEMANTIC_FIXTURES_2: Fx[] = [
  { id: "t4-topic-switch", parts: JR, msgs: T4, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "When they share a worry, ask one question about it before moving on.", "keep", "user switched topics"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Ask one question about their worry before switching topics.", "withhold", "partner did not switch topics"),
    it("cs.p2.1", "p2", "p1", "suggestion", "Say plainly that you'd like them to stay with the topic for a minute.", "keep", "partner's worry was brushed aside"),
    it("step.0", "p1", "p2", "step", "Agree together on a signal for 'I need you to listen right now'.", "keep", "joint action"),
  ] },
  { id: "t5-sarcasm", parts: JR, msgs: T5, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "Say what the lateness cost you directly, without sarcasm.", "keep", "user was sarcastic"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Drop the sarcasm and state what bothered you.", "withhold", "partner was not sarcastic"),
    it("cs.p2.1", "p2", "p1", "suggestion", "Give a specific time estimate next time you're running late.", "keep", "partner was late"),
  ] },
];
