import type { IngestMessage, IngestParticipant, IngestResult } from "./parse";

export type CanonicalSourceKind = "paste" | "chat_export" | "screenshots";
export type CanonicalMessageProvenance = {
  sourceKind: CanonicalSourceKind;
  sourceName: string | null;
  sourceOrder: number;
  confidence: "confirmed" | "parsed" | "uncertain";
};

export type CanonicalMessage = IngestMessage & {
  id: string;
  provenance: CanonicalMessageProvenance;
};

export type CanonicalConversation = {
  id: string;
  sourceKind: CanonicalSourceKind;
  sourceName: string | null;
  format: IngestResult["format"] | "screenshots_pending";
  participants: IngestParticipant[];
  messages: CanonicalMessage[];
  warnings: string[];
  ambiguousDates: boolean;
  dateRange: { start: string | null; end: string | null };
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function canonicalizeParsedConversation(
  parsed: IngestResult,
  sourceKind: Exclude<CanonicalSourceKind, "screenshots">,
  sourceName: string | null,
): CanonicalConversation {
  const conversationId = `conv_${stableHash(
    `${sourceKind}|${sourceName ?? "direct"}|${parsed.messages.length}|${parsed.messages[0]?.content ?? ""}|${parsed.messages.at(-1)?.content ?? ""}`,
  )}`;
  return {
    id: conversationId,
    sourceKind,
    sourceName,
    format: parsed.format,
    participants: parsed.participants,
    messages: parsed.messages.map((message) => ({
      ...message,
      id: `msg_${stableHash(`${conversationId}|${message.order}|${message.raw_sender ?? ""}|${message.ts ?? ""}|${message.content}`)}`,
      provenance: {
        sourceKind,
        sourceName,
        sourceOrder: message.order,
        confidence: message.participant_id ? "parsed" : "uncertain",
      },
    })),
    warnings: parsed.warnings,
    ambiguousDates: parsed.ambiguous_dates,
    dateRange: parsed.date_range,
  };
}

export function canonicalScreenshotConversation(names: string[]): CanonicalConversation {
  const id = `conv_${stableHash(`screenshots|${names.join("|")}`)}`;
  return {
    id,
    sourceKind: "screenshots",
    sourceName: names.join(", "),
    format: "screenshots_pending",
    participants: [],
    messages: [],
    warnings: ["Message text and speaker order will be previewed after the screenshots are read."],
    ambiguousDates: false,
    dateRange: { start: null, end: null },
  };
}