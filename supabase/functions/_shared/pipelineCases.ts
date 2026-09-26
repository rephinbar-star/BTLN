// Full-pipeline evaluation inputs and the live request each mode receives.
//
// These cases are sent to the DEPLOYED pipeline functions (extraction,
// validation, digest, attribution, persistence), not to a single model call.
// Group modes need at least 10 messages to be accepted by the live functions,
// so their cases extend the final-call cases with neutral lines; the
// adversarial content is unchanged.

import { CASES, type ModeCase, type ModeKey } from "./modeEval.ts";

export const PIPELINE_REVISION = "pipeline-cases-1";

/** Declared version labels of the live pipeline code paths (bumped by hand when the pipeline changes). */
export const PIPELINE_CODE_VERSIONS: Record<ModeKey, string> = {
  quick_take: "decode-conversation@2026-09-26.metered",
  interactive: "interactive-mode@2026-09-26.metered",
  deep_read_full: "analyze-conversation@2026-09-26.style-contract+attribution",
  group_read: "analyze-group@2026-09-26.metered",
  relationship360: "relationship360@2026-09-26.metered",
  group_roast: "analyze-group-roast@2026-09-26.metered",
};

export const FUNCTION_FOR: Record<ModeKey, string> = {
  quick_take: "decode-conversation",
  interactive: "interactive-mode",
  deep_read_full: "analyze-conversation",
  group_read: "analyze-group",
  relationship360: "relationship360",
  group_roast: "analyze-group-roast",
};

/** Model stages the live pipeline is expected to run for these inputs. */
export const EXPECTED_STAGES: Record<ModeKey, string[]> = {
  quick_take: ["primary"],
  interactive: ["primary"],
  deep_read_full: ["primary", "attribution"],
  group_read: ["primary"],
  relationship360: ["synthesis"],
  group_roast: ["digest", "primary"],
};

const PAD: [string, string][] = [
  ["Ana", "running 10 min late"], ["Ben", "no rush"], ["Cleo", "anyone need a lift?"], ["Dev", "I'm good thanks"],
  ["Ana", "ok see you all soon"],
];

const byId = (key: ModeKey, id: string) => CASES[key].find((c) => c.id === id)!;
const padded = (c: ModeCase): ModeCase => {
  const extra = PAD.slice(0, Math.max(0, 11 - c.messages.length)).map(([speaker, text], i) => ({ id: `pad${i + 1}`, speaker, text }));
  return { ...c, messages: [...extra, ...c.messages] };
};

/**
 * Long-history acceptance input: 10,000 dated WhatsApp-format lines between two
 * synthetic people across 2024, generated deterministically (no real data).
 * Exercises import parsing -> digest slices -> primary -> attribution ->
 * validation. Only the last 400 messages are attributed verbatim.
 */
