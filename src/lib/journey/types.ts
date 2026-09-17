export type RelationshipKind = "romantic" | "friend" | "family" | "work_group";

export const RELATIONSHIP_KINDS: { value: RelationshipKind; label: string }[] = [
  { value: "romantic", label: "Romantic" },
  { value: "friend", label: "Friend" },
  { value: "family", label: "Family" },
  { value: "work_group", label: "Work group" },
];

export type JourneySourceKind = "quick_take" | "deep_read" | "group_read" | "group_roast";

export const SOURCE_KIND_LABELS: Record<JourneySourceKind, string> = {
  quick_take: "Quick Take",
  deep_read: "Deep Read",
  group_read: "Group Read",
  group_roast: "Group Roast",
};

export type JourneyRelationship = {
  id: string;
  kind: RelationshipKind;
  label: string;
  data_version: number;
  created_at: string;
};

export type JourneySource = {
  id: string;
  relationship_id: string;
  source_kind: JourneySourceKind;
  source_id: string;
  subject_participant: string | null;
  observed_period_start: string | null;
  observed_period_end: string | null;
  uploaded_at: string;
  consent_at: string;
  excluded_at: string | null;
};

/** A report the signed-in person owns and may choose to link into a Journey. */
export type LinkableReport = {
  kind: JourneySourceKind;
  id: string;
  label: string;
  created_at: string;
};
