/**
 * Deterministic chat-export parser shared by Deep Read and Group Read.
 *
 * No AI is used to extract structure — exports are already structured. Senders
 * and timestamps are never guessed: a line we cannot attribute stays
 * unattributed, and a message with no reliable time keeps ts = null.
 */

import { LIMITS } from "./limits";

export type MessageKind = "message" | "attachment" | "system" | "deleted";

export type IngestMessage = {
  participant_id: string | null;
  raw_sender: string | null;
  content: string;
  /** ISO string when the export carried a parseable time, else null. */
  ts: string | null;
  kind: MessageKind;
  order: number;
};

export type IngestParticipant = {
  id: string;
  display_name: string;
  aliases: string[];
  message_count: number;
  excluded: boolean;
  is_self: boolean;
  looks_like_system: boolean;
};

export type IngestFormat =
  | "whatsapp_ios"
  | "whatsapp_android"
  | "imessage_csv"
  | "imessage_txt"
  | "attributed_text";

export type IngestResult = {
  format: IngestFormat;
  participants: IngestParticipant[];
  messages: IngestMessage[];
  unattributed_count: number;
  system_count: number;
  attachment_count: number;
  deleted_count: number;
  /** True when at least one date could be read as either d/m or m/d. */
  ambiguous_dates: boolean;
  /** The interpretation actually used. */
  day_first: boolean;
  /** True when the export gave no timezone, so times are read as local-naive. */
  timezone_assumed: boolean;
  date_range: { start: string | null; end: string | null };
  messages_with_time: number;
  truncated_at_limit: boolean;
  warnings: string[];
};

export class UnsupportedFormatError extends Error {}

export type ParseOptions = {
  /** Force day-first (true) or month-first (false) reading of ambiguous dates. */
  dayFirst?: boolean;
};

const SYSTEM_HINTS = [
  "bot",
  "system",
  "whatsapp",
  "meta ai",
  "notification",
  "automated",
  "reminder",
  "zapier",
  "slackbot",
  "webhook",
];

const ATTACHMENT_RE =
  /^(<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|gif omitted|document omitted|<attached:.*>|.*\.(jpg|jpeg|png|webp|opus|mp4|pdf) ?\(file attached\))$/i;
const DELETED_RE =
  /^(this message was deleted|you deleted this message|message deleted)\.?$/i;
// [12/03/2024, 19:04:11] Sam: hi   /   [2024-03-12, 7:04:11 PM] Sam: hi
const WA_BRACKET =
  /^\[(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s?[APap]\.?[Mm]\.?)?)\]\s*(?:([^:]{1,60}):\s?)?([\s\S]*)$/;
// 12/03/2024, 19:04 - Sam: hi
const WA_DASH =
  /^(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s?[APap]\.?[Mm]\.?)?)\s+[-–]\s+(?:([^:]{1,60}):\s?)?([\s\S]*)$/;
// Sam: hi
const PLAIN = /^([^:\n]{1,40}):\s?([\s\S]*)$/;
// 19:04 Sam: hi
const TIME_PREFIX = /^(\d{1,2}:\d{2})\s+([^:\n]{1,40}):\s?([\s\S]*)$/;
// Mar 12, 2024  7:04:11 PM   (iMessage text exporters)
const IMSG_DATE =
  /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s?[APap][Mm])$/;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export const stripInvisibles = (s: string) =>
  s.replace(/[\u200e\u200f\u202a-\u202e\u00a0]/g, (c) => (c === "\u00a0" ? " " : ""));

export const normaliseKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

type DateParts = { a: number; b: number; c: number };

const splitDate = (date: string): DateParts | null => {
  const m = date.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
  if (!m) return null;
  return { a: +m[1], b: +m[2], c: +m[3] };
};

const parseTime = (time: string) => {
  const t = time.trim().toLowerCase().replace(/\./g, ":");
  const pm = /p:?m:?$/.test(t) || /pm$/.test(time.trim().toLowerCase());
  const am = /a:?m:?$/.test(t) || /am$/.test(time.trim().toLowerCase());
  const parts = t.replace(/\s?[ap]:?m:?$/, "").split(":").map(Number);
  let hour = parts[0] ?? 0;
  const min = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  return { hour, min, sec };
};