export const LONG_HISTORY_COUNT = 10_000;
const LONG_SCRIPT: [0 | 1, string][] = [
  [0, "Did you book the train for Saturday?"], [1, "Not yet, I was waiting to hear if your sister is coming"],
  [0, "She said maybe, you know how she is"], [1, "Ok I'll book two and we can change it"],
  [0, "Thanks. Also can we talk about the rent thing tonight"], [1, "Sure, after dinner?"],
  [0, "I felt a bit brushed off yesterday when I brought it up"], [1, "That's fair, I was tired. I'm listening now"],
  [1, "Running late, sorry, 15 min"], [0, "No worries, I'll order for us"],
  [0, "You always say 15 and it's 40"], [1, "Ok that's true. I'll leave earlier next time"],
  [1, "Loved today btw"], [0, "Me too. The market was so good"],
  [0, "Can you call your mum back? She messaged me"], [1, "Yes, doing it now"],
];
export const longHistoryText = (a: string, b: string, n = LONG_HISTORY_COUNT) => {
  const out: string[] = [];
  const start = Date.UTC(2024, 0, 1, 8, 0);
  for (let i = 0; i < n; i++) {
    const t = new Date(start + i * 50 * 60_000); // every 50 min: ~347 days
    const d = `${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${t.getUTCFullYear()}, ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
    const [who, text] = LONG_SCRIPT[i % LONG_SCRIPT.length];
    out.push(`${d} - ${who === 0 ? a : b}: ${text}${i % LONG_SCRIPT.length === 0 ? ` (week ${Math.floor(i / 200) + 1})` : ""}`);
  }
  return out.join("\n");
};
const LONG_CASE: ModeCase = { id: "dr-long-10k", kind: "representative", purpose: "10,000-message dated import through digest, primary, attribution and validation", speakers: ["Taylor", "Alex"], messages: [], expect: {} } as ModeCase;

export const PIPELINE_CASES: Record<ModeKey, ModeCase[]> = {
  quick_take: [byId("quick_take", "qt-plan"), byId("quick_take", "qt-injection")],
  interactive: [byId("interactive", "int-followup"), byId("interactive", "int-injection")],
  deep_read_full: [byId("deep_read_full", "dr-attribution"), byId("deep_read_full", "dr-false-premise"), byId("deep_read_full", "dr-balanced"), LONG_CASE],
  group_read: [padded(byId("group_read", "grp-planning")), padded(byId("group_read", "grp-injection"))],
  // Relationship360 reads the owner's own confirmed sources; the case is the account's stored evidence.
  relationship360: [{ id: "r360-account-sources", kind: "representative", purpose: "the synthetic account's own confirmed, dated Deep Read sources", speakers: [], messages: [], expect: { no_trend: false } }],
  group_roast: [padded(CASES.group_roast[0]), padded(CASES.group_roast[1])],
};

const transcript = (c: ModeCase) => c.messages.map((m) => `${m.speaker}: ${m.text}`).join("\n");

/** Builds the exact request body the live function receives. */
export const pipelineRequest = (key: ModeKey, c: ModeCase, extra: { decodeId?: string } = {}): Record<string, unknown> => {
  const session_id = crypto.randomUUID();
  if (key === "quick_take") {
    return { session_id, source: "pipeline_eval", input: { raw_text: transcript(c), name1: c.speakers[0], name2: c.speakers[1] } };
  }
  if (key === "deep_read_full") {
    return { session_id, input_method: "paste", raw_text: c.id === LONG_CASE.id ? longHistoryText(c.speakers[0], c.speakers[1]) : transcript(c),
      context_data: { name1: c.speakers[0], name2: c.speakers[1], relationship_type: "romantic", goal: c.user_note ?? "Understand this exchange", free_text: c.user_note ?? "" } };
  }
  if (key === "interactive") {
    return { decode_id: extra.decodeId, client_request_id: crypto.randomUUID(), event_type: "observed_followup", action: "continue",
      raw_text: c.messages.map((m) => m.text).join("\n"), speaker_order: ["them"] };
  }
  const participants = c.speakers.map((s, i) => ({ id: `p${i + 1}`, display_name: s }));
  const messages = c.messages.map((m, i) => ({ participant_id: participants.find((p) => p.display_name === m.speaker)!.id, content: m.text, order: i + 1, ts: null }));
  if (key === "group_read") {
    return { session_id, category: "friends", participants, messages, identity_confirmation: { participant_id: "p1" } };
  }
  if (key === "group_roast") {
    return { consent: true, category: "friends", participants, messages, identity_confirmation: { participant_id: "p1" } };
  }
  return { action: "build", force: true };
};

/** Where the live function persists its result: table, id field in the 2xx response. */
export const RESULT_REF: Record<ModeKey, { table: string; idField: string; column: string } | null> = {
  quick_take: { table: "decodes", idField: "decode_id", column: "result_json" },
  deep_read_full: { table: "analyses", idField: "analysis_id", column: "result_json" },
  group_read: { table: "group_reads", idField: "group_read_id", column: "result_json" },
  group_roast: { table: "group_roasts", idField: "group_roast_id", column: "result_json" },
  interactive: { table: "interactive_events", idField: "event_id", column: "result_json" },
  relationship360: null, // synchronous: content is returned and read back from journey_summaries
};

/**
 * Replaces a case's fixed canary with an unseen per-run payload token, so an
 * evaluation cannot pass by recognising a known string. Adoption and leak are
 * then screened against the run's own token.
 */
export const withPayloadToken = (c: ModeCase, token: string | null | undefined): ModeCase => {
  const canary = c.expect.canary;
  if (!canary || !token) return c;
  const swap = (s: string) => s.split(canary).join(token);
  return { ...c, messages: c.messages.map((m) => ({ ...m, text: swap(m.text) })), expect: { ...c.expect, canary: token } };
};
