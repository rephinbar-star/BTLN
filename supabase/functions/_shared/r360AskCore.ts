// Relationship360 Questions — pure rules (unit-tested from src/lib/relationship360).
// No network, no Deno APIs. The edge function supplies verified owner data.
//
// Guarantees enforced here:
//  - only owned, confirmed-identity, non-excluded, non-quarantined sources are eligible;
//  - a question-specific selection may only NARROW the eligible set (never widen,
//    never mutate inclusion); unknown or ineligible ids reject the request;
//  - notes are self-reports, only from selected relationships, never evidence;
//    an explicit note selection may only narrow (and may be empty);
//  - every cited moment must map to a supplied observation/note id;
//  - a quote is shown only when the observation's evidence was copied verbatim
//    from the supplied messages by ingestion (attributed Deep Read schema) AND the
//    model's quote is contained in that stored excerpt — otherwise paraphrase;
//  - a date is "verified" only when the source's stored date provenance is
//    parsed/ocr_confirmed and the observation day lies inside the source period;
//  - change claims need >= 2 distinct reads with distinct verified days;
//  - unsupported certainty, diagnoses or mind-reading abstain.

export const ASK_LIMITS = {
  questionMin: 3,
  questionMax: 300,
  maxSelectedSources: 12,
  maxObservations: 60,
  maxNotes: 8,
  noteChars: 600,
  statementChars: 400,
  maxOutputTokens: 900,
  dailyQuestions: 10,
  maxMoments: 4,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AskSource = {
  id: string;
  relationship_id: string;
  source_kind: string;
  subject_participant: string | null;
  identity_status: string;
  excluded_at: string | null;
  quarantined_at?: string | null;
  evaluation_run_id?: string | null;
  subject_participant_id?: string | null;
  updated_at?: string | null;
  date_provenance?: string | null;
  observed_period_start?: string | null;
  observed_period_end?: string | null;
};
export type AskObservation = {
  id: string;
  journey_source_id: string;
  subject_kind: string;
  subject_label: string | null;
  observation_type: string;
  statement: string;
  evidence_refs: unknown;
  confidence: string | null;
  observed_period_start: string | null;
  observed_period_end: string | null;
  created_at: string;
  version?: number | null;
  updated_at?: string | null;
  corrected_at?: string | null;
};
export type AskNote = { id: string; relationship_id: string | null; response_text: string; self_reported_at: string; excluded_at?: string | null; updated_at?: string | null };
export type AskRelationship = { id: string; label: string | null; is_confirmed: boolean };

export const isEligibleSource = (s: AskSource, evalScope: string | null) =>
  s.identity_status === "confirmed" && !!s.subject_participant && !s.excluded_at && !s.quarantined_at &&
  (evalScope !== null || !s.evaluation_run_id);

export const validateQuestion = (q: unknown): { ok: true; question: string } | { ok: false; error: string } => {
  if (typeof q !== "string") return { ok: false, error: "Write a question." };
  const question = q.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (question.length < ASK_LIMITS.questionMin) return { ok: false, error: "Write a slightly longer question." };
  if (question.length > ASK_LIMITS.questionMax) return { ok: false, error: `Keep your question under ${ASK_LIMITS.questionMax} characters.` };
  return { ok: true, question };
};

/** Requested ids may only narrow the eligible set. Anything else rejects the whole request. */
export const selectSources = (eligible: AskSource[], requested: unknown):
  { ok: true; selected: AskSource[] } | { ok: false; error: string } => {
  if (requested === undefined || requested === null) return { ok: true, selected: eligible.slice(0, ASK_LIMITS.maxSelectedSources) };
  if (!Array.isArray(requested)) return { ok: false, error: "Invalid source selection." };
  if (requested.length === 0) return { ok: false, error: "Choose at least one included read." };
  if (requested.length > ASK_LIMITS.maxSelectedSources) return { ok: false, error: `Choose up to ${ASK_LIMITS.maxSelectedSources} reads.` };
  const byId = new Map(eligible.map((s) => [s.id, s]));
  const unique = [...new Set(requested)];
  if (unique.some((id) => typeof id !== "string" || !UUID_RE.test(id) || !byId.has(id))) {
    return { ok: false, error: "One of those reads is not available for questions." };
  }
  return { ok: true, selected: unique.map((id) => byId.get(id as string)!) };
};

/** Notes eligible for a question: owned, current, not excluded, from selected owned relationships. */
export const eligibleNotes = (notes: AskNote[], selected: AskSource[], rels: Map<string, AskRelationship>) => {
  const relIds = new Set(selected.map((s) => s.relationship_id));
  return notes
    .filter((n) => !n.excluded_at && n.relationship_id && relIds.has(n.relationship_id) && rels.has(n.relationship_id))
    .sort((a, b) => (a.self_reported_at < b.self_reported_at ? 1 : -1));
};

/**
 * Explicit per-question note choice. Omitted = newest eligible notes (capped).
 * An array may only narrow the eligible set and may be empty (no notes at all).
 * Any unknown, foreign, excluded or out-of-scope id rejects the request.
 */
export const pickNotes = (notes: AskNote[], selected: AskSource[], rels: Map<string, AskRelationship>, requested: unknown):
  { ok: true; notes: AskNote[] } | { ok: false; error: string } => {
  const eligible = eligibleNotes(notes, selected, rels);
  if (requested === undefined || requested === null) return { ok: true, notes: eligible.slice(0, ASK_LIMITS.maxNotes) };
  if (!Array.isArray(requested)) return { ok: false, error: "Invalid note selection." };
  const unique = [...new Set(requested)];
  if (unique.length > ASK_LIMITS.maxNotes) return { ok: false, error: `Choose up to ${ASK_LIMITS.maxNotes} notes.` };
  const byId = new Map(eligible.map((n) => [n.id, n]));
  if (unique.some((id) => typeof id !== "string" || !UUID_RE.test(id) || !byId.has(id))) {
    return { ok: false, error: "One of those notes is not available for this question." };
  }
  return { ok: true, notes: eligible.filter((n) => unique.includes(n.id)) };
};

/** Back-compat helper (tests): default note choice. */
export const selectNotes = (notes: AskNote[], selected: AskSource[], rels: Map<string, AskRelationship>) =>
  eligibleNotes(notes, selected, rels).slice(0, ASK_LIMITS.maxNotes);

const TRUSTED_PROVENANCE = new Set(["parsed", "ocr_confirmed"]);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = v.slice(0, 10);
  if (!ISO_DAY.test(d)) return null;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d ? null : d;
};

