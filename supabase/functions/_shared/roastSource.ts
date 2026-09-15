// Builds the model input for Roast Us from an ALREADY-GENERATED report.
//
// Roast Us never re-reads raw conversations. It only reuses the structured
// output of a Deep Read (analyses.result_json) or a Group Read
// (group_reads.result_json). This module is pure so it can be unit tested.

export type RoastSubject = { id: string; display_name: string };

export type RoastDigest = {
  context: "dyadic" | "group";
  category: string; // romantic | friend | family | friends | work
  subjects: RoastSubject[];
  /** Compact, model-facing description of the serious findings. */
  facts: string[];
  /** Quotes already extracted by the source report (may be empty). */
  evidence: string[];
  /** True when the source report itself flagged a safety concern. */
  safetyFlag: boolean;
  safetyReason: string | null;
  /** Work groups must never get performance/ranking humour. */
  workContext: boolean;
};

/** Same crude screen used by Group Read, applied to structured text here. */
const SAFETY_RE =
  /\b(kill (?:you|myself|him|her|them)|i want to die|want to be dead|end (?:it all|my life)|suicide|self[- ]harm|hurting myself|hurt myself|harm myself|cutting myself|rape|beat (?:you|her|him) up|i'?ll hurt you|threaten(?:ed|ing)? (?:to )?(?:hurt|kill)|abuse|abusive|coerc(?:e|ed|ion|ive)|restraining order|hit me|punched me|stalk(?:ed|ing))\b/i;

const clean = (v: unknown, max = 400): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const flagTitle = (f: unknown): string => {
  if (typeof f === "string") return clean(f, 160);
  if (f && typeof f === "object") {
    const o = f as Record<string, unknown>;
    return clean(o.title ?? o.description, 160);
  }
  return "";
};

export function buildDyadicDigest(
  result: Record<string, unknown>,
  context: Record<string, unknown>,
  relationshipType: string,
): RoastDigest {
  const name1 = clean(context?.name1, 60) || "Person A";
  const name2 = clean(context?.name2, 60) || "Person B";
  const meta = (result.meta ?? {}) as Record<string, unknown>;
  const headline = (result.headline ?? {}) as Record<string, unknown>;
  const diag = (result.communication_diagnostic ?? {}) as Record<string, unknown>;
  const horsemen = (result.four_horsemen ?? {}) as Record<string, Record<string, unknown>>;
  const attach = (result.attachment_profiles ?? {}) as Record<string, Record<string, unknown>>;

  const facts: string[] = [];
  const evidence: string[] = [];

  if (typeof headline.score === "number") facts.push(`Overall score: ${headline.score}/100`);
  if (headline.tier_label) facts.push(`Tier: ${clean(headline.tier_label, 80)}`);
  if (headline.vibe_summary) facts.push(`Vibe: ${clean(headline.vibe_summary)}`);

  for (const [k, v] of Object.entries((result.sub_scores ?? {}) as Record<string, unknown>)) {
    if (typeof v === "number") facts.push(`Sub-score ${k}: ${v}`);
  }
  for (const k of [
    "response_time_asymmetry",
    "initiator_balance",
    "message_length_asymmetry",
    "question_ratio",
    "key_observation",
  ]) {
    const v = clean(diag[k]);
    if (v) facts.push(`${k.replace(/_/g, " ")}: ${v}`);
  }
  for (const [person, prof] of Object.entries(attach)) {
    const style = clean(prof?.primary_style, 40);
    if (style) facts.push(`${clean(person, 60)} attachment read: ${style} (${clean(prof?.confidence, 20)})`);
    for (const q of (prof?.evidence_quotes as unknown[]) ?? []) {
      const s = clean(q, 200);
      if (s) evidence.push(s);
    }
  }
  for (const [name, h] of Object.entries(horsemen)) {
    if (h?.present === true) {
      facts.push(`Gottman pattern present: ${name}`);
      const q = clean(h.evidence_quote ?? h.evidence, 200);
      if (q) evidence.push(q);
    }
  }
  for (const key of ["green_flags", "yellow_flags", "red_flags"]) {
    for (const f of ((result[key] as unknown[]) ?? []).slice(0, 5)) {
      const t = flagTitle(f);
      if (t) facts.push(`${key.replace("_", " ")}: ${t}`);
    }
  }
  const hidden = (result.hidden_pattern ?? {}) as Record<string, unknown>;
  if (hidden.title) facts.push(`Hidden pattern: ${clean(hidden.title, 120)} — ${clean(hidden.description)}`);

  const safetyNote = clean(meta.safety_note, 200);
  const scanned = [...facts, ...evidence].join(" \n ");
  const safetyFlag = meta.safety_concern === true || SAFETY_RE.test(scanned);

  return {
    context: "dyadic",
    category: relationshipType || "romantic",
    subjects: [
      { id: "p1", display_name: name1 },
      { id: "p2", display_name: name2 },
    ],
    facts: facts.slice(0, 40),
    evidence: evidence.slice(0, 8),
    safetyFlag,
    safetyReason: safetyFlag ? safetyNote || "The source report flagged a serious concern." : null,
    workContext: false,
  };
}

export function buildGroupDigest(
  result: Record<string, unknown>,
  stats: Record<string, unknown>,
  category: string,
): RoastDigest {
  const participants = ((result.participants as RoastSubject[]) ?? []).map((p) => ({
    id: clean(p.id, 16),
    display_name: clean(p.display_name, 60) || "Someone",
  }));
  const statsById = new Map(
    (((stats.participants as Record<string, unknown>[]) ?? []) as Record<string, unknown>[]).map(
      (s) => [String(s.id), s],
    ),
  );

  const facts: string[] = [];
  const evidence: string[] = [];

  if (result.group_title) facts.push(`Group title: ${clean(result.group_title, 120)}`);
  if (result.group_summary) facts.push(`Summary: ${clean(result.group_summary)}`);

  for (const c of ((result.role_cards as Record<string, unknown>[]) ?? []).slice(0, 15)) {
    const pid = clean(c.participant_id, 16);
    const who = participants.find((p) => p.id === pid)?.display_name ?? "Someone";
    const s = statsById.get(pid);
    const share = s && typeof s.share_pct === "number" ? `, ${s.share_pct}% of messages` : "";
    facts.push(
      `${who} — role ${clean(c.role, 60)}${share}: ${clean(c.headline, 200)} ${clean(c.why, 240)}`.trim(),
    );
    const q = clean(c.evidence, 200);
    if (q) evidence.push(q);
  }
  const balance = (result.balance ?? {}) as Record<string, unknown>;
  if (balance.note) facts.push(`Balance: ${clean(balance.note)}`);
  for (const s of ((result.group_strengths as unknown[]) ?? []).slice(0, 5)) {
    const t = clean(s, 200);
    if (t) facts.push(`Strength: ${t}`);
  }
  if (typeof stats.total_unanswered_questions === "number") {
    facts.push(`Unanswered questions: ${stats.total_unanswered_questions}`);
  }

  const scanned = [...facts, ...evidence].join(" \n ");
  const safetyFlag = result.safety_mode === true || SAFETY_RE.test(scanned);

  return {
    context: "group",
    category: category || "friends",
    subjects: participants,
    facts: facts.slice(0, 40),
    evidence: evidence.slice(0, 8),
    safetyFlag,
    safetyReason: safetyFlag
      ? clean(result.safety_mode_reason, 200) || "The source read flagged a serious concern."
      : null,
    workContext: category === "work",
  };
}

/** The user-facing message shown instead of a roast when safety wins. */
export const SAFETY_BLOCK_MESSAGE =
  "There's something in this conversation we won't make jokes about. Your serious read still has the useful part.";
