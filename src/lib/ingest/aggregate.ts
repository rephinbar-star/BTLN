/**
 * Deterministic aggregation over a parsed transcript.
 *
 * Everything here is pure arithmetic over the selected messages — no model is
 * involved, so counts and chronology are exact for whatever is selected.
 */

import { LIMITS } from "./limits";
import type { IngestMessage, IngestParticipant, IngestResult } from "./parse";

export type Coverage = {
  supplied_messages: number;
  analyzed_messages: number;
  sampled_for_model: number;
  participants: number;
  unattributed: number;
  system: number;
  attachments: number;
  deleted: number;
  without_time: number;
  date_start: string | null;
  date_end: string | null;
  /** True when the model reads a bounded sample rather than everything. */
  sampled: boolean;
};

/**
 * Remove exact duplicates that appear when two overlapping exports are pasted
 * together. Only messages with a known time can be de-duplicated safely.
 */
export function dedupeMessages(messages: IngestMessage[]): IngestMessage[] {
  const seen = new Set<string>();
  const out: IngestMessage[] = [];
  for (const m of messages) {
    if (m.ts) {
      const key = `${m.ts}|${m.raw_sender ?? ""}|${m.content}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(m);
  }
  return out.map((m, i) => ({ ...m, order: i + 1 }));
}

/** Stable chronological order: by timestamp when known, original order otherwise. */
export function sortChronologically(messages: IngestMessage[]): IngestMessage[] {
  return [...messages].sort((a, b) => {
    if (a.ts && b.ts && a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
    return a.order - b.order;
  });
}

export type RangeOptions = {
  from?: string | null;
  to?: string | null;
  /** Keep messages whose time is unknown (default true — never silently drop). */
  keepUnknownTime?: boolean;
};

export function selectRange(messages: IngestMessage[], opts: RangeOptions = {}): IngestMessage[] {
  const { from, to, keepUnknownTime = true } = opts;
  if (!from && !to) return messages;
  return messages.filter((m) => {
    if (!m.ts) return keepUnknownTime;
    const day = m.ts.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

/** Drop excluded participants' messages; nothing is dropped silently elsewhere. */
export function applyExclusions(
  messages: IngestMessage[],
  participants: IngestParticipant[],
): IngestMessage[] {
  const excluded = new Set(participants.filter((p) => p.excluded).map((p) => p.id));
  return messages.filter((m) => !(m.participant_id && excluded.has(m.participant_id)));
}

export type UploadPayload = {
  messages: IngestMessage[];
  coverage: Coverage;
};

/**
 * Build the bounded payload sent to the backend. When a history is longer than
 * the upload limit we keep the most recent messages in chronological order —
 * deterministic, never random.
 */
export function buildUploadPayload(
  selected: IngestMessage[],
  participants: IngestParticipant[],
  result: Pick<IngestResult, "system_count">,
): UploadPayload {
  const chrono = sortChronologically(dedupeMessages(selected));
  const supplied = chrono.length;

  let kept = chrono;
  if (kept.length > LIMITS.MAX_GROUP_UPLOAD_MESSAGES) {
    kept = kept.slice(-LIMITS.MAX_GROUP_UPLOAD_MESSAGES);
  }
  let chars = kept.reduce((n, m) => n + m.content.length, 0);
  while (chars > LIMITS.MAX_GROUP_UPLOAD_CHARS && kept.length > 1) {
    const dropped = kept.shift()!;
    chars -= dropped.content.length;
  }

  const stamped = kept.map((m) => m.ts).filter((t): t is string => !!t);
  const coverage: Coverage = {
    supplied_messages: supplied,
    analyzed_messages: kept.length,
    sampled_for_model: Math.min(kept.length, LIMITS.MAX_MODEL_SAMPLE_MESSAGES),
    participants: participants.filter((p) => !p.excluded).length,
    unattributed: kept.filter((m) => !m.participant_id && m.kind !== "system").length,
    system: kept.filter((m) => m.kind === "system").length,
    attachments: kept.filter((m) => m.kind === "attachment").length,
    deleted: kept.filter((m) => m.kind === "deleted").length,
    without_time: kept.filter((m) => !m.ts).length,
    date_start: stamped[0] ?? null,
    date_end: stamped[stamped.length - 1] ?? null,
    sampled: kept.length > LIMITS.MAX_MODEL_SAMPLE_MESSAGES,
  };

  return { messages: kept.map((m, i) => ({ ...m, order: i + 1 })), coverage };
}

/** Per-participant counts over the exact selection (used for the preview). */
export function participantCounts(
  messages: IngestMessage[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    if (!m.participant_id) continue;
    out[m.participant_id] = (out[m.participant_id] ?? 0) + 1;
  }
  return out;
}

export const dayOf = (iso: string | null): string | null => iso?.slice(0, 10) ?? null;
