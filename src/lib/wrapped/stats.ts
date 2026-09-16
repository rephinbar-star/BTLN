/**
 * Relationship Wrapped — deterministic statistics.
 *
 * Every number here is arithmetic over the exact set of messages selected by the
 * user. No model is involved, nothing is estimated, and nothing is extrapolated
 * beyond the selected period. Messages whose timestamp could not be read are
 * counted separately and excluded from any time-based figure.
 */

import type { IngestMessage, IngestParticipant } from "@/lib/ingest/parse";

export const DEFAULT_SESSION_GAP_HOURS = 6;

export type PeriodKind = "month" | "quarter" | "year" | "custom";

export type WrappedPeriod = {
  kind: PeriodKind;
  /** Inclusive ISO day, e.g. 2026-01-01 */
  from: string;
  /** Inclusive ISO day */
  to: string;
  label: string;
};

export type ParticipantStat = {
  id: string;
  name: string;
  messages: number;
  share: number;
  words: number;
  avgWords: number;
  emojis: number;
};

export type InitiationStat = {
  id: string;
  name: string;
  starts: number;
  share: number;
};

export type ReplyStat = {
  id: string;
  name: string;
  replies: number;
  medianReplyMinutes: number | null;
};

export type WrappedStats = {
  period: WrappedPeriod;
  sessionGapHours: number;
  totals: {
    messages: number;
    withTime: number;
    withoutTime: number;
    participants: number;
    attachments: number;
    system: number;
    deleted: number;
    words: number;
    activeDays: number;
    firstTs: string | null;
    lastTs: string | null;
  };
  participants: ParticipantStat[];
  initiation: {
    sessions: number;
    byParticipant: InitiationStat[];
  };
  replies: ReplyStat[];
  busiest: {
    day: { key: string; count: number } | null;
    month: { key: string; count: number } | null;
    weekday: { key: string; count: number } | null;
    hour: { key: string; count: number } | null;
  };
  emojis: { emoji: string; count: number }[];
  limitations: string[];
};

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

/** Counts a value into a map, deterministically. */
const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

/** Highest count; ties broken by key ascending so results are reproducible. */
const topOf = (map: Map<string, number>): { key: string; count: number } | null => {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
};