const buildIso = (y: number, mo: number, d: number, time: string): string | null => {
  const { hour, min, sec } = parseTime(time);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hour > 23 || min > 59) return null;
  const year = y < 100 ? 2000 + y : y;
  const dt = new Date(Date.UTC(year, mo - 1, d, hour, min, sec));
  return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
};

type Raw = {
  sender: string | null;
  content: string;
  date: DateParts | null;
  time: string | null;
  kind: MessageKind;
};

const classify = (content: string): MessageKind => {
  const c = content.trim();
  if (ATTACHMENT_RE.test(c)) return "attachment";
  if (DELETED_RE.test(c)) return "deleted";
  return "message";
};

// ---------------------------------------------------------------- CSV ------

/** RFC4180-ish splitter: handles quoted delimiters, quoted newlines and "" escapes. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const COL_DATE = ["date", "timestamp", "time", "datetime", "message date", "date read"];
const COL_SENDER = ["sender", "from", "sender name", "who", "name", "contact", "handle", "sender_name"];
const COL_TEXT = ["text", "message", "body", "content", "message body"];
const COL_DIRECTION = ["is_from_me", "isfromme", "type", "direction", "sent/received"];

const findCol = (header: string[], names: string[]) =>
  header.findIndex((h) => names.includes(h.trim().toLowerCase()));

const isoFromLoose = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)/);
  if (iso) return buildIso(+iso[1], +iso[2], +iso[3], iso[4]);
  const named = v.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}),? (\d{4})[, ]+(\d{1,2}:\d{2}(?::\d{2})?\s?[APap][Mm]?)/);
  if (named) {
    const mo = MONTHS[named[1].toLowerCase()];
    if (mo) return buildIso(+named[3], mo, +named[2], named[4]);
  }
  return null;
};

function parseImessageCsv(text: string): { raws: Raw[]; selfLabels: Set<string> } | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const header = rows[0];
  const dateIdx = findCol(header, COL_DATE);
  const textIdx = findCol(header, COL_TEXT);
  const senderIdx = findCol(header, COL_SENDER);
  const dirIdx = findCol(header, COL_DIRECTION);
  if (textIdx === -1 || (senderIdx === -1 && dirIdx === -1)) return null;

  const raws: Raw[] = [];
  const selfLabels = new Set<string>();
  for (const r of rows.slice(1)) {
    const content = (r[textIdx] ?? "").trim();
    if (!content) continue;
    let sender = senderIdx >= 0 ? (r[senderIdx] ?? "").trim() : "";
    if (!sender && dirIdx >= 0) {
      const d = (r[dirIdx] ?? "").trim().toLowerCase();
      const fromMe = d === "1" || d === "true" || d === "sent" || d === "me" || d === "outgoing";
      sender = fromMe ? "Me" : "Them";
    } else if (dirIdx >= 0) {
      const d = (r[dirIdx] ?? "").trim().toLowerCase();
      if (d === "1" || d === "true" || d === "sent" || d === "me" || d === "outgoing") {
        selfLabels.add(sender);
      }
    }
    const isoStr = dateIdx >= 0 ? isoFromLoose(r[dateIdx] ?? "") : null;
    raws.push({
      sender: sender || null,
      content,
      date: null,
      time: null,
      kind: classify(content),
      // pre-resolved timestamp smuggled through `time` as a full ISO
      ...(isoStr ? { iso: isoStr } : {}),
    } as Raw & { iso?: string });
  }
  return raws.length >= 2 ? { raws, selfLabels } : null;
}

function parseImessageTxt(text: string): Raw[] | null {
  const lines = text.split("\n");
  const raws: Raw[] = [];
  let i = 0;
  let matched = 0;
  while (i < lines.length) {
    const head = lines[i].trim();
    const m = head.match(IMSG_DATE);
    if (!m) {
      i++;
      continue;
    }
    const sender = (lines[i + 1] ?? "").trim();
    if (!sender || sender.length > 60) {
      i++;
      continue;
    }
    const body: string[] = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().length > 0 && !IMSG_DATE.test(lines[j].trim())) {
      body.push(lines[j]);
      j++;
    }
    const content = body.join("\n").trim();
    if (content) {
      matched++;
      const mo = MONTHS[m[1].toLowerCase()];
      const iso = mo ? buildIso(+m[3], mo, +m[2], m[4]) : null;
      raws.push({
        sender,
        content,
        date: null,
        time: null,
        kind: classify(content),
        ...(iso ? { iso } : {}),
      } as Raw & { iso?: string });
    }
    i = j;
  }
  return matched >= 3 ? raws : null;
}

// ------------------------------------------------------------ line parse ---

function parseLineBased(text: string): { raws: Raw[]; format: IngestFormat } {
  const lines = text.split("\n");
  const raws: Raw[] = [];
  let format: IngestFormat = "attributed_text";

  const push = (r: Raw) => raws.push(r);

  for (const rawLine of lines) {
    const line = stripInvisibles(rawLine).trimEnd();
    if (line.trim().length === 0) continue;
    const trimmed = line.trim();

    let m = trimmed.match(WA_BRACKET);
    if (m) {
      if (format === "attributed_text") format = "whatsapp_ios";
      const sender = m[3]?.trim() ?? null;
      const content = m[4] ?? "";
      push({
        sender: sender || null,
        content: content.trim(),
        date: splitDate(m[1]),
        time: m[2],
        kind: !sender ? "system" : classify(content),
      });
      continue;
    }

    m = trimmed.match(WA_DASH);
    if (m) {
      if (format === "attributed_text" || format === "whatsapp_ios") format = "whatsapp_android";
      const sender = m[3]?.trim() ?? null;
      const content = m[4] ?? "";
      push({
        sender: sender || null,
        content: content.trim(),
        date: splitDate(m[1]),
        time: m[2],
        kind: !sender ? "system" : classify(content),
      });
      continue;
    }

    m = trimmed.match(TIME_PREFIX);
    if (m) {
      push({
        sender: m[2].trim(),
        content: m[3].trim(),
        date: null,
        time: null,
        kind: classify(m[3]),
      });
      continue;
    }

    m = trimmed.match(PLAIN);
    if (m && !/^https?$/i.test(m[1].trim())) {
      push({
        sender: m[1].trim(),
        content: m[2].trim(),
        date: null,
        time: null,
        kind: classify(m[2]),
      });
      continue;
    }

    // Continuation of the previous message (multiline entry), otherwise a line
    // we cannot attribute — kept, never guessed.
    const prev = raws[raws.length - 1];
    if (prev && prev.sender !== null) {
      prev.content = `${prev.content}\n${trimmed}`.slice(0, LIMITS.MAX_MESSAGE_CHARS);
    } else {
      push({ sender: null, content: trimmed, date: null, time: null, kind: "message" });
    }
  }

  return { raws, format };
}

// --------------------------------------------------------------- public ----

export function parseTranscript(input: string, opts: ParseOptions = {}): IngestResult {
  const text = stripInvisibles(input.replace(/\r\n?/g, "\n")).replace(/^\uFEFF/, "");
  const warnings: string[] = [];

  let raws: Raw[];
  let format: IngestFormat;
  let selfLabels = new Set<string>();

  const csv = parseImessageCsv(text);
  if (csv) {
    raws = csv.raws;
    selfLabels = csv.selfLabels;
    format = "imessage_csv";
  } else {
    const imsg = parseImessageTxt(text);
    if (imsg) {
      raws = imsg;
      format = "imessage_txt";
    } else {
      const lb = parseLineBased(text);
      raws = lb.raws;
      format = lb.format;
    }
  }

  let truncated = false;
  if (raws.length > LIMITS.MAX_PARSED_MESSAGES) {
    raws = raws.slice(-LIMITS.MAX_PARSED_MESSAGES);
    truncated = true;
    warnings.push(
      `Only the most recent ${LIMITS.MAX_PARSED_MESSAGES.toLocaleString()} messages were kept.`,
    );
  }

  const nonEmpty = raws.filter((r) => r.content.length > 0);
  if (nonEmpty.length === 0) {
    throw new UnsupportedFormatError(
      "We couldn't find any messages in that. Paste lines like “Sam: hey everyone”.",
    );
  }

  // Decide day-first vs month-first across the whole file.
  let sawDayFirstProof = false;
  let sawMonthFirstProof = false;
  let sawAmbiguous = false;
  for (const r of nonEmpty) {
    if (!r.date) continue;
    const { a, b } = r.date;
    if (a > 12 && b <= 12) sawDayFirstProof = true;
    else if (b > 12 && a <= 12) sawMonthFirstProof = true;
    else if (a !== b && a <= 12 && b <= 12) sawAmbiguous = true;
  }
  let dayFirst = opts.dayFirst;
  if (dayFirst === undefined) {
    if (sawDayFirstProof && !sawMonthFirstProof) dayFirst = true;
    else if (sawMonthFirstProof && !sawDayFirstProof) dayFirst = false;
    else dayFirst = true; // WhatsApp's default in most locales
  }
  if (sawDayFirstProof && sawMonthFirstProof) {
    warnings.push("This export mixes date styles, so some dates may be off.");
  }
  const ambiguous = sawAmbiguous && !sawDayFirstProof && !sawMonthFirstProof;

  const resolveTs = (r: Raw): string | null => {
    const pre = (r as Raw & { iso?: string }).iso;
    if (pre) return pre;
    if (!r.date || !r.time) return null;
    const { a, b, c } = r.date;
    if (a > 31) return buildIso(a, b, c, r.time); // y-m-d
    const day = dayFirst ? a : b;
    const month = dayFirst ? b : a;
    return buildIso(c, month, day, r.time);
  };

  // Participants
  const byKey = new Map<string, IngestParticipant>();
  let seq = 0;
  for (const r of nonEmpty) {
    if (r.sender === null || r.kind === "system") continue;
    const key = normaliseKey(r.sender);
    if (key.length === 0) continue;
    let p = byKey.get(key);
    if (!p) {
      seq += 1;
      p = {
        id: `p${seq}`,
        display_name: r.sender.trim(),
        aliases: [r.sender.trim()],
        message_count: 0,
        excluded: false,
        is_self: selfLabels.has(r.sender.trim()),
        looks_like_system: SYSTEM_HINTS.some((h) => key.includes(h)),
      };
      byKey.set(key, p);
    } else if (!p.aliases.includes(r.sender.trim())) {
      p.aliases.push(r.sender.trim());
    }
    p.message_count += 1;
  }

  const messages: IngestMessage[] = nonEmpty.map((r, i) => ({
    participant_id:
      r.sender && r.kind !== "system"
        ? (byKey.get(normaliseKey(r.sender))?.id ?? null)
        : null,
    raw_sender: r.sender,
    content: r.content.slice(0, LIMITS.MAX_MESSAGE_CHARS),
    ts: resolveTs(r),
    kind: r.kind,
    order: i + 1,
  }));

  const participants = [...byKey.values()].sort((a, b) => b.message_count - a.message_count);
  if (participants.length === 0) {
    throw new UnsupportedFormatError(
      "We couldn't tell who said what. Each line needs a name, like “Sam: hey everyone”.",
    );
  }

  const stamped = messages.map((m) => m.ts).filter((t): t is string => !!t).sort();
  const withTime = stamped.length;
  if (withTime > 0 && withTime < messages.length) {
    warnings.push(
      `${messages.length - withTime} message${messages.length - withTime === 1 ? "" : "s"} have no usable time — they're kept in order, not deleted.`,
    );
  }

  return {
    format,
    participants,
    messages,
    unattributed_count: messages.filter((m) => m.participant_id === null && m.kind !== "system")
      .length,
    system_count: messages.filter((m) => m.kind === "system").length,
    attachment_count: messages.filter((m) => m.kind === "attachment").length,
    deleted_count: messages.filter((m) => m.kind === "deleted").length,
    ambiguous_dates: ambiguous,
    day_first: dayFirst,
    timezone_assumed: withTime > 0,
    date_range: { start: stamped[0] ?? null, end: stamped[stamped.length - 1] ?? null },
    messages_with_time: withTime,
    truncated_at_limit: truncated,
    warnings,
  };
}
