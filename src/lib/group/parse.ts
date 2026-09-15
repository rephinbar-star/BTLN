// Browser-side group chat parser.
//
// Turns pasted text or a supported text export into participants + messages
// with stable ids. Lines whose sender cannot be determined are kept as
// unattributed — we never guess a sender from writing style.

export type ParsedMessage = {
  participant_id: string | null;
  /** Raw sender label as it appeared, for unattributed/merge UI. */
  raw_sender: string | null;
  content: string;
  ts: string | null;
  order: number;
};

export type ParsedParticipant = {
  id: string;
  /** Canonical label shown to the uploader (editable). */
  display_name: string;
  /** All raw sender labels merged into this participant. */
  aliases: string[];
  message_count: number;
  excluded: boolean;
  is_self: boolean;
  /** Heuristic hint only — the uploader confirms. */
  looks_like_system: boolean;
};

export type ParseResult = {
  participants: ParsedParticipant[];
  messages: ParsedMessage[];
  unattributed_count: number;
  format: "whatsapp" | "attributed_text";
};

export class UnsupportedFormatError extends Error {}

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

// [12/03/2024, 19:04:11] Sam: hi     /     12/03/2024, 19:04 - Sam: hi
const WA_BRACKET =
  /^\s*\[(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\]\s*([^:]{1,60}):\s?([\s\S]*)$/;
const WA_DASH =
  /^\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\s+-\s+([^:]{1,60}):\s?([\s\S]*)$/;
// Sam: hi
const PLAIN = /^\s*([^:\n]{1,40}):\s?([\s\S]*)$/;
// 19:04 Sam: hi
const TIME_PREFIX = /^\s*(\d{1,2}:\d{2})\s+([^:\n]{1,40}):\s?([\s\S]*)$/;

const WA_SYSTEM_LINE =
  /(messages and calls are end-to-end encrypted|created group|added you|joined using this group|left$|changed the subject|changed this group's icon|removed |security code changed|<Media omitted>|image omitted|deleted this message)/i;

const normaliseKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u200e\u200f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const toIso = (date: string, time: string): string | null => {
  const dm = date.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  if (!dm) return null;
  let [, a, b, c] = dm;
  let day: number, month: number, year: number;
  if (a.length === 4) {
    year = +a;
    month = +b;
    day = +c;
  } else {
    // Ambiguous d/m vs m/d: prefer day-first (WhatsApp default in most locales)
    // unless the first number can only be a month.
    day = +a;
    month = +b;
    if (+a <= 12 && +b > 12) {
      month = +a;
      day = +b;
    }
    year = +c < 100 ? 2000 + +c : +c;
  }
  const t = time.trim().toLowerCase();
  const pm = /pm$/.test(t);
  const am = /am$/.test(t);
  const parts = t.replace(/\s?[ap]m$/, "").split(":").map(Number);
  let hour = parts[0] ?? 0;
  const min = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  const d = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

export function parseGroupChat(input: string): ParseResult {
  const text = input.replace(/\r\n?/g, "\n").replace(/[\u200e\u200f]/g, "");
  const lines = text.split("\n");

  type Raw = { sender: string | null; content: string; ts: string | null };
  const raws: Raw[] = [];
  let format: ParseResult["format"] = "attributed_text";

  const push = (sender: string | null, content: string, ts: string | null) => {
    raws.push({ sender, content: content.trim(), ts });
  };

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    let m = line.match(WA_BRACKET) ?? line.match(WA_DASH);
    if (m) {
      format = "whatsapp";
      if (WA_SYSTEM_LINE.test(m[4]) && !m[4].trim()) continue;
      push(m[3].trim(), m[4], toIso(m[1], m[2]));
      continue;
    }

    m = line.match(TIME_PREFIX);
    if (m) {
      push(m[2].trim(), m[3], null);
      continue;
    }

    m = line.match(PLAIN);
    if (m && !/^https?$/i.test(m[1].trim())) {
      push(m[1].trim(), m[2], null);
      continue;
    }

    // Continuation of the previous message, or an unattributable line.
    if (raws.length > 0 && raws[raws.length - 1].sender !== null) {
      raws[raws.length - 1].content += `\n${line.trim()}`;
    } else {
      push(null, line, null);
    }
  }

  const nonEmpty = raws.filter((r) => r.content.length > 0);
  if (nonEmpty.length === 0) {
    throw new UnsupportedFormatError(
      "We couldn't find any messages in that. Paste lines like “Sam: hey everyone”.",
    );
  }

  // Build participants from raw sender labels.
  const byKey = new Map<string, ParsedParticipant>();
  let seq = 0;
  for (const r of nonEmpty) {
    if (r.sender === null) continue;
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
        is_self: false,
        looks_like_system: SYSTEM_HINTS.some((h) => key.includes(h)),
      };
      byKey.set(key, p);
    } else if (!p.aliases.includes(r.sender.trim())) {
      p.aliases.push(r.sender.trim());
    }
    p.message_count += 1;
  }

  const messages: ParsedMessage[] = nonEmpty.map((r, i) => ({
    participant_id: r.sender ? (byKey.get(normaliseKey(r.sender))?.id ?? null) : null,
    raw_sender: r.sender,
    content: r.content,
    ts: r.ts,
    order: i + 1,
  }));

  const participants = [...byKey.values()].sort(
    (a, b) => b.message_count - a.message_count,
  );

  if (participants.length === 0) {
    throw new UnsupportedFormatError(
      "We couldn't tell who said what. Each line needs a name, like “Sam: hey everyone”.",
    );
  }

  return {
    participants,
    messages,
    unattributed_count: messages.filter((m) => m.participant_id === null).length,
    format,
  };
}

/** Merge participant `fromId` into `intoId`, keeping aliases and counts. */
export function mergeParticipants(
  result: ParseResult,
  intoId: string,
  fromId: string,
): ParseResult {
  if (intoId === fromId) return result;
  const into = result.participants.find((p) => p.id === intoId);
  const from = result.participants.find((p) => p.id === fromId);
  if (!into || !from) return result;

  const merged: ParsedParticipant = {
    ...into,
    aliases: [...new Set([...into.aliases, ...from.aliases])],
    message_count: into.message_count + from.message_count,
    is_self: into.is_self || from.is_self,
  };

  return {
    ...result,
    participants: result.participants
      .filter((p) => p.id !== fromId)
      .map((p) => (p.id === intoId ? merged : p)),
    messages: result.messages.map((m) =>
      m.participant_id === fromId ? { ...m, participant_id: intoId } : m,
    ),
  };
}

/** Assign every unattributed line to a participant (uploader correction). */
export function assignUnattributed(
  result: ParseResult,
  order: number,
  participantId: string,
): ParseResult {
  const messages = result.messages.map((m) =>
    m.order === order ? { ...m, participant_id: participantId } : m,
  );
  return {
    ...result,
    messages,
    participants: result.participants.map((p) =>
      p.id === participantId ? { ...p, message_count: p.message_count + 1 } : p,
    ),
    unattributed_count: messages.filter((m) => m.participant_id === null).length,
  };
}
