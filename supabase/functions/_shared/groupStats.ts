// Deterministic group-chat statistics.
//
// Single source of truth: imported by the `analyze-group` edge function (Deno)
// and by the vitest unit tests. Pure functions, no imports, no I/O.
//
// Nothing here ever persists or logs raw message text.

export type GroupParticipant = {
  id: string;
  display_name: string;
};

export type GroupMessage = {
  /** null = attribution unknown (kept, never guessed). */
  participant_id: string | null;
  content: string;
  /** ISO string, or null when the source had no usable timestamp. */
  ts: string | null;
  order: number;
};

export type ParticipantStats = {
  id: string;
  messages: number;
  share_pct: number;
  words: number;
  avg_words: number;
  questions_asked: number;
  questions_unanswered: number;
  emoji_count: number;
  apology_tokens: number;
  /** Threads started. null when no usable timestamps exist. */
  initiations: number | null;
  /** Median minutes to reply to someone else. null without timestamps. */
  median_response_minutes: number | null;
  quiet: boolean;
};

export type GroupStats = {
  message_count: number;
  participant_count: number;
  attributed_messages: number;
  unattributed_messages: number;
  has_timestamps: boolean;
  timestamp_coverage_pct: number;
  /** Earliest / latest reliable timestamp in the counted history, if any. */
  date_start: string | null;
  date_end: string | null;
  span_hours: number | null;
  session_count: number | null;
  participants: ParticipantStats[];
  total_questions: number;
  total_unanswered_questions: number;
  /** Participants with under 5% of messages. */
  quiet_participant_ids: string[];
  /** Metrics we could not compute, by name, so the UI can label them. */
  unavailable_metrics: string[];
};

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

const APOLOGY_RE =
  /\b(sorry|apolog(?:y|ise|ize|ies|ised|ized)|my bad|didn'?t mean|i was wrong|forgive me)\b/i;

const SESSION_GAP_MINUTES = 180;
/** A question counts as answered if anyone else speaks within this many messages. */
const ANSWER_WINDOW = 3;

const wordCount = (s: string): number =>
  s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;

const isQuestion = (s: string): boolean => /\?\s*$/.test(s.trim()) || /\?\s/.test(s);

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
};

const parseTs = (ts: string | null): number | null => {
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : null;
};

