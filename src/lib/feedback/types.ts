// Shared feedback contract for every AI-generated surface in the app.
//
// Ratings are always bound to (source_kind, source_id, target_kind, target_key)
// plus the generation metadata of the response that was rated, so a later
// regeneration is never credited or blamed for an earlier rating.

export type FeedbackSourceKind =
  | "quick_take"
  | "deep_read"
  | "group_read"
  | "group_roast"
  | "interactive"
  | "relationship360";

export type FeedbackTargetKind =
  | "overall"
  | "reply_option"
  | "section"
  | "recommendation"
  | "insight"
  | "introspection"
  | "turn"
  | "review"
  | "humor";

export type FeedbackRating = "up" | "down";

export type FeedbackOutcome = "used" | "not_used" | "modified" | "unknown";

/** Which model/prompt produced the rated text. Recorded, never inferred. */
export type GenerationRef = {
  /** Stable id of the generation that produced this text, when known. */
  generationId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
};

export type FeedbackTarget = GenerationRef & {
  sourceKind: FeedbackSourceKind;
  sourceId: string;
  targetKind: FeedbackTargetKind;
  /** Stable within the source, e.g. "reply_2" or "pattern:repair_attempts". */
  targetKey?: string;
};

export type FeedbackRecord = {
  targetKind: FeedbackTargetKind;
  targetKey: string;
  rating: FeedbackRating;
  reasonCodes: string[];
  comment: string | null;
  outcome: FeedbackOutcome | null;
};

export type ReasonChip = { code: string; label: string };

const POSITIVE_DEFAULT: ReasonChip[] = [
  { code: "accurate", label: "Accurate" },
  { code: "useful", label: "Useful" },
  { code: "felt_understood", label: "Felt understood" },
  { code: "actionable", label: "Actionable" },
];

const NEGATIVE_DEFAULT: ReasonChip[] = [
  { code: "inaccurate", label: "Inaccurate" },
  { code: "misread_speaker", label: "Misread who said what" },
  { code: "missing_context", label: "Missing context" },
  { code: "too_generic", label: "Too generic" },
  { code: "repetitive", label: "Repetitive" },
  { code: "unhelpful_suggestion", label: "Unhelpful suggestion" },
  { code: "too_certain", label: "Too certain" },
  { code: "tone_off", label: "Tone felt off" },
];

const HUMOR_POSITIVE: ReasonChip[] = [
  { code: "funny", label: "Funny" },
  { code: "on_point", label: "On point" },
  { code: "shareable", label: "Shareable" },
];

const HUMOR_NEGATIVE: ReasonChip[] = [
  { code: "not_funny", label: "Not funny" },
  { code: "too_harsh", label: "Too harsh" },
  { code: "missing_context", label: "Missing context" },
  { code: "repetitive", label: "Repetitive" },
];

export const reasonChipsFor = (
  rating: FeedbackRating,
  target: Pick<FeedbackTarget, "sourceKind" | "targetKind">,
): ReasonChip[] => {
  const humor = target.targetKind === "humor" || target.sourceKind === "group_roast";
  if (humor) return rating === "up" ? HUMOR_POSITIVE : HUMOR_NEGATIVE;
  return rating === "up" ? POSITIVE_DEFAULT : NEGATIVE_DEFAULT;
};

/** Reason codes that mean "the read got the facts wrong", which should offer
 *  the existing correction flow rather than silently changing anything. */
export const CORRECTION_REASON_CODES = new Set(["misread_speaker", "missing_context"]);

export const targetId = (target: FeedbackTarget): string =>
  `${target.sourceKind}:${target.sourceId}:${target.targetKind}:${target.targetKey ?? "main"}`;
