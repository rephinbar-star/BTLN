// Relationship360 source adapters.
//
// Turns a completed report the person owns into normalised, provenance-tagged
// observations. Hard rules encoded here:
//  - Nothing is attributed to the person unless the text names the participant
//    they confirmed as themselves. Otherwise it is someone else's behaviour.
//  - Suggested replies are advice, never evidence that the person did anything.
//  - Group Roast comic labels are entertainment: they contribute coverage only,
//    never a psychological observation.
//  - No raw uploaded transcript is copied; only the derived evidence the report
//    already stored is carried forward, clipped and bounded.

export type ObservationDraft = {
  subject_kind: "user_behavior" | "other_behavior" | "ai_advice" | "self_report";
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

/** Identity is confirmed by the person, never matched by name across conversations. */
const mentions = (statement: string, subject: string | null) => {
  if (!subject) return false;
  const name = subject.trim().toLowerCase();
  if (name.length < 2) return false;
  return statement.toLowerCase().includes(name);
};

const quotesFrom = (value: unknown, label: string) =>
  text(value)
    .split(/\s+\/\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 3)
    .map((quote) => ({ quote: clip(quote, MAX_QUOTE), label }));

type Ctx = {
  /** The participant the person confirmed is them. */
  subject: string | null;
  /** Human label of the source, used on evidence lines. */
  label: string;
  observedStart: string | null;
  observedEnd: string | null;
};

const make = (
  ctx: Ctx,
  kind: ObservationDraft["subject_kind"],
  observationType: string,
  statement: string,
  evidence: { quote: string; speaker?: string | null; label: string }[] = [],
  confidence: ObservationDraft["confidence"] = "medium",
): ObservationDraft | null => {
  const trimmed = clip(statement.trim());
  if (trimmed.length < 8) return null;
  return {
    subject_kind: kind,
    subject_label: ctx.subject,
    observation_type: observationType,
    statement: trimmed,
    evidence_refs: evidence.slice(0, 3),
    confidence,
    alternatives: [],
    observed_period_start: ctx.observedStart,
    observed_period_end: ctx.observedEnd,
  };
};

/** Behaviour statements go to the person only when the text names the participant they confirmed. */
const behaviourKind = (statement: string, ctx: Ctx): ObservationDraft["subject_kind"] =>
  mentions(statement, ctx.subject) ? "user_behavior" : "other_behavior";

// deno-lint-ignore no-explicit-any
export const adaptDeepRead = (result: any, ctx: Ctx): ObservationDraft[] => {
  const root = obj(result);
  const out: (ObservationDraft | null)[] = [];
  const diagnostic = obj(root.communication_diagnostic);
  for (const key of ["key_observation", "initiator_balance", "question_ratio", "response_time_asymmetry"]) {
    const statement = text(diagnostic[key]);
    if (statement) out.push(make(ctx, behaviourKind(statement, ctx), `communication.${key}`, statement, [], "medium"));
  }
  const hidden = obj(root.hidden_pattern);
  const hiddenTitle = text(hidden.title);
  const hiddenBody = text(hidden.description);
  if (hiddenBody) {
    const statement = hiddenTitle ? `${hiddenTitle}: ${hiddenBody}` : hiddenBody;
    out.push(make(ctx, behaviourKind(statement, ctx), "pattern", statement, quotesFrom(hidden.evidence, ctx.label), "medium"));
  }
  for (const flag of Array.isArray(root.green_flags) ? root.green_flags.slice(0, 3) : []) {
    const statement = text(typeof flag === "string" ? flag : obj(flag).description ?? obj(flag).title);
    if (statement) out.push(make(ctx, behaviourKind(statement, ctx), "strength", statement, [], "medium"));
  }
  for (const item of Array.isArray(root.communication_suggestions) ? root.communication_suggestions.slice(0, 3) : []) {
    const statement = text(typeof item === "string" ? item : obj(item).suggestion ?? obj(item).text);
    if (statement) out.push(make(ctx, "ai_advice", "suggestion.not_sent", statement, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, MAX_PER_SOURCE);
};

// deno-lint-ignore no-explicit-any
export const adaptQuickTake = (result: any, ctx: Ctx): ObservationDraft[] => {
  const root = obj(result);
  const out: (ObservationDraft | null)[] = [];
  const read = root.read;
  const readText = typeof read === "string" ? text(read) : text(obj(read).subtext) || text(obj(read).flag);
  if (readText) out.push(make(ctx, behaviourKind(readText, ctx), "read", readText, [], "low"));
  const verdict = text(root.verdict);
  if (verdict) out.push(make(ctx, behaviourKind(verdict, ctx), "read.verdict", verdict, [], "low"));
  const signals = Array.isArray(root.signals) ? root.signals.map(text).filter(Boolean).slice(0, 5) : [];
  if (signals.length) {
    out.push(make(ctx, "other_behavior", "signals", `Signals read from this exchange: ${signals.join(", ")}.`, [], "low"));
  }
  // Suggested replies are advice the person may never have used.
  const replies = Array.isArray(root.reply_options) ? root.reply_options : Array.isArray(root.replies) ? root.replies : [];
  for (const reply of replies.slice(0, 3)) {
    const statement = text(typeof reply === "string" ? reply : obj(reply).text);
    if (statement) out.push(make(ctx, "ai_advice", "suggestion.not_sent", `Suggested reply (not known to be sent): ${statement}`, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, MAX_PER_SOURCE);
};

// deno-lint-ignore no-explicit-any
export const adaptGroupRead = (result: any, ctx: Ctx): ObservationDraft[] => {
  const root = obj(result);
  const out: (ObservationDraft | null)[] = [];
  const summary = text(root.group_summary);
  if (summary) out.push(make(ctx, "other_behavior", "group.summary", summary, [], "medium"));
  for (const key of ["balance", "initiation", "unanswered"]) {
    const value = root[key];
    const statement = typeof value === "string" ? text(value) : text(obj(value).description ?? obj(value).note);
    if (statement) out.push(make(ctx, behaviourKind(statement, ctx), `group.${key}`, statement, [], "medium"));
  }
  for (const card of Array.isArray(root.role_cards) ? root.role_cards : []) {
    const person = text(obj(card).display_name ?? obj(card).name);
    const role = text(obj(card).role ?? obj(card).title);
    const why = text(obj(card).description ?? obj(card).why);
    if (!role && !why) continue;
    const statement = `${person || "A participant"} — ${role}${why ? `: ${why}` : ""}`;
    // Only the participant the person confirmed as themselves becomes their own behaviour.
    const kind = ctx.subject && person && person.trim().toLowerCase() === ctx.subject.trim().toLowerCase()
      ? "user_behavior"
      : "other_behavior";
    out.push(make(ctx, kind, "group.role", statement, [], "medium"));
  }
  for (const strength of Array.isArray(root.group_strengths) ? root.group_strengths.slice(0, 3) : []) {
    const statement = text(typeof strength === "string" ? strength : obj(strength).description);
    if (statement) out.push(make(ctx, "other_behavior", "strength", statement, [], "medium"));
  }
  for (const item of Array.isArray(root.suggestions) ? root.suggestions.slice(0, 3) : []) {
    const statement = text(typeof item === "string" ? item : obj(item).text ?? obj(item).suggestion);
    if (statement) out.push(make(ctx, "ai_advice", "suggestion.not_sent", statement, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, MAX_PER_SOURCE);
};

/**
 * Group Roast is comedy. Its jokes and comic labels are never psychological
 * evidence, so it contributes no observations at all — only the fact that a
 * conversation of that period exists, which the caller records as coverage.
 */
export const adaptGroupRoast = (): ObservationDraft[] => [];

/**
 * Interactive Mode. A reply the person confirmed they actually sent is their
 * own behaviour; everything the model offered stays advice.
 */
// deno-lint-ignore no-explicit-any
export const adaptInteractiveEvent = (event: any, ctx: Ctx): ObservationDraft[] => {
  const row = obj(event);
  const type = text(row.event_type);
  const result = obj(row.result_json);
  const out: (ObservationDraft | null)[] = [];
  const when = text(row.completed_at) || text(row.created_at) || null;
  const local: Ctx = { ...ctx, observedStart: when ? when.slice(0, 10) : ctx.observedStart, observedEnd: when ? when.slice(0, 10) : ctx.observedEnd };

  if (type === "sent_reply") {
    out.push(make(local, "user_behavior", "interactive.sent_reply", "You continued this exchange with a reply you confirmed you sent.", [], "high"));
  } else if (type === "no_reply" || type === "chose_not_to_reply") {
    out.push(make(local, "user_behavior", "interactive.no_reply", type === "chose_not_to_reply"
      ? "You decided not to reply to this exchange."
      : "No reply was sent in this exchange.", [], "high"));
  } else if (type === "self_report") {
    const note = text(result.note) || text(result.self_reported);
    out.push(make(local, "self_report", "interactive.self_report", note
      ? `Self-reported by you: ${note}`
      : "You recorded your own note about what happened next.", [], "low"));
  }

  const read = typeof result.read === "string" ? text(result.read) : text(obj(result.read).subtext);
  if (read && type === "observed_followup") {
    out.push(make(local, behaviourKind(read, local), "interactive.followup", read, [], "low"));
  }
  return out.filter((item): item is ObservationDraft => Boolean(item)).slice(0, 4);
};
