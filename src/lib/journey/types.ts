export type RelationshipKind = "romantic" | "friend" | "family" | "work_group" | "unspecified";

export const RELATIONSHIP_KINDS: { value: RelationshipKind; label: string }[] = [
  { value: "romantic", label: "Romantic" },
  { value: "friend", label: "Friend" },
  { value: "family", label: "Family" },
  { value: "work_group", label: "Work group" },
  { value: "unspecified", label: "Not set yet" },
];

/** Scope is how many people are in the relationship; kind is the context. They stay separate. */
export type RelationshipScope = "pair" | "group";

export const RELATIONSHIP_SCOPES: { value: RelationshipScope; label: string }[] = [
  { value: "pair", label: "Two people" },
  { value: "group", label: "A group" },
];

export type JourneySourceKind = "quick_take" | "deep_read" | "group_read" | "group_roast";

export const SOURCE_KIND_LABELS: Record<JourneySourceKind, string> = {
  quick_take: "Quick Take",
  deep_read: "Deep Read",
  group_read: "Group Read",
  group_roast: "Group Roast",
};

/** confirmed = the person said which participant is them; pending = still to identify;
 *  absent = they told us they are not in this conversation, so it never contributes. */
export type IdentityStatus = "confirmed" | "pending" | "absent";

export type JourneyRelationship = {
  id: string;
  kind: RelationshipKind;
  scope: RelationshipScope;
  label: string;
  /** False while the person has not yet said who this relationship is about. */
  is_confirmed: boolean;
  data_version: number;
  created_at: string;
};

export type JourneySource = {
  id: string;
  relationship_id: string;
  source_kind: JourneySourceKind;
  source_id: string;
  subject_participant: string | null;
  identity_status: IdentityStatus;
  observed_period_start: string | null;
  observed_period_end: string | null;
  /** How exact the dates are, and where they came from. Unknown stays unknown. */
  date_precision: "unknown" | "date" | "minute";
  date_provenance: "unknown" | "parsed" | "ocr_confirmed" | "user_supplied";
  dated_count: number;
  undated_count: number;
  date_note: string | null;
  uploaded_at: string;
  consent_at: string;
  excluded_at: string | null;
};

/** What the person sees for each included conversation. */
export type SourceState = "included" | "excluded" | "identify" | "not_you";

export function sourceState(s: JourneySource): SourceState {
  if (s.identity_status === "absent") return "not_you";
  if (s.excluded_at) return "excluded";
  if (s.identity_status !== "confirmed" || !s.subject_participant) return "identify";
  return "included";
}

export const SOURCE_STATE_LABELS: Record<SourceState, string> = {
  included: "Included",
  excluded: "Excluded",
  identify: "Identify yourself to include",
  not_you: "You are not in this conversation",
};

/** A report the signed-in person owns and may choose to link into a Journey. */
export type LinkableReport = {
  kind: JourneySourceKind;
  id: string;
  label: string;
  created_at: string;
};

export type JourneyProfileState = {
  optedInAt: string | null;
  autoInclude: boolean;
  activationConsentAt: string | null;
  consentVersion: number;
};

/** The consent wording that is current. Older profiles must re-confirm, never be widened. */
export const CURRENT_CONSENT_VERSION = 2;