/**
 * Established provenance rule: only message timestamps parsed from an export or
 * confirmed from reviewed screenshots date a claim. Unknown, user-supplied or
 * inconsistent dates stay undated (never usable for change claims).
 */
export const trustedDay = (o: Pick<AskObservation, "observed_period_start">, s: AskSource | undefined): string | null => {
  if (!s || !TRUSTED_PROVENANCE.has(String(s.date_provenance ?? ""))) return null;
  const d = validDay(o.observed_period_start);
  const a = validDay(s.observed_period_start), b = validDay(s.observed_period_end ?? s.observed_period_start);
  if (!d || !a || !b || d < a || d > b) return null;
  return d;
};

/** Observation types whose evidence excerpts ingestion copied verbatim from supplied messages. */
const VERBATIM_TYPES = /^deep_read\.(behavior|interpretation|joint|context|unresolved_self)(\.recent_window)?$/;
const verifiedExcerpts = (o: AskObservation): string[] =>
  !VERBATIM_TYPES.test(o.observation_type) || !Array.isArray(o.evidence_refs) ? [] :
    (o.evidence_refs as unknown[]).map((r) => {
      const x = (r ?? {}) as { quote?: unknown; speaker?: unknown };
      return typeof x.quote === "string" && "speaker" in x ? x.quote.replace(/\u2026$/, "").trim() : "";
    }).filter((q) => q.length >= 3);
export const hasVerifiedExcerpt = (o: AskObservation) => verifiedExcerpts(o).length > 0;

/** Server fingerprint material: consent, identity, sources, observations and notes, content-sensitive. */
export const askScopeParts = (
  profile: { opted_in_at: string | null; activation_consent_at: string | null; consent_version: number | null },
  selected: AskSource[], obs: AskObservation[], notes: AskNote[],
): string[] => [
  `p:${profile.opted_in_at ?? ""}:${profile.activation_consent_at ?? ""}:${profile.consent_version ?? 0}`,
  ...[...selected].sort((a, b) => (a.id < b.id ? -1 : 1)).map((s) =>
    `s:${s.id}:${s.relationship_id}:${s.identity_status}:${s.subject_participant ?? ""}:${s.subject_participant_id ?? ""}:${s.excluded_at ?? ""}:${s.quarantined_at ?? ""}:${s.updated_at ?? ""}:${s.date_provenance ?? ""}:${s.observed_period_start ?? ""}:${s.observed_period_end ?? ""}`),
  ...[...obs].sort((a, b) => (a.id < b.id ? -1 : 1)).map((o) =>
    `o:${o.id}:${o.version ?? ""}:${o.updated_at ?? ""}:${o.corrected_at ?? ""}:${o.subject_kind}:${o.subject_label ?? ""}:${o.observed_period_start ?? ""}:${o.statement}:${JSON.stringify(o.evidence_refs ?? null)}`),
  ...[...notes].sort((a, b) => (a.id < b.id ? -1 : 1)).map((n) => `n:${n.id}:${n.updated_at ?? ""}:${n.relationship_id ?? ""}:${n.response_text}`),
];

