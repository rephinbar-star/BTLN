// Verified exchange dates and conversation identity, derived on the SERVER.
//
// Two honest rules drive this file:
//
//  1. Dates. The date a report was produced is not the date the exchange
//     happened. We keep only the minimum derived metadata — the observed range,
//     how many messages carried a date, how precise those dates are and where
//     they came from — and we keep it BEFORE the raw transcript is deleted.
//     Unknown stays unknown: nothing is inferred from upload time.
//
//  2. Conversation identity. A transcript hash is NOT a stable chat identity.
//     Two overlapping exports of the same chat hash differently, and two
//     different chats can look alike. So a key is minted only for the case we
//     can defend: a byte-identical re-import of the same conversation. Anything
//     weaker (matching names, similar content) is a SUGGESTION the person
//     confirms — never an automatic merge. The participant fingerprint stored
//     here is a one-way hash used to rank those suggestions; no phone number,
//     email or name is retained for matching.

export type IngestMessageLike = {
  order?: number;
  ts?: string | null;
  content?: string;
  raw_sender?: string | null;
  kind?: string | null;
};

export type DateMeta = {
  observed_start: string | null;
  observed_end: string | null;
  dated_count: number;
  undated_count: number;
  date_precision: "unknown" | "date" | "minute";
  date_provenance: "unknown" | "parsed" | "ocr_confirmed" | "user_supplied";
  timezone_ambiguous: boolean;
  date_note: string | null;
};

export const EMPTY_DATE_META: DateMeta = {
  observed_start: null,
  observed_end: null,
  dated_count: 0,
  undated_count: 0,
  date_precision: "unknown",
  date_provenance: "unknown",
  timezone_ambiguous: false,
  date_note: null,
};

const isoDay = (value: string): string | null => {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  // A conversation cannot have happened in the future, and dates before the
  // first mobile chat exports are treated as parse noise rather than history.
  const now = Date.now();
  if (time > now + 36 * 60 * 60 * 1000) return null;
  if (time < Date.parse("2000-01-01T00:00:00Z")) return null;
  return day;
};

/**
 * Derive the date metadata from the messages themselves. `provenance` describes
 * how those timestamps were obtained; screenshots that the person reviewed are
 * `ocr_confirmed`, a parsed export is `parsed`.
 */
export const deriveDateMeta = (
  messages: IngestMessageLike[],
  provenance: DateMeta["date_provenance"],
  opts: { ambiguous?: boolean } = {},
): DateMeta => {
  const days: string[] = [];
  let withMinute = 0;
  let undated = 0;
  for (const message of messages) {
    const ts = typeof message.ts === "string" ? message.ts : null;
    const day = ts ? isoDay(ts) : null;
    if (!day) {
      undated += 1;
      continue;
    }
    days.push(day);
    if (/\d{2}:\d{2}/.test(ts!)) withMinute += 1;
  }
  if (days.length === 0) {
    return { ...EMPTY_DATE_META, undated_count: undated };
  }
  days.sort();
  const notes: string[] = [];
  if (undated > 0) notes.push(`${undated} message(s) carried no readable date.`);
  if (opts.ambiguous) notes.push("Day and month order could not be established with certainty.");
  notes.push("Timestamps are taken as written in the export; the timezone is not independently known.");
  return {
    observed_start: days[0],
    observed_end: days[days.length - 1],
    dated_count: days.length,
    undated_count: undated,
    date_precision: withMinute > 0 ? "minute" : "date",
    date_provenance: provenance,
    timezone_ambiguous: true,
    date_note: notes.join(" ").slice(0, 400),
  };
};

const sha = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * A conversation key is minted ONLY for a byte-identical transcript, which is
 * the one case where "this is the same conversation" is demonstrable rather
 * than guessed. Returns null when the input is too small to identify.
 */
