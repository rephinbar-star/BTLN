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
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== day) return null;
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
export type DayOrder = "day_first" | "month_first" | "ambiguous" | "conflict";

/**
 * One rule for the whole export. A value above 12 proves which field is the
 * day. If no value proves it the order is "ambiguous"; if values prove BOTH
 * orders the export is "conflict". Neither case yields dates — unknown stays
 * unknown until the person clarifies (which is then labelled self-reported).
 */
export const resolveDayOrder = (parts: { a: number; b: number }[]): DayOrder => {
  const aDay = parts.some((p) => p.a > 12);
  const bDay = parts.some((p) => p.b > 12);
  if (aDay && bDay) return "conflict";
  if (aDay) return "day_first";
  if (bDay) return "month_first";
  return "ambiguous";
};

const ISO_STAMP = /^\s*\[?(\d{4})-(\d{2})-(\d{2})(?:[T ,]|\]|$)/;
const NUM_STAMP = /^\s*\[?(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;

/**
 * Resolves timestamp strings to ISO days using the shared rule above.
 * ISO (yyyy-mm-dd) stamps are unambiguous. The date is taken as written; any
 * time or zone offset is ignored and the timezone is reported as unknown.
 */
export const resolveStampDays = (stamps: (string | null)[]): { days: (string | null)[]; order: DayOrder | "iso" | "none" } => {
  const parsed = stamps.map((s) => {
    if (!s) return null;
    const iso = ISO_STAMP.exec(s);
    if (iso) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}` } as const;
    const m = NUM_STAMP.exec(s);
    if (!m) return null;
    return { a: Number(m[1]), b: Number(m[2]), y: Number(m[3].length === 2 ? `20${m[3]}` : m[3]) } as const;
  });
  const numeric = parsed.filter((p): p is { a: number; b: number; y: number } => Boolean(p && "a" in p));
  const order = numeric.length ? resolveDayOrder(numeric) : null;
  const days = parsed.map((p) => {
    if (!p) return null;
    if ("iso" in p) return isoDay(p.iso);
    if (order !== "day_first" && order !== "month_first") return null;
    const day = order === "month_first" ? p.b : p.a;
    const month = order === "month_first" ? p.a : p.b;
    return isoDay(`${String(p.y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  });
  const hasIso = parsed.some((p) => p && "iso" in p);
  return { days, order: order ?? (hasIso ? "iso" : "none") };
};

export const deriveDateMetaFromText = (text: string): DateMeta => {
  const lines = text.split(/\r?\n/).filter((raw) => raw.trim());
  const stamps = lines.map((raw) => (ISO_STAMP.test(raw) || /^\s*\[?\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}/.test(raw) ? raw : null));
  const { days: resolved, order } = resolveStampDays(stamps);
  const days = resolved.filter((d): d is string => Boolean(d)).sort();
  const undated = lines.length - days.length;
  const orderNote = order === "ambiguous"
    ? "Day and month order could not be established, so these dates are left unknown until you confirm them."
    : order === "conflict"
      ? "The export mixes day-first and month-first dates, so these dates are left unknown until you confirm them."
      : "";
  if (days.length === 0) {
    return { ...EMPTY_DATE_META, undated_count: undated, date_note: orderNote || null };
  }
  const notes = [
    undated > 0 ? `${undated} line(s) carried no usable date.` : "",
    orderNote,
    "Timestamps are taken as written in the export; the timezone is not independently known.",
  ].filter(Boolean);
  return {
    observed_start: days[0],
    observed_end: days[days.length - 1],
    dated_count: days.length,
    undated_count: undated,
    date_precision: "date",
    date_provenance: "parsed",
    timezone_ambiguous: true,
    date_note: notes.join(" ").slice(0, 400),
  };
};