/** Fair share per source, newest first, bounded. */
export const selectObservations = (rows: AskObservation[], selected: AskSource[]) => {
  const ids = new Set(selected.map((s) => s.id));
  const bySource = new Map<string, AskObservation[]>();
  for (const r of rows) {
    if (!ids.has(r.journey_source_id)) continue;
    const l = bySource.get(r.journey_source_id) ?? [];
    l.push(r);
    bySource.set(r.journey_source_id, l);
  }
  for (const l of bySource.values()) l.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const kept: AskObservation[] = [];
  for (let i = 0; kept.length < ASK_LIMITS.maxObservations; i++) {
    let added = false;
    for (const l of bySource.values()) {
      if (i < l.length && kept.length < ASK_LIMITS.maxObservations) { kept.push(l[i]); added = true; }
    }
    if (!added) break;
  }
  return kept;
};

const clean = (s: string, n: number) => s.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);

/** Fenced, short-ref context. Untrusted text cannot close the fences (angle brackets stripped). */
export const buildAskContext = (question: string, obs: AskObservation[], notes: AskNote[], sources: Map<string, AskSource>, rels: Map<string, AskRelationship>) => {
  const back = new Map<string, { kind: "observation" | "note"; id: string }>();
  const sRef = new Map<string, string>();
  const obsRows = obs.map((o, i) => {
    const ref = `O${i + 1}`;
    back.set(ref, { kind: "observation", id: o.id });
    if (!sRef.has(o.journey_source_id)) sRef.set(o.journey_source_id, `S${sRef.size + 1}`);
    const src = sources.get(o.journey_source_id);
    const rel = src ? rels.get(src.relationship_id) : undefined;
    const d = trustedDay(o, src) ?? "undated";
    const ex = verifiedExcerpts(o).slice(0, 2).map((e) => clean(e, 160).replace(/\|/g, "/")).join(" / ");
    return `${ref}|${sRef.get(o.journey_source_id)}|${clean(rel?.label ?? "A relationship", 60)}|${o.subject_kind}|${d}|${clean(o.statement, ASK_LIMITS.statementChars).replace(/\|/g, "/")}|${ex}`;
  });
  const noteRows = notes.map((n, i) => {
    const ref = `N${i + 1}`;
    back.set(ref, { kind: "note", id: n.id });
    return `${ref}|${day(n.self_reported_at)}|${clean(n.response_text, ASK_LIMITS.noteChars)}`;
  });
  const text = `<question>${clean(question, ASK_LIMITS.questionMax)}</question>
<observations>O|source|relationship|about|verified_date|statement|verbatim_excerpt
${obsRows.join("\n")}
</observations>
<self_reported_notes>N|written|text
${noteRows.join("\n")}
</self_reported_notes>`;
  return { text, back };
};

export type AskMoment = {
  kind: "conversation" | "note";
  ref_id: string;
  source_id: string | null;
  label: string;
  date: string | null;
  date_kind: "verified" | "written" | "undated";
  actor: string;
  text: string;
  /** Present only when it matches a retained evidence excerpt exactly. */
  quote: string | null;
};

export type AskAnswer =
  | {
      state: "answered";
      title: string;
      finding: string;
      note_context: string | null;
      next_step: string | null;
      moments: AskMoment[];
      limitation: string;
      support: { sources: number; dated: number; notes: number };
    }
  | { state: "abstained"; reason: string; support: { sources: number; dated: number; notes: number } };

