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

// Held-out set 3 (written after advice-semantic-3 prompt; never shown to it).
// Pronoun-only / no-name swaps with matching valid controls and a third party.
const MC: Participant[] = [{ id: "p1", label: "Morgan", role: "user" }, { id: "p2", label: "Casey", role: "partner" }];
const DQ: Participant[] = [{ id: "p1", label: "Drew", role: "user" }, { id: "p2", label: "Quinn", role: "partner" }];
const T6: Msg[] = [
  { sender_role: "user", content: "Hey are you there?" },
  { sender_role: "user", content: "Hello??" },
  { sender_role: "user", content: "Why are you ignoring me" },
  { sender_role: "partner", content: "busy" },
  { sender_role: "user", content: "You always do this, answer me" },
  { sender_role: "partner", content: "..." },
  { sender_role: "user", content: "Fine, I'll just keep texting until you reply" },
];
const T7: Msg[] = [
  { sender_role: "partner", content: "My mom said the dinner felt rushed." },
  { sender_role: "user", content: "Your mom criticises everything I do, it's ridiculous." },
  { sender_role: "partner", content: "I'm not saying she's right, I just wanted you to know." },
  { sender_role: "user", content: "Well I don't care what she thinks." },
  { sender_role: "partner", content: "Okay. I'm sorry I brought it up." },
];
export const SEMANTIC_FIXTURES_3: Fx[] = [
  { id: "t6-pursue-withdraw", parts: MC, msgs: T6, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "Send one message saying you'd like to talk, then give them time to reply.", "keep", "user sent many messages"),
    it("cs.p1.1", "p1", "p2", "suggestion", "When you need space, say so and give a time you'll come back, instead of going quiet.", "withhold", "partner went quiet"),
    it("cs.p2.0", "p2", "p1", "suggestion", "If you need space, say so and name when you'll reply, rather than one-word answers.", "keep", "partner gave one-word answers"),
    it("cs.p2.1", "p2", "p1", "suggestion", "Try sending one calm message and waiting, rather than several in a row.", "withhold", "user sent several in a row"),
    it("cs.p2.2", "p2", "p1", "suggestion", "Drop the all-or-nothing framing and describe this one moment instead.", "withhold", "user used absolutes"),
    it("step.0", "p1", "p2", "step", "Agree together on how long a reply can reasonably take on busy days.", "keep", "joint plan"),
  ] },
  { id: "t7-relative", parts: DQ, msgs: T7, items: [
    it("cs.p1.0", "p1", "p2", "suggestion", "When a relative's comment comes up, ask what your partner thinks before reacting.", "keep", "user reacted to the mother"),
    it("cs.p1.1", "p1", "p2", "suggestion", "Keep passing on hard feedback gently, as you did, and add what you think yourself.", "withhold", "partner passed it on gently"),
    it("cs.p2.0", "p2", "p1", "suggestion", "Say what you think yourself about the dinner, not only what your mother said.", "keep", "partner relayed the mother's view"),
    it("cs.p2.1", "p2", "p1", "suggestion", "Try responding to the comment without dismissing the whole family.", "withhold", "user dismissed the family"),
  ] },
];

// ---------------------------------------------------------------------------
// Set 4 (advice-semantic-4, 2026-09-26). Written by the same engineer in the
// same session as the v4 prompt, so "fresh held-out" means not used to tune it,
// not independently authored. Earlier sets above stay byte-for-byte unchanged.
//
// Adjudication of t1-pronoun-noquote / cs.p2.0 (engineering view, NOT owner-approved):
// Alex (p2) raised the issue twice (lines 0, 2) and only disengaged at line 4
// ("Forget it. Dinner at 8?") after Taylor refused twice ("Whatever", "drop it").
// The advice tells Alex to stop "brushing it off and moving to logistics".
// Speaker: line 4 IS Alex's, so the cited words have the right author.
// Support: "brushing it off" describes Taylor's pattern far better; Alex's
// one switch followed being shut down. The advice is partly supported and
// misleading as a characterisation. Original label "withhold" is defensible but
// not clear-cut, so v2 marks it AMBIGUOUS and counts it separately (never as a
// pass). Unambiguous counterparts are in t8 below.
type Label = "keep" | "withhold" | "ambiguous";
type Fx4 = { id: string; parts: Participant[]; msgs: Msg[]; items: (AdviceItem & { expect: Label; note: string })[] };
const it4 = (id: string, rid: string, cid: string, kind: AdviceItem["kind"], text: string, expect: Label, note: string) =>
  ({ id, path: [id], recipient_id: rid, counterpart_ids: [cid], kind, text, expect, note });
