// Relationship360 source adapters.
//
// Turns a completed report the person owns into normalised, provenance-tagged
// observations. Hard rules encoded here:
//  - Actors come from STRUCTURED attribution only (a named speaker field, a role
//    card's participant, a confirmed sent reply). We never decide who did what by
//    looking for the person's name inside a sentence: "Alex avoids answering
//    Taylor" is not Taylor's behaviour.
//  - A claim about the pair or group with no structured actor stays
//    relationship_context. It is never promoted to anyone's behaviour.
//  - Interpretive prose written by the model is generated_interpretation.
//  - Suggested replies are ai_advice, never evidence that the person did anything.
//  - Group Roast comic labels are entertainment: they contribute coverage only.
//  - Dates describe when the exchange happened. The date a report was produced is
//    never used as the observed date; unknown stays unknown.
//  - No raw uploaded transcript is copied; only the derived evidence the report
//    already stored is carried forward, clipped and bounded.

export type SubjectKind =
  | "user_behavior"
  | "other_behavior"
  | "ai_advice"
  | "self_report"
  | "relationship_context"
  | "generated_interpretation";

export type ObservationDraft = {
  subject_kind: SubjectKind;
  /** The actual actor, or null when no structured actor is known. Never a default. */
  subject_label: string | null;
  observation_type: string;
  statement: string;
  evidence_refs: { quote: string; speaker?: string | null; label: string }[];
  confidence: "low" | "medium" | "high";
  alternatives: string[];
  observed_period_start: string | null;
  observed_period_end: string | null;
};

const MAX_STATEMENT = 1_200;
const MAX_QUOTE = 400;
const MAX_PER_SOURCE = 12;

// deno-lint-ignore no-explicit-any
const obj = (value: any): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const text = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const clip = (value: string, max = MAX_STATEMENT) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

const quotesFrom = (value: unknown, label: string) =>
  text(value)
    .split(/\s+\/\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 3)
    .map((quote) => ({ quote: clip(quote, MAX_QUOTE), label }));

export type Ctx = {
  /** The participant the person confirmed is them, exactly as the report names them. */
  subject: string | null;
  /** Human label of the source, used on evidence lines. */
  label: string;
  /** Verified period of the exchange itself. Null when the messages carried no dates. */
  observedStart: string | null;
  observedEnd: string | null;
};

/**
 * Structured attribution. `actor` must come from a field that names a speaker —
 * never from scanning prose. An unknown actor yields relationship_context.
 */
export const classify = (actor: string | null | undefined, ctx: Ctx): { kind: SubjectKind; label: string | null } => {
  const name = (actor ?? "").trim();
  if (!name) return { kind: "relationship_context", label: null };
  const subject = (ctx.subject ?? "").trim();
  if (subject && name.toLowerCase() === subject.toLowerCase()) return { kind: "user_behavior", label: name };
  return { kind: "other_behavior", label: name };
};

const make = (
  ctx: Ctx,
  kind: SubjectKind,
  subjectLabel: string | null,
  observationType: string,
  statement: string,
  evidence: { quote: string; speaker?: string | null; label: string }[] = [],
  confidence: ObservationDraft["confidence"] = "medium",
): ObservationDraft | null => {
  const trimmed = clip(statement.trim());
  if (trimmed.length < 8) return null;
  return {
    subject_kind: kind,
    subject_label: subjectLabel,
    observation_type: observationType,
    statement: trimmed,
    evidence_refs: evidence.slice(0, 3),
    confidence,
    alternatives: [],
    observed_period_start: ctx.observedStart,
    observed_period_end: ctx.observedEnd,
  };
};

/** Structured actor for a report field, when the report provides one. */
// deno-lint-ignore no-explicit-any
const actorField = (value: any): string | null => {
  const record = obj(value);
  const candidate = text(record.speaker ?? record.participant ?? record.display_name ?? record.name ?? record.actor ?? record.sender);
  return candidate || null;
};