export const conversationKey = async (messages: IngestMessageLike[]): Promise<string | null> => {
  const ordered = [...messages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const body = ordered.map((m) => `${m.raw_sender ?? ""}\u0001${m.ts ?? ""}\u0001${m.content ?? ""}`).join("\u0002");
  if (ordered.length < 6 || body.length < 120) return null;
  return `tx:${(await sha(body)).slice(0, 40)}`;
};

/** One-way fingerprint of who is in the chat. Used only to rank suggestions. */
export const participantFingerprint = async (names: string[]): Promise<string | null> => {
  const cleaned = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))].sort();
  if (cleaned.length < 2) return null;
  return `pp:${(await sha(cleaned.join("\u0001"))).slice(0, 40)}`;
};

type MinimalClient = {
  from: (table: string) => {
    // deno-lint-ignore no-explicit-any
    upsert: (values: any, options?: any) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * Persist the derived metadata against the finished report. Called with the
 * service role, before the raw transcript is discarded. Never stores message
 * text: only counts, a range and one-way hashes.
 */
export const recordIngestMeta = async (
  admin: MinimalClient,
  input: {
    userId: string | null;
    sourceKind: "quick_take" | "deep_read" | "group_read" | "group_roast";
    sourceId: string;
    meta: DateMeta;
    conversationKey?: string | null;
    participantFingerprint?: string | null;
  },
): Promise<void> => {
  // user_id may be null: a report can be finished before it is claimed. The row
  // is keyed by source, so staging still finds it, and RLS keeps it unreadable
  // until an owner exists.
  const { error } = await admin.from("report_ingest_meta").upsert({
    user_id: input.userId,
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    conversation_key: input.conversationKey ?? null,
    participant_fingerprint: input.participantFingerprint ?? null,
    observed_start: input.meta.observed_start,
    observed_end: input.meta.observed_end,
    dated_count: input.meta.dated_count,
    undated_count: input.meta.undated_count,
    date_precision: input.meta.date_precision,
    date_provenance: input.meta.date_provenance,
    timezone_ambiguous: input.meta.timezone_ambiguous,
    date_note: input.meta.date_note,
  }, { onConflict: "source_kind,source_id" });
  if (error) console.error("ingest meta not recorded", error.message);
};

/**
 * Dates from a raw pasted/exported transcript, read on the server rather than
 * trusted from the client. Recognises the WhatsApp line prefixes we actually
 * support: "[dd/mm/yyyy, hh:mm:ss]" (iOS) and "dd/mm/yyyy, hh:mm - " (Android).
 * Lines without a readable date count as undated; nothing is inferred.
 */
export const deriveDateMetaFromText = (text: string): DateMeta => {
  const line = /^\s*\[?(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}:\d{2})/;
  const parts: { a: number; b: number; year: number }[] = [];
  let undated = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const match = line.exec(raw);
    if (!match) { undated += 1; continue; }
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    parts.push({ a: Number(match[1]), b: Number(match[2]), year });
  }
  if (parts.length === 0) return { ...EMPTY_DATE_META, undated_count: undated };
  // A value above 12 in the SECOND position proves the second field is the day,
  // so the first is the month. Otherwise day-first (the WhatsApp default here).
  const monthFirst = parts.some((p) => p.b > 12) && !parts.some((p) => p.a > 12);
  const ambiguous = !parts.some((p) => p.a > 12) && !parts.some((p) => p.b > 12);
  const days: string[] = [];
  for (const part of parts) {
    const day = monthFirst ? part.b : part.a;
    const month = monthFirst ? part.a : part.b;
    const iso = `${String(part.year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const valid = isoDay(iso);
    if (valid) days.push(valid); else undated += 1;
  }
  if (days.length === 0) return { ...EMPTY_DATE_META, undated_count: undated };
  days.sort();
  const notes = [
    undated > 0 ? `${undated} line(s) carried no readable date.` : "",
    ambiguous ? "Day and month order could not be established with certainty." : "",
    "Timestamps are taken as written in the export; the timezone is not independently known.",
  ].filter(Boolean);
  return {
    observed_start: days[0],
    observed_end: days[days.length - 1],
    dated_count: days.length,
    undated_count: undated,
    date_precision: "minute",
    date_provenance: "parsed",
    timezone_ambiguous: true,
    date_note: notes.join(" ").slice(0, 400),
  };
};
