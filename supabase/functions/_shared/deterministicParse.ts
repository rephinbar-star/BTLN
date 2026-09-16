/**
 * Deterministic parser for two-person exports.
 *
 * Long histories must never be handed to a paid model just to be turned into
 * rows — that is slow, expensive and lossy. This parser reads WhatsApp-style
 * and "Name: text" transcripts directly, and returns nothing when it isn't
 * confident, so the existing model-based extraction can take over.
 *
 * It never guesses who said something: unattributed lines are attached to the
 * previous speaker (continuation lines) and nothing else.
 */

export type ParsedMsg = {
  sender: string;
  content: string;
  timestamp_estimate: string | null;
};

const WA_BRACKET = /^\[([^\]]{4,40})\]\s*([^:]{1,60}?):\s?([\s\S]*)$/;
const WA_DASH = /^(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s?(?:[AaPp]\.?[Mm]\.?)?)\s+-\s+([^:]{1,60}?):\s?([\s\S]*)$/;
const PLAIN = /^([^:\n]{1,40}?):\s?([\s\S]*)$/;

export function parseTwoPersonTranscript(text: string): {
  messages: ParsedMsg[];
  senders: string[];
} {
  const lines = text.split(/\r?\n/);
  const out: ParsedMsg[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let m = line.match(WA_BRACKET);
    if (m) {
      out.push({ sender: m[2].trim(), content: m[3].trim(), timestamp_estimate: m[1].trim() });
      continue;
    }
    m = line.match(WA_DASH);
    if (m) {
      out.push({ sender: m[2].trim(), content: m[3].trim(), timestamp_estimate: m[1].trim() });
      continue;
    }
    m = line.match(PLAIN);
    if (m && !/^https?$/i.test(m[1].trim())) {
      out.push({ sender: m[1].trim(), content: m[2].trim(), timestamp_estimate: null });
      continue;
    }
    // Continuation of the previous message — never attributed to anyone new.
    if (out.length > 0) out[out.length - 1].content += `\n${line.trim()}`;
  }

  const counts = new Map<string, number>();
  for (const m of out) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  const senders = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  return { messages: out, senders };
}

/**
 * Maps parsed senders onto the two named people. Returns null when the
 * transcript doesn't look like a clean two-person export.
 */
export function mapToRoles(
  parsed: { messages: ParsedMsg[]; senders: string[] },
  name1: string,
  name2: string,
): { sender_role: "user" | "partner"; content: string; timestamp_estimate: string | null }[] | null {
  const { messages, senders } = parsed;
  if (messages.length < 50 || senders.length < 2) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const top = senders.slice(0, 2);
  const total = messages.length;
  const kept = messages.filter((m) => top.includes(m.sender)).length;
  // A clean two-person export: the top two names cover almost everything.
  if (kept / total < 0.95) return null;

  const match = (target: string) =>
    top.find((s) => norm(s) === norm(target)) ??
    top.find((s) => norm(s).startsWith(norm(target)) || norm(target).startsWith(norm(s)));
  const userSender = match(name1) ?? top[0];
  const partnerSender = top.find((s) => s !== userSender) ?? top[1];
  if (!partnerSender || userSender === partnerSender) return null;
  void name2;

  return messages
    .filter((m) => m.sender === userSender || m.sender === partnerSender)
    .map((m) => ({
      sender_role: m.sender === userSender ? ("user" as const) : ("partner" as const),
      content: m.content,
      timestamp_estimate: m.timestamp_estimate,
    }));
}