const attributed = (
  ctx: Ctx,
  actor: string | null,
  observationType: string,
  statement: string,
  evidence: { quote: string; speaker?: string | null; label: string }[] = [],
  confidence: ObservationDraft["confidence"] = "medium",
) => {
  const { kind, label } = classify(actor, ctx);
  return make(ctx, kind, label, observationType, statement, evidence, confidence);
};

// deno-lint-ignore no-explicit-any
export const adaptDeepRead = (result: any, ctx: Ctx): ObservationDraft[] => {
  const root = obj(result);
  const out: (ObservationDraft | null)[] = [];
  const diagnostic = obj(root.communication_diagnostic);
  for (const key of ["key_observation", "initiator_balance", "question_ratio", "response_time_asymmetry"]) {
    const raw = diagnostic[key];
    const statement = typeof raw === "string" ? text(raw) : text(obj(raw).description ?? obj(raw).text);
    if (statement) out.push(attributed(ctx, actorField(raw), `communication.${key}`, statement, [], "medium"));
  }
  const hidden = obj(root.hidden_pattern);
  const hiddenTitle = text(hidden.title);
  const hiddenBody = text(hidden.description);
  if (hiddenBody) {
    const statement = hiddenTitle ? `${hiddenTitle}: ${hiddenBody}` : hiddenBody;
    out.push(attributed(ctx, actorField(hidden), "pattern", statement, quotesFrom(hidden.evidence, ctx.label), "medium"));
  }
  for (const flag of Array.isArray(root.green_flags) ? root.green_flags.slice(0, 3) : []) {
    const statement = text(typeof flag === "string" ? flag : obj(flag).description ?? obj(flag).title);
    if (statement) out.push(attributed(ctx, actorField(flag), "strength", statement, [], "medium"));
  }
  for (const item of Array.isArray(root.communication_suggestions) ? root.communication_suggestions.slice(0, 3) : []) {
    const statement = text(typeof item === "string" ? item : obj(item).suggestion ?? obj(item).text);
    if (statement) out.push(make(ctx, "ai_advice", null, "suggestion.not_sent", statement, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, MAX_PER_SOURCE);
};

// deno-lint-ignore no-explicit-any
export const adaptQuickTake = (result: any, ctx: Ctx): ObservationDraft[] => {
  const root = obj(result);
  const out: (ObservationDraft | null)[] = [];
  const read = root.read;
  const readText = typeof read === "string" ? text(read) : text(obj(read).subtext) || text(obj(read).flag);
  // A Quick Take "read" is the model's interpretation of the exchange, not a
  // recorded action by either person.
  if (readText) out.push(make(ctx, "generated_interpretation", null, "read", readText, [], "low"));
  const verdict = text(root.verdict);
  if (verdict) out.push(make(ctx, "generated_interpretation", null, "read.verdict", verdict, [], "low"));
  const signals = Array.isArray(root.signals) ? root.signals.map(text).filter(Boolean).slice(0, 5) : [];
  if (signals.length) {
    out.push(make(ctx, "relationship_context", null, "signals", `Signals read from this exchange: ${signals.join(", ")}.`, [], "low"));
  }
  const replies = Array.isArray(root.reply_options) ? root.reply_options : Array.isArray(root.replies) ? root.replies : [];
  for (const reply of replies.slice(0, 3)) {
    const statement = text(typeof reply === "string" ? reply : obj(reply).text);
    if (statement) out.push(make(ctx, "ai_advice", null, "suggestion.not_sent", `Suggested reply (not known to be sent): ${statement}`, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, MAX_PER_SOURCE);
};

// deno-lint-ignore no-explicit-any
export const adaptGroupRead = (result: any, ctx: Ctx): ObservationDraft[] => {
  const root = obj(result);
  const out: (ObservationDraft | null)[] = [];
  const summary = text(root.group_summary);
  if (summary) out.push(make(ctx, "relationship_context", null, "group.summary", summary, [], "medium"));
  for (const key of ["balance", "initiation", "unanswered"]) {
    const value = root[key];
    const statement = typeof value === "string" ? text(value) : text(obj(value).description ?? obj(value).note);
    if (statement) out.push(attributed(ctx, actorField(value), `group.${key}`, statement, [], "medium"));
  }
  for (const card of Array.isArray(root.role_cards) ? root.role_cards : []) {
    const person = text(obj(card).display_name ?? obj(card).name);
    const role = text(obj(card).role ?? obj(card).title);
    const why = text(obj(card).description ?? obj(card).why);
    if (!role && !why) continue;
    const statement = `${person || "A participant"} — ${role}${why ? `: ${why}` : ""}`;
    out.push(attributed(ctx, person || null, "group.role", statement, [], "medium"));
  }
  for (const strength of Array.isArray(root.group_strengths) ? root.group_strengths.slice(0, 3) : []) {
    const statement = text(typeof strength === "string" ? strength : obj(strength).description);
    if (statement) out.push(attributed(ctx, actorField(strength), "strength", statement, [], "medium"));
  }
  for (const item of Array.isArray(root.suggestions) ? root.suggestions.slice(0, 3) : []) {
    const statement = text(typeof item === "string" ? item : obj(item).text ?? obj(item).suggestion);
    if (statement) out.push(make(ctx, "ai_advice", null, "suggestion.not_sent", statement, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, MAX_PER_SOURCE);
};

/**
 * Group Roast is comedy. Its jokes and comic labels are never psychological
 * evidence, so it contributes no observations at all — only the fact that a
 * conversation of that period exists, which the caller records as coverage.
 */
export const adaptGroupRoast = (): ObservationDraft[] => [];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** Only a verified exchange date counts. A submission timestamp does not. */
const exchangeDay = (value: unknown): string | null => {
  const raw = text(value);
  return ISO_DAY.test(raw) ? raw.slice(0, 10) : null;
};

/**
 * Interactive Mode. A reply the person confirmed they actually sent is their
 * own behaviour; everything the model offered stays advice. The observed date is
 * the date of the exchange when the event carries one — never the date the
 * person happened to open the app.
 */
// deno-lint-ignore no-explicit-any
export const adaptInteractiveEvent = (event: any, ctx: Ctx): ObservationDraft[] => {
  const row = obj(event);
  const type = text(row.event_type);
  const result = obj(row.result_json);
  const provenance = obj(row.provenance);
  const out: (ObservationDraft | null)[] = [];

  const day = exchangeDay(result.exchange_date ?? result.observed_date ?? provenance.exchange_date ?? provenance.observed_date);
  const local: Ctx = day
    ? { ...ctx, observedStart: day, observedEnd: day }
    // No verified exchange date: inherit the source's verified period, or stay unknown.
    : { ...ctx };

  if (type === "sent_reply") {
    out.push(make(local, "user_behavior", ctx.subject, "interactive.sent_reply", "You continued this exchange with a reply you confirmed you sent.", [], "high"));
  } else if (type === "no_reply" || type === "chose_not_to_reply") {
    out.push(make(local, "user_behavior", ctx.subject, "interactive.no_reply", type === "chose_not_to_reply"
      ? "You decided not to reply to this exchange."
      : "No reply was sent in this exchange.", [], "high"));
  } else if (type === "self_report") {
    const note = text(result.note) || text(result.self_reported);
    out.push(make(local, "self_report", ctx.subject, "interactive.self_report", note
      ? `Self-reported by you: ${note}`
      : "You recorded your own note about what happened next.", [], "low"));
  }

  const read = typeof result.read === "string" ? text(result.read) : text(obj(result.read).subtext);
  if (read && type === "observed_followup") {
    out.push(make(local, "generated_interpretation", null, "interactive.followup", read, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, 4);
};