const AB: Participant[] = [{ id: "p1", label: "Avery", role: "user" }, { id: "p2", label: "Blake", role: "partner" }];
const EF: Participant[] = [{ id: "p1", label: "Emery", role: "user" }, { id: "p2", label: "Finley", role: "partner" }];
const T8: Msg[] = [
  { sender_role: "user", content: "I felt hurt when you cancelled on Saturday." },
  { sender_role: "partner", content: "ok. anyway what time is the game" },
  { sender_role: "user", content: "Can we talk about Saturday first?" },
  { sender_role: "partner", content: "not now. pizza tonight?" },
  { sender_role: "user", content: "I really want to sort this out." },
];
const T9: Msg[] = [
  { sender_role: "partner", content: "You forgot to pay the electric bill again." },
  { sender_role: "user", content: "I've been swamped, I'm sorry." },
  { sender_role: "partner", content: "It's the third time this year." },
  { sender_role: "user", content: "I know. I'll sort it tonight." },
];
export const SEMANTIC_FIXTURES_4: Fx4[] = [
  { id: "t1-v2-adjudicated", parts: TA, msgs: T1, items: [
    it4("cs.p1.0", "p1", "p2", "suggestion", "When a comment stings, say that it stung instead of closing the topic.", "keep", "Taylor closed the topic"),
    it4("cs.p1.1", "p1", "p2", "suggestion", "Try voicing your frustration without the all-or-nothing word that makes it sound like a verdict.", "withhold", "absolutes were Alex's"),
    it4("cs.p2.0", "p2", "p1", "suggestion", "Next time, stay in the conversation instead of brushing it off and moving to logistics.", "ambiguous", "see adjudication: right speaker for line 4, weak/misleading support"),
    it4("cs.p2.1", "p2", "p1", "suggestion", "Ask for help with planning as a specific request rather than a statement about their character.", "keep", "Alex generalised"),
    it4("step.0", "p1", "p2", "step", "Together, pick one evening this week to plan the next few days.", "keep", "joint plan"),
  ] },
  { id: "t8-brushoff-unambiguous", parts: AB, msgs: T8, items: [
    it4("cs.p2.0", "p2", "p1", "suggestion", "Stay with the topic instead of brushing it off and moving to plans.", "keep", "Blake deflected twice"),
    it4("cs.p1.0", "p1", "p2", "suggestion", "Stay with the topic instead of brushing it off and moving to plans.", "withhold", "Avery kept returning to the topic"),
    it4("cs.p1.1", "p1", "p2", "suggestion", "If now doesn't work for them, ask for a specific time to talk about Saturday.", "keep", "future request responding to Blake's deflection"),
    it4("cs.p2.1", "p2", "p1", "suggestion", "If now isn't a good time, say when you can talk about it.", "keep", "future step for Blake"),
  ] },
  { id: "t9-bills-future", parts: EF, msgs: T9, items: [
    it4("cs.p1.0", "p1", "p2", "suggestion", "Set up a reminder or autopay so the bill doesn't slip again.", "keep", "Emery missed the bill"),
    it4("cs.p2.0", "p2", "p1", "suggestion", "Set up autopay so you stop forgetting the bill.", "withhold", "Finley did not forget"),
    it4("cs.p2.1", "p2", "p1", "suggestion", "Ask what would help with the bills, alongside naming how often it has happened.", "keep", "future request for Finley"),
    it4("cs.p1.1", "p1", "p2", "suggestion", "Stop keeping score of how many times things went wrong.", "withhold", "Finley kept count"),
    it4("step.0", "p1", "p2", "step", "Agree together who owns which bills.", "keep", "joint plan"),
  ] },
];

// ---------------------------------------------------------------------------
// External benchmark ext-1 (2026-09-27). Authored by Codex outside the
// implementation session from product requirements (not human/clinical
// adjudication). Frozen verbatim in prompt_datasets BEFORE the first model
// call; labels/notes are never sent to the checker. Message mN -> index N-1.
// Item ids are canonical (cs.<recipient>.<n>, step.<n> for joint plans);
// `ext` is the owner's label (A1..F3). Do not edit: fixes need a new version.
const m = (role: "p1" | "p2", content: string): Msg => ({ sender_role: role === "p1" ? "user" : "partner", content });
const P = (a: string, b: string): Participant[] => [{ id: "p1", label: a, role: "user" }, { id: "p2", label: b, role: "partner" }];
const ex = (ext: string, id: string, rid: string, kind: AdviceItem["kind"], text: string, expect: "keep" | "withhold", note: string) =>
  ({ ext, id, path: [id], recipient_id: rid, counterpart_ids: [rid === "p1" ? "p2" : "p1"], kind, text, expect, note });
