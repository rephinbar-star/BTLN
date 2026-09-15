// Group Read parser — a thin adapter over the shared ingestion engine in
// src/lib/ingest. Kept so existing Group Read code and tests keep their API.

import {
  parseTranscript,
  UnsupportedFormatError,
  type IngestMessage,
  type IngestParticipant,
  type IngestResult,
  type ParseOptions,
} from "@/lib/ingest/parse";

export { UnsupportedFormatError };
export type ParsedMessage = IngestMessage;
export type ParsedParticipant = IngestParticipant;

export type ParseResult = Omit<IngestResult, "format"> & {
  format: "whatsapp" | "attributed_text" | "imessage";
};

const mapFormat = (f: IngestResult["format"]): ParseResult["format"] => {
  if (f === "whatsapp_ios" || f === "whatsapp_android") return "whatsapp";
  if (f === "imessage_csv" || f === "imessage_txt") return "imessage";
  return "attributed_text";
};

export function parseGroupChat(input: string, opts: ParseOptions = {}): ParseResult {
  const r = parseTranscript(input, opts);
  return { ...r, format: mapFormat(r.format) };
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
    unattributed_count: messages.filter(
      (m) => m.participant_id === null && m.kind !== "system",
    ).length,
  };
}