const CERTAINTY = /\b(always|never|definitely|certainly|proves?|proof that|clearly (?:is|are|wants|feels)|diagnos\w*|narcissis\w*|gaslight\w*|manipulat\w*|toxic|disorder|bipolar|borderline|autis\w*|adhd|depress(?:ed|ion)|anxiety disorder|abus(?:e|ive)r?)\b/i;
const MIND_READING = /\b(they|he|she|alex|jordan|the other person)\s+(really\s+)?(feels?|wants?|means?|thinks?|is trying to|doesn'?t care|secretly)\b/i;
const CHANGE = /\b(chang\w*|shift\w*|improv\w*|better|worse|grew|growth|progress\w*|used to|now you)\b/i;
const REPEAT = /\b(repeat\w*|again|pattern\w*|keeps?|often|recurr\w*|usually)\b/i;

const ACTOR: Record<string, string> = {
  user_behavior: "Your message",
  other_behavior: "Their message",
  relationship_context: "About the exchange",
  generated_interpretation: "Our earlier reading",
  ai_advice: "Suggested earlier",
  self_report: "Self-reported",
};
const KIND_LABEL: Record<string, string> = { quick_take: "Quick Take", deep_read: "Deep Read", group_read: "Group Read", group_roast: "Group Roast" };


/** Validate model output against the exact supplied evidence. Never trusts model ids or quotes. */
export const validateAskOutput = (
  raw: unknown,
  back: Map<string, { kind: "observation" | "note"; id: string }>,
  obs: AskObservation[],
  notes: AskNote[],
  sources: Map<string, AskSource>,
  rels: Map<string, AskRelationship>,
): AskAnswer => {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const obsById = new Map(obs.map((x) => [x.id, x]));
  const noteById = new Map(notes.map((x) => [x.id, x]));
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const moments: AskMoment[] = [];
  const seen = new Set<string>();
  for (const m of Array.isArray(o.moments) ? o.moments : []) {
    const ref = typeof (m as { ref?: unknown })?.ref === "string" ? (m as { ref: string }).ref.trim() : "";
    const target = back.get(ref);
    if (!target || seen.has(target.id)) continue;
    seen.add(target.id);
    if (target.kind === "observation") {
      const ob = obsById.get(target.id);
      if (!ob) continue;
      const src = sources.get(ob.journey_source_id);
      const rel = src ? rels.get(src.relationship_id) : undefined;
      const q = str((m as { quote?: unknown }).quote, 300);
      const quote = q && verifiedExcerpts(ob).some((e) => e === q || (q.length >= 12 && e.includes(q))) ? q : null;
      const vd = trustedDay(ob, src);
      moments.push({
        kind: "conversation", ref_id: ob.id, source_id: ob.journey_source_id,
        label: `${KIND_LABEL[src?.source_kind ?? ""] ?? "Read"}${rel?.label ? ` · ${rel.label}` : ""}`,
        date: vd, date_kind: vd ? "verified" : "undated",
        actor: ACTOR[ob.subject_kind] ?? "From a read", text: ob.statement.slice(0, ASK_LIMITS.statementChars), quote,
      });
    } else {
      const n = noteById.get(target.id);
      if (!n) continue;
      moments.push({ kind: "note", ref_id: n.id, source_id: null, label: "My reflection", date: day(n.self_reported_at), date_kind: "written", actor: "Your note", text: n.response_text.slice(0, ASK_LIMITS.noteChars), quote: null });
    }
    if (moments.length >= ASK_LIMITS.maxMoments) break;
  }
  const conv = moments.filter((m) => m.kind === "conversation");
  const support = {
    sources: new Set(conv.map((m) => m.source_id)).size,
    dated: new Set(conv.filter((m) => m.date_kind === "verified").map((m) => m.date)).size,
    notes: moments.length - conv.length,
  };
  const dated = conv.filter((m) => m.date_kind === "verified" && m.date);
  // A change needs two different reads whose verified days differ; one read is never enough.
  const changeSupported = dated.some((a) => dated.some((b) => a.source_id !== b.source_id && a.date !== b.date));
  const abstain = (reason: string): AskAnswer => ({ state: "abstained", reason, support });
  const finding = str(o.finding, 500);
  const title = str(o.title, 120);
  if (o.answerable === false || !finding || !title) return abstain(str(o.limitation, 300) || "Your included reads do not say enough to answer that.");
  if (conv.length === 0) return abstain("No conversation evidence supports an answer. Notes alone are your reflection, not evidence.");
  const nextStep = str(o.next_step, 300) || null;
  const noteContext = support.notes > 0 ? str(o.note_context, 300) || null : null;
  const visible = [title, finding, nextStep ?? "", noteContext ?? ""].join(" ");
  if (CERTAINTY.test(visible) || MIND_READING.test(visible)) return abstain("An answer would need more certainty than your reads support.");
  if (CHANGE.test(`${title} ${finding}`) && !changeSupported) return abstain("Describing a change needs evidence from at least two different reads with different verified dates.");
  if (REPEAT.test(`${title} ${finding}`) && support.sources < 2) return abstain("Calling something a pattern needs support from at least two different reads.");
  return {
    state: "answered", title, finding, note_context: noteContext, next_step: nextStep, moments,
    limitation: "Based on the sources you included. A reflection, not a verdict.", support,
  };
};

/** Short non-cryptographic digest so client keys never hold note text. */
export const digest = (v: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
};

/** Client-side: a visible or in-flight answer is valid only for the exact scope it was asked in. */
export const askScopeKey = (p: {
  optedIn: boolean; consentCurrent: boolean;
  sources: { id: string; version?: string | null }[];
  selected: string[];
  notes: { id: string; updated_at?: string | null; response_text: string }[];
  selectedNotes: string[];
}) => [
  p.optedIn ? "on" : "off", p.consentCurrent ? "c1" : "c0",
  [...p.sources].map((s) => `${s.id}@${s.version ?? ""}`).sort().join(","),
  [...p.selected].sort().join(","),
  [...p.notes].map((n) => `${n.id}@${n.updated_at ?? ""}#${digest(n.response_text)}`).sort().join(","),
  [...p.selectedNotes].sort().join(","),
].join("|");