export function computeGroupStats(
  participants: GroupParticipant[],
  messagesIn: GroupMessage[],
): GroupStats {
  const messages = [...messagesIn].sort((a, b) => a.order - b.order);
  const ids = participants.map((p) => p.id);
  const known = new Set(ids);

  const attributed = messages.filter(
    (m) => m.participant_id !== null && known.has(m.participant_id),
  );
  const unattributed = messages.length - attributed.length;

  const stamped = messages.filter((m) => parseTs(m.ts) !== null);
  const timestampCoverage =
    messages.length === 0 ? 0 : Math.round((stamped.length / messages.length) * 100);
  const hasTimestamps = timestampCoverage >= 60;

  // Sessions and response times (timestamp-dependent).
  let sessionCount: number | null = null;
  let spanHours: number | null = null;
  const initiations = new Map<string, number>();
  const responseMinutes = new Map<string, number[]>();

  if (hasTimestamps) {
    const ordered = attributed
      .map((m) => ({ ...m, t: parseTs(m.ts) }))
      .filter((m): m is GroupMessage & { t: number } => m.t !== null);

    if (ordered.length > 0) {
      spanHours =
        Math.round(
          ((ordered[ordered.length - 1].t - ordered[0].t) / 3_600_000) * 10,
        ) / 10;
      sessionCount = 0;
      let prev: (GroupMessage & { t: number }) | null = null;
      for (const m of ordered) {
        const gapMin = prev === null ? Infinity : (m.t - prev.t) / 60_000;
        if (gapMin > SESSION_GAP_MINUTES) {
          sessionCount += 1;
          initiations.set(m.participant_id!, (initiations.get(m.participant_id!) ?? 0) + 1);
        } else if (prev && prev.participant_id !== m.participant_id) {
          const arr = responseMinutes.get(m.participant_id!) ?? [];
          arr.push(Math.round(((m.t - prev.t) / 60_000) * 10) / 10);
          responseMinutes.set(m.participant_id!, arr);
        }
        prev = m;
      }
    }
  }

  // Questions and whether anyone else replied soon after.
  let totalQuestions = 0;
  let totalUnanswered = 0;
  const questionsAsked = new Map<string, number>();
  const questionsUnanswered = new Map<string, number>();

  attributed.forEach((m, i) => {
    if (!isQuestion(m.content)) return;
    const pid = m.participant_id!;
    totalQuestions += 1;
    questionsAsked.set(pid, (questionsAsked.get(pid) ?? 0) + 1);
    const answered = attributed
      .slice(i + 1, i + 1 + ANSWER_WINDOW)
      .some((n) => n.participant_id !== pid);
    if (!answered) {
      totalUnanswered += 1;
      questionsUnanswered.set(pid, (questionsUnanswered.get(pid) ?? 0) + 1);
    }
  });

  const perParticipant: ParticipantStats[] = participants.map((p) => {
    const mine = attributed.filter((m) => m.participant_id === p.id);
    const words = mine.reduce((n, m) => n + wordCount(m.content), 0);
    const emoji = mine.reduce((n, m) => n + (m.content.match(EMOJI_RE)?.length ?? 0), 0);
    const apologies = mine.filter((m) => APOLOGY_RE.test(m.content)).length;
    const share =
      attributed.length === 0
        ? 0
        : Math.round((mine.length / attributed.length) * 1000) / 10;
    return {
      id: p.id,
      messages: mine.length,
      share_pct: share,
      words,
      avg_words: mine.length === 0 ? 0 : Math.round((words / mine.length) * 10) / 10,
      questions_asked: questionsAsked.get(p.id) ?? 0,
      questions_unanswered: questionsUnanswered.get(p.id) ?? 0,
      emoji_count: emoji,
      apology_tokens: apologies,
      initiations: hasTimestamps ? (initiations.get(p.id) ?? 0) : null,
      median_response_minutes: hasTimestamps
        ? median(responseMinutes.get(p.id) ?? [])
        : null,
      quiet: share < 5,
    };
  });

  const unavailable: string[] = [];
  if (!hasTimestamps) {
    unavailable.push("initiation_patterns", "response_times", "activity_over_time");
  }
  if (unattributed > 0) unavailable.push("full_attribution_coverage");

  const stampedSorted = messages
    .map((m) => m.ts)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .sort();

  return {
    message_count: messages.length,
    participant_count: participants.length,
    attributed_messages: attributed.length,
    unattributed_messages: unattributed,
    has_timestamps: hasTimestamps,
    timestamp_coverage_pct: timestampCoverage,
    date_start: stampedSorted[0] ?? null,
    date_end: stampedSorted[stampedSorted.length - 1] ?? null,
    span_hours: spanHours,
    session_count: sessionCount,
    participants: perParticipant,
    total_questions: totalQuestions,
    total_unanswered_questions: totalUnanswered,
    quiet_participant_ids: perParticipant.filter((p) => p.quiet).map((p) => p.id),
    unavailable_metrics: unavailable,
  };
}

/** Crude safety screen: overrides the playful tone when triggered. */
const SAFETY_RE =
  /\b(kill (?:you|myself|him|her|them)|i want to die|want to be dead|end (?:it all|my life)|suicide|self[- ]harm|hurting myself|hurt myself|harm myself|cutting myself|rape|beat (?:you|her|him) up|i'?ll hurt you|threaten(?:ed|ing)? (?:to )?(?:hurt|kill)|abuse|restraining order|hit me|punched me)\b/i;

export function detectSafetyConcern(messages: GroupMessage[]): boolean {
  return messages.some((m) => SAFETY_RE.test(m.content));
}