export function computeWrappedStats(
  messages: IngestMessage[],
  participants: IngestParticipant[],
  period: WrappedPeriod,
  options: { sessionGapHours?: number; topEmojis?: number } = {},
): WrappedStats {
  const sessionGapHours = options.sessionGapHours ?? DEFAULT_SESSION_GAP_HOURS;
  const topEmojis = options.topEmojis ?? 5;

  const byId = new Map(participants.map((p) => [p.id, p]));
  const nameOf = (id: string) => byId.get(id)?.display_name ?? id;

  const real = messages.filter((m) => m.kind !== "system");
  const chrono = [...real].sort((a, b) => {
    if (a.ts && b.ts && a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
    return a.order - b.order;
  });

  const perId = new Map<string, { messages: number; words: number; emojis: number }>();
  const emojiCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  const weekdayCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();

  let words = 0;
  let withTime = 0;

  for (const m of chrono) {
    const w = m.content.trim() ? m.content.trim().split(/\s+/).length : 0;
    words += w;
    const emojis = m.content.match(EMOJI_RE) ?? [];
    for (const e of emojis) bump(emojiCounts, e);

    if (m.participant_id) {
      const cur = perId.get(m.participant_id) ?? { messages: 0, words: 0, emojis: 0 };
      cur.messages += 1;
      cur.words += w;
      cur.emojis += emojis.length;
      perId.set(m.participant_id, cur);
    }

    if (m.ts) {
      withTime += 1;
      const d = new Date(m.ts);
      bump(dayCounts, m.ts.slice(0, 10));
      bump(monthCounts, m.ts.slice(0, 7));
      if (!Number.isNaN(d.getTime())) {
        bump(weekdayCounts, WEEKDAYS[d.getUTCDay()]);
        bump(hourCounts, String(d.getUTCHours()).padStart(2, "0"));
      }
    }
  }

  const totalAttributed = [...perId.values()].reduce((n, v) => n + v.messages, 0);
  const participantStats: ParticipantStat[] = [...perId.entries()]
    .map(([id, v]) => ({
      id,
      name: nameOf(id),
      messages: v.messages,
      share: totalAttributed ? v.messages / totalAttributed : 0,
      words: v.words,
      avgWords: v.messages ? v.words / v.messages : 0,
      emojis: v.emojis,
    }))
    .sort((a, b) => b.messages - a.messages || (a.id < b.id ? -1 : 1));

  // Initiation: a message starts a session when it is the first timed message,
  // or the previous timed message is more than sessionGapHours earlier.
  const timed = chrono.filter((m) => m.ts);
  const starts = new Map<string, number>();
  let sessions = 0;
  let prev: number | null = null;
  for (const m of timed) {
    const t = new Date(m.ts as string).getTime();
    if (Number.isNaN(t)) continue;
    if (prev === null || t - prev > sessionGapHours * 3600_000) {
      sessions += 1;
      if (m.participant_id) bump(starts, m.participant_id);
    }
    prev = t;
  }
  const startTotal = [...starts.values()].reduce((a, b) => a + b, 0);
  const initiationBy: InitiationStat[] = [...starts.entries()]
    .map(([id, n]) => ({ id, name: nameOf(id), starts: n, share: startTotal ? n / startTotal : 0 }))
    .sort((a, b) => b.starts - a.starts || (a.id < b.id ? -1 : 1));

  // Replies: a timed message from a different participant than the previous
  // timed message, within the same session.
  const replyTimes = new Map<string, number[]>();
  let prevMsg: { id: string | null; t: number } | null = null;
  for (const m of timed) {
    const t = new Date(m.ts as string).getTime();
    if (Number.isNaN(t)) continue;
    if (
      prevMsg &&
      m.participant_id &&
      prevMsg.id &&
      m.participant_id !== prevMsg.id &&
      t - prevMsg.t <= sessionGapHours * 3600_000
    ) {
      const arr = replyTimes.get(m.participant_id) ?? [];
      arr.push((t - prevMsg.t) / 60_000);
      replyTimes.set(m.participant_id, arr);
    }
    prevMsg = { id: m.participant_id, t };
  }
  const replies: ReplyStat[] = [...replyTimes.entries()]
    .map(([id, arr]) => ({
      id,
      name: nameOf(id),
      replies: arr.length,
      medianReplyMinutes: median(arr),
    }))
    .sort((a, b) => b.replies - a.replies || (a.id < b.id ? -1 : 1));

  const emojis = [...emojiCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, topEmojis)
    .map(([emoji, count]) => ({ emoji, count }));

  const withoutTime = chrono.length - withTime;
  const limitations: string[] = [];
  if (withoutTime > 0) {
    limitations.push(
      `${withoutTime} of ${chrono.length} messages had no readable timestamp. They are counted in totals but excluded from every time-based figure.`,
    );
  }
  const unattributed = chrono.filter((m) => !m.participant_id).length;
  if (unattributed > 0) {
    limitations.push(
      `${unattributed} messages could not be attributed to a sender and are excluded from per-person figures.`,
    );
  }
  if (withTime > 0) {
    limitations.push(
      "Times are read exactly as the export wrote them. If the export has no timezone, days and hours follow that original local time.",
    );
  }
  limitations.push(
    `A new conversation "session" starts after a gap of more than ${sessionGapHours} hours. Initiation counts who sent the first message of each session.`,
  );
  limitations.push(
    "Everything shown covers only the messages you imported for the selected period — not your whole relationship.",
  );

  const stamped = timed.map((m) => m.ts as string);

  return {
    period,
    sessionGapHours,
    totals: {
      messages: chrono.length,
      withTime,
      withoutTime,
      participants: participantStats.length,
      attachments: chrono.filter((m) => m.kind === "attachment").length,
      system: messages.length - chrono.length,
      deleted: chrono.filter((m) => m.kind === "deleted").length,
      words,
      activeDays: dayCounts.size,
      firstTs: stamped[0] ?? null,
      lastTs: stamped[stamped.length - 1] ?? null,
    },
    participants: participantStats,
    initiation: { sessions, byParticipant: initiationBy },
    replies,
    busiest: {
      day: topOf(dayCounts),
      month: topOf(monthCounts),
      weekday: topOf(weekdayCounts),
      hour: topOf(hourCounts),
    },
    emojis,
    limitations,
  };
}

/** Pseudonymous labels, assigned in a stable order. */
export function pseudonymMap(stats: WrappedStats): Record<string, string> {
  const out: Record<string, string> = {};
  stats.participants.forEach((p, i) => {
    out[p.id] = `Person ${String.fromCharCode(65 + i)}`;
  });
  return out;
}

/** Periods that the imported data can actually support. */
export function availablePeriods(messages: IngestMessage[]): WrappedPeriod[] {
  const days = messages
    .map((m) => m.ts?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();
  if (!days.length) return [];
  const months = [...new Set(days.map((d) => d.slice(0, 7)))].sort();
  const years = [...new Set(days.map((d) => d.slice(0, 4)))].sort();

  const periods: WrappedPeriod[] = [];
  for (const y of years) {
    periods.push({ kind: "year", from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` });
    for (const q of [1, 2, 3, 4]) {
      const startM = (q - 1) * 3 + 1;
      const endM = startM + 2;
      const from = `${y}-${String(startM).padStart(2, "0")}-01`;
      const to = `${y}-${String(endM).padStart(2, "0")}-${lastDay(Number(y), endM)}`;
      if (months.some((m) => m >= from.slice(0, 7) && m <= to.slice(0, 7))) {
        periods.push({ kind: "quarter", from, to, label: `Q${q} ${y}` });
      }
    }
  }
  for (const m of months) {
    const [y, mm] = m.split("-");
    periods.push({
      kind: "month",
      from: `${m}-01`,
      to: `${m}-${lastDay(Number(y), Number(mm))}`,
      label: monthLabel(m),
    });
  }
  return periods;
}

function lastDay(year: number, month: number): string {
  return String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0");
}
