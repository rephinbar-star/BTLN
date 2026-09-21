import type { ExampleMessage } from "@/lib/examples/sourceFixtures";
import type { R360Data } from "@/lib/relationship360/types";

const m = (id: string, sender: string, text: string, ts: string): ExampleMessage => ({ id, sender, text, ts });

/**
 * One fictional person, "Rae", across three relationships and three periods.
 * Every piece of evidence below points at a message in these fixtures, so the
 * preview can never quote something the sample does not contain.
 */
export const relationship360Preview: R360Data = {
  periods: [
    { id: "p1", label: "March 2026", range: "6–21 March 2026" },
    { id: "p2", label: "June 2026", range: "2–14 June 2026" },
    { id: "p3", label: "September 2026", range: "12–20 September 2026" },
  ],

  relationships: [
    { id: "r-sam", label: "Sam", scope: "pair", context: "romantic" },
    { id: "r-priya", label: "Priya", scope: "pair", context: "friend" },
    { id: "r-family", label: "Family group", scope: "group", context: "family" },
  ],
  sources: [
    {
      id: "s1",
      relationshipId: "r-sam",
      periodId: "p1",
      product: "Quick Take",
      label: "Dating — plans for the weekend",
      observedRange: "6–7 March 2026",
      messages: [
        m("s1m1", "Rae", "Are we still on for Saturday? Totally fine if not.", "2026-03-06T18:02:00Z"),
        m("s1m2", "Sam", "Work is heavy this week.", "2026-03-06T19:40:00Z"),
        m("s1m3", "Rae", "No worries at all, whatever suits you.", "2026-03-06T19:44:00Z"),
        m("s1m4", "Rae", "I'll just plan something else then.", "2026-03-06T19:45:00Z"),
        m("s1m5", "Sam", "I didn't say no.", "2026-03-06T20:10:00Z"),
        m("s1m6", "Rae", "Sorry, I assumed. Saturday still works for me.", "2026-03-06T20:14:00Z"),
        m("s1m7", "Sam", "Then let's keep it.", "2026-03-07T08:20:00Z"),
      ],
    },
    {
      id: "s2",
      relationshipId: "r-priya",
      periodId: "p1",
      product: "Quick Take",
      label: "Friendship — moving weekend",
      observedRange: "21 March 2026",
      messages: [
        m("s2m1", "Rae", "Could you help me move on Sunday? Only if you're free.", "2026-03-21T09:10:00Z"),
        m("s2m2", "Priya", "I have a thing in the morning.", "2026-03-21T09:26:00Z"),
        m("s2m3", "Rae", "Forget it, I'll manage on my own.", "2026-03-21T09:28:00Z"),
        m("s2m4", "Priya", "I meant I'm free from two.", "2026-03-21T09:33:00Z"),
        m("s2m5", "Rae", "Oh. Two is perfect, thank you.", "2026-03-21T09:35:00Z"),
      ],
    },
    {
      id: "s3",
      relationshipId: "r-sam",
      periodId: "p2",
      product: "Deep Read",
      label: "Dating — a month of planning",
      observedRange: "2–14 June 2026",
      messages: [
        m("s3m1", "Rae", "Dinner Thursday? If you're too tired we can skip it.", "2026-06-02T17:05:00Z"),
        m("s3m2", "Sam", "Thursday is tight.", "2026-06-02T18:22:00Z"),
        m("s3m3", "Rae", "Okay, dropping it.", "2026-06-02T18:24:00Z"),
        m("s3m4", "Sam", "Again — I wasn't turning you down.", "2026-06-02T18:40:00Z"),
        m("s3m5", "Rae", "You're right. Can we do Friday instead?", "2026-06-02T18:47:00Z"),
        m("s3m6", "Sam", "Friday works.", "2026-06-02T18:51:00Z"),
        m("s3m7", "Rae", "Thursday or Friday for the film — which do you prefer?", "2026-06-11T10:02:00Z"),
        m("s3m8", "Sam", "Friday. Thanks for asking straight out.", "2026-06-11T10:19:00Z"),
        m("s3m9", "Rae", "Noted. I'll book it.", "2026-06-11T10:21:00Z"),
        m("s3m10", "Sam", "This is much easier than the guessing.", "2026-06-14T20:12:00Z"),
      ],
    },
    {
      id: "s4",
      relationshipId: "r-family",
      periodId: "p2",
      product: "Group Read",
      label: "Family group — birthday plan",
      observedRange: "8–9 June 2026",
      messages: [
        m("s4m1", "Mum", "Are we doing anything for Dad's birthday?", "2026-06-08T11:00:00Z"),
        m("s4m2", "Rae", "I'd like to. Sunday lunch at mine — does that work for everyone?", "2026-06-08T11:06:00Z"),
        m("s4m3", "Noor", "Sunday is fine for me.", "2026-06-08T11:12:00Z"),
        m("s4m4", "Mum", "Sunday works.", "2026-06-08T11:20:00Z"),
        m("s4m5", "Rae", "Booked in. I'll cook, Noor brings dessert?", "2026-06-08T11:24:00Z"),
        m("s4m6", "Noor", "Deal.", "2026-06-08T11:31:00Z"),
        m("s4m7", "Mum", "You two sorted that quickly.", "2026-06-09T08:02:00Z"),
      ],
    },
    {
      id: "s5",
      relationshipId: "r-sam",
      periodId: "p3",
      product: "Quick Take",
      label: "Dating — a change of plan",
      observedRange: "12 September 2026",
      messages: [
        m("s5m1", "Sam", "I might be late Friday.", "2026-09-12T12:00:00Z"),
        m("s5m2", "Rae", "Thanks for telling me. Do you want to keep Friday, or move it to Sunday?", "2026-09-12T12:06:00Z"),
        m("s5m3", "Sam", "Keep Friday, I'll message when I leave.", "2026-09-12T12:09:00Z"),
        m("s5m4", "Rae", "Good. I'll eat late then.", "2026-09-12T12:11:00Z"),
      ],
    },
    {
      id: "s6",
      relationshipId: "r-priya",
      periodId: "p3",
      product: "Quick Take",
      label: "Friendship — checking in",
      observedRange: "20 September 2026",
      messages: [
        m("s6m1", "Priya", "Been quiet lately, you okay?", "2026-09-20T15:00:00Z"),
        m("s6m2", "Rae", "Bit flat, honestly. Coffee this week would help.", "2026-09-20T15:08:00Z"),
        m("s6m3", "Priya", "Wednesday?", "2026-09-20T15:10:00Z"),
        m("s6m4", "Rae", "Wednesday. Thank you for asking.", "2026-09-20T15:12:00Z"),
      ],
    },
  ],
  patterns: [
    {
      id: "pat-notice",
      state: "again",
      observedRange: "6 March – 2 June 2026",
      question: "noticing",
      title: "You withdraw a request before the other person has answered it",
      statement:
        "In several conversations you offered an exit before anyone declined, then treated a neutral reply as a refusal.",
      introspection: {
        openingQuestion: "What was happening for you when you closed the invitation before they answered?",
        paths: [
          {
            label: "Avoiding a possible no",
            questions: [
              "Did stepping back feel easier than waiting for an answer? If so, what would a no have meant to you—disappointment, rejection, or something else?",
            ],
            evidenceRefs: [
              { sourceId: "s1", messageId: "s1m1" },
              { sourceId: "s1", messageId: "s1m4" },
            ],
          },
          {
            label: "Wanting clarity",
            questions: [
              "Were you frustrated by the uncertainty? What did you need from them at that moment? If anger was present, what was it responding to?",
            ],
            evidenceRefs: [
              { sourceId: "s1", messageId: "s1m2" },
              { sourceId: "s2", messageId: "s2m2" },
            ],
          },
        ],
        closingQuestion:
          "Does either explanation fit, or was something else going on? What did ending the invitation give you in the moment, and did it help you get what you wanted?",
        focusedReflection:
          "Before the next plan changes, notice what you feel, what you are assuming, and what answer you actually need.",
        suggestedNextStepId: "rec-1",
        selfReportedReflection:
          "Avoiding a no doesn't fit this time. I was tired of not knowing whether the plan was happening.",
      },
      evidence: [
        { sourceId: "s1", messageId: "s1m1" },
        { sourceId: "s1", messageId: "s1m4" },
        { sourceId: "s2", messageId: "s2m3" },
      ],
      confidence: "medium",
      limitation: "Based on the included conversations only. Tone and voice notes are not covered.",
    },
    {
      id: "pat-repeat",
      state: "again",
      observedRange: "March and June 2026",
      question: "repeating",
      title: "The same withdrawal happens in more than one period",
      statement:
        "The pattern appears in March and again in June, in separate conversations rather than one long argument.",
      introspection: {
        openingQuestion: "What feels familiar about the moment just before you withdraw the request?",
        paths: [
          {
            label: "Reducing uncertainty quickly",
            questions: [
              "Does cancelling settle the uncertainty faster, even when it also removes the chance of getting a clear answer? What would help you stay with the question a little longer?",
            ],
            evidenceRefs: [
              { sourceId: "s1", messageId: "s1m4" },
              { sourceId: "s3", messageId: "s3m3" },
            ],
          },
        ],
        closingQuestion:
          "What does withdrawing solve in the moment, and what becomes harder to communicate when it happens repeatedly?",
        focusedReflection: "Name the answer you need before changing the plan yourself.",
        suggestedNextStepId: "rec-2",
      },
      evidence: [
        { sourceId: "s1", messageId: "s1m4" },
        { sourceId: "s3", messageId: "s3m3" },
      ],
      confidence: "medium",
      limitation: "Two independent periods. A third would make the recurrence clearer.",
      requiresPeriods: 2,
    },
    {
      id: "pat-change",
      state: "different",
      observedRange: "11 June – 12 September 2026",
      question: "changed",
      title: "You started asking directly instead of retreating",
      statement:
        "From mid-June onward you put the choice into the message itself, and in September you asked about the plan rather than cancelling it.",
      introspection: {
        openingQuestion: "What helped you leave the question open long enough for the other person to answer?",
        paths: [
          {
            label: "Directness as a useful strategy",
            questions: [
              "Did offering two clear options feel more honest, calmer, or simply more practical? What made that approach fit these conversations?",
            ],
            evidenceRefs: [
              { sourceId: "s3", messageId: "s3m7" },
              { sourceId: "s5", messageId: "s5m2" },
            ],
          },
        ],
        closingQuestion:
          "Which part of this approach would you want to keep, and where might a firm boundary be more useful than leaving options open?",
        focusedReflection: "Keep the clear choice when flexibility is useful; state a boundary plainly when it is not.",
        suggestedNextStepId: "rec-3",
      },
      evidence: [
        { sourceId: "s3", messageId: "s3m7" },
        { sourceId: "s5", messageId: "s5m2" },
      ],
      confidence: "medium",
      limitation:
        "The June and September conversations are shorter than the March one, so coverage is not identical.",
      requiresPeriods: 2,
    },
    {
      id: "pat-across",
      state: "again",
      observedRange: "March – June 2026",
      exception: "The family group is the exception: there you named a specific option first, and the plan held.",
      question: "across",
      title: "It shows up with a partner and with a friend, but not in the family group",
      statement:
        "The withdrawal appears with Sam and with Priya. In the family group you named the plan and held it.",
      introspection: {
        openingQuestion: "What was different for you in the family conversation, where you named the plan and kept it in place?",
        paths: [
          {
            label: "A clear plan may have been the boundary",
            questions: [
              "Did having a specific time and place make it easier to be direct? Was holding the plan a deliberate boundary, an act of care for the group, or simply the most practical choice?",
            ],
            evidenceRefs: [{ sourceId: "s4", messageId: "s4m2" }],
          },
        ],
        closingQuestion:
          "What fits about that explanation, what does not, and what else helped you stay clear without withdrawing?",
        focusedReflection: "Notice which conditions make direct communication feel useful rather than risky.",
        suggestedNextStepId: "rec-3",
      },
      counterexample:
        "In the family group you proposed Sunday lunch outright and confirmed it once two people agreed.",
      evidence: [
        { sourceId: "s2", messageId: "s2m3" },
        { sourceId: "s1", messageId: "s1m4" },
        { sourceId: "s4", messageId: "s4m2" },
      ],
      confidence: "medium",
      limitation: "Three relationships are included. This does not describe relationships you have not added.",
      requiresRelationships: 2,
    },
  ],
  working: [
    {
      id: "w1",
      statement: "When you state a plan plainly, it gets settled in a few messages and nobody has to guess.",
      evidence: [
        { sourceId: "s4", messageId: "s4m5" },
        { sourceId: "s3", messageId: "s3m9" },
      ],
    },
    {
      id: "w2",
      statement: "You now say what you actually want when a friend checks in, instead of closing the subject.",
      evidence: [{ sourceId: "s6", messageId: "s6m2" }],
    },
  ],
  recommendations: [
    {
      id: "rec-1",
      type: "communication",
      observation: "You add an exit clause to a request and then act on the exit yourself.",
      action:
        "Ask the question and stop there — one message, one choice, no pre-emptive withdrawal. Wait for the reply before adjusting the plan.",
      why: "In the conversations where you did this, the other person answered with a concrete option instead of a delay.",
      evidence: [
        { sourceId: "s3", messageId: "s3m7" },
        { sourceId: "s3", messageId: "s3m8" },
      ],
      selfReport: { used: true, note: "Self-reported: \"Used it in September. Sam answered straight away.\"" },
    },
    {
      id: "rec-2",
      type: "behavioral",
      observation: "A short neutral reply from the other person is followed within minutes by you cancelling.",
      action:
        "When a reply reads as flat, leave the plan in place until the following day before changing anything.",
      why: "Twice the neutral reply was not a refusal, and the plan survived once it was clarified.",
      evidence: [
        { sourceId: "s1", messageId: "s1m5" },
        { sourceId: "s2", messageId: "s2m4" },
      ],
    },
    {
      id: "rec-3",
      type: "communication",
      observation: "The family group settles plans quickly when you name a specific option.",
      action: "Carry the same two-option phrasing into the conversations where you tend to retreat.",
      why: "The direct version already produced a decision in the same week it was used.",
      evidence: [
        { sourceId: "s4", messageId: "s4m2" },
        { sourceId: "s5", messageId: "s5m2" },
      ],
    },
  ],
  comparisons: [
    {
      id: "cmp-1",
      earlierPeriodId: "p1",
      laterPeriodId: "p3",
      then: {
        observation: "You offered a way out in the same message as the invitation, then cancelled before Sam had answered.",
        coverage: "March 2026 · 2 conversations · 12 messages",
        evidence: [
          { sourceId: "s1", messageId: "s1m1" },
          { sourceId: "s1", messageId: "s1m4" },
        ],
      },
      now: {
        observation: "You kept the plan on the table and asked Sam to choose between two options.",
        coverage: "September 2026 · 2 conversations · 8 messages",
        evidence: [
          { sourceId: "s5", messageId: "s5m2" },
          { sourceId: "s6", messageId: "s6m2" },
        ],
      },
      note: "September has fewer messages than March, so this compares how you opened each plan, not how often.",
    },
  ],
  metrics: [
    {
      id: "met-1",
      label: "Plans you withdrew before the other person replied",
      unit: "conversations",
      then: { periodId: "p1", value: 2, of: 2 },
      now: { periodId: "p3", value: 0, of: 2 },
      missingData: "Counted only in the included conversations. Calls and voice notes are not counted.",
    },
  ],
};
