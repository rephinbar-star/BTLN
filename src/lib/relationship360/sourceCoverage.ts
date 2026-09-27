/**
 * Source-level coverage lines for Relationship360, from stored server metadata only.
 * "Supplied" = messages imported for that conversation (dated + undated, as recorded).
 * Close speaker attribution in Deep Read covers at most the most recent 400 messages.
 */
export type R360SourceMeta = {
  id: string;
  source_kind: string;
  dated_count: number | null;
  undated_count: number | null;
  date_provenance: string | null; // parsed | user_supplied | unknown
  date_precision: string | null;
  observed_period_start: string | null;
  observed_period_end: string | null;
};

export const ATTRIBUTION_WINDOW = 400;

const KIND_LABEL: Record<string, string> = {
  deep_read: "Deep Read",
  quick_take: "Quick Take",
  decode: "Quick Take",
  group_read: "Group Read",
  interactive: "Interactive",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const describeSource = (s: R360SourceMeta, observationsFromSource: number) => {
  const dated = Math.max(0, s.dated_count ?? 0);
  const undated = Math.max(0, s.undated_count ?? 0);
  const recorded = s.dated_count != null || s.undated_count != null;
  const supplied = dated + undated;
  const count = !recorded || supplied === 0
    ? "Message count not recorded"
    : `${supplied.toLocaleString("en-US")} message${supplied === 1 ? "" : "s"} supplied${undated > 0 ? ` (${undated.toLocaleString("en-US")} undated)` : ""}`;

  let dates = "Dates unknown";
  if (s.observed_period_start && s.date_provenance !== "unknown") {
    const a = fmt(s.observed_period_start);
    const b = s.observed_period_end ? fmt(s.observed_period_end) : a;
    const range = a === b ? a : `${a} – ${b}`;
    dates = s.date_provenance === "user_supplied" ? `${range} (period you entered)` : `${range} (from message dates)`;
  }

  const attribution = s.source_kind === "deep_read" && supplied > 0
    ? supplied > ATTRIBUTION_WINDOW
      ? `Speakers checked closely in the most recent ${ATTRIBUTION_WINDOW} only`
      : `Speakers checked closely in all ${supplied}`
    : null;

  return {
    kind: KIND_LABEL[s.source_kind] ?? "Conversation",
    count,
    dates,
    attribution,
    used: `${observationsFromSource} observation${observationsFromSource === 1 ? "" : "s"} used`,
  };
};