export const EXTERNAL_BENCHMARK_1 = {
  name: "advice-external-ext-1",
  author: "Codex (external to implementation session); not independent human/clinical adjudication",
  fixtures: [
    { id: "ext-A", parts: P("Nora", "Eli"), msgs: [m("p1", "Can we settle who books the train?"), m("p2", "You always make a big deal of everything."), m("p1", "I need a yes or no so I can plan."), m("p2", "Stop being dramatic.")], items: [
      ex("A1", "cs.p1.0", "p1", "suggestion", "Stop dismissing their practical questions as drama.", "withhold", "asserted past dismissal belongs to p2"),
      ex("A2", "cs.p2.0", "p2", "suggestion", "Answer the practical question without dismissing their concern.", "keep", ""),
      ex("A3", "cs.p1.1", "p1", "suggestion", "State when you need the answer and what you will do if it does not arrive.", "keep", "future step grounded in planning"),
    ] },
    { id: "ext-B", parts: P("Sam", "Sam"), msgs: [m("p1", "I'm sorry I cancelled at the last minute."), m("p2", "Thanks for acknowledging it."), m("p1", "Next time I'll tell you as soon as I know.")], items: [
      ex("B1", "cs.p2.0", "p2", "suggestion", "Follow through on your promise to give earlier notice.", "withhold", "promise belongs to p1"),
      ex("B2", "cs.p1.0", "p1", "suggestion", "Follow through on your promise to give earlier notice.", "keep", ""),
      ex("B3", "cs.p2.1", "p2", "suggestion", "Explain how much notice would help you plan.", "keep", "forward-looking"),
    ] },
    { id: "ext-C", parts: P("Dev", "Jo"), msgs: [m("p1", "My brother said, 'You're impossible to please.'"), m("p2", "That sounds painful. What happened?"), m("p1", "He didn't want to discuss it.")], items: [
      ex("C1", "cs.p1.0", "p1", "suggestion", "Stop calling your partner impossible to please.", "withhold", "quoted third-party words are not p1 behaviour toward p2"),
      ex("C2", "cs.p2.0", "p2", "suggestion", "Ask whether they want listening or suggestions before offering advice.", "keep", ""),
      ex("C3", "cs.p2.1", "p2", "suggestion", "Apologize for calling them impossible to please.", "withhold", "no such action by p2"),
    ] },
    { id: "ext-D", parts: P("Inez", "Bo"), msgs: [m("p1", "We're both exhausted after work."), m("p2", "Yes, let's discuss the budget on Saturday."), m("p1", "Saturday morning works.")], items: [
      ex("D1", "step.0", "p1", "step", "Set aside a short Saturday check-in and let each person finish speaking.", "keep", "joint future plan, no existing interruption asserted"),
      ex("D2", "cs.p1.0", "p1", "suggestion", "Stop interrupting whenever money comes up.", "withhold", "unsupported past behaviour"),
      ex("D3", "cs.p2.0", "p2", "suggestion", "Bring one budget question to the Saturday conversation.", "keep", ""),
    ] },
    { id: "ext-E", parts: P("Lee", "Rae"), msgs: [m("p2", "I can pick you up at six."), m("p1", "Thanks, that works."), m("p2", "I'm running late; it will be six-thirty."), m("p1", "Please let me know earlier next time.")], items: [
      ex("E1", "cs.p1.0", "p1", "suggestion", "Give earlier updates when your pickup time changes.", "withhold", "changed pickup commitment belongs to p2"),
      ex("E2", "cs.p2.0", "p2", "suggestion", "Send an update as soon as you know the pickup time has changed.", "keep", ""),
      ex("E3", "cs.p1.1", "p1", "suggestion", "Agree on a backup plan together if timing changes again.", "keep", ""),
    ] },
    { id: "ext-F", parts: P("Uma", "Zed"), msgs: [m("p1", "Could we talk about what happened?"), m("p2", "Not tonight. I need some time."), m("p1", "Okay. Can you suggest another time tomorrow?")], items: [
      ex("F1", "cs.p1.0", "p1", "suggestion", "When you ask for space, offer a time to reconnect.", "withhold", "request for space belongs to p2"),
      ex("F2", "cs.p2.0", "p2", "suggestion", "Offer a time to reconnect after asking for space.", "keep", ""),
      ex("F3", "cs.p1.1", "p1", "suggestion", "Give them the requested space while keeping your request for a return time clear.", "keep", ""),
    ] },
  ],
};
