import { supabase } from "@/integrations/supabase/client";
import type { ResolvedEvidence } from "@/lib/relationship360/select";
import type { R360Pattern, R360Recommendation, R360Working } from "@/lib/relationship360/types";

/**
 * The real Relationship360, as opposed to the public fictional preview.
 * Everything here comes from the person's own confirmed, included reports;
 * the server re-checks ownership, identity and Prime on every call.
 */

export type LiveObservation = {
  id: string;
  journey_source_id: string;
  subject_kind: "user_behavior" | "other_behavior" | "ai_advice" | "self_report";
  subject_label: string | null;
  observation_type: string;
  statement: string;
  evidence_refs: { quote: string; speaker?: string | null; label: string }[] | null;
  confidence: "low" | "medium" | "high";
  observed_period_start: string | null;
  observed_period_end: string | null;
  created_at: string;
};

export type LiveContent = {
  headline: string;
  narrative: string;
  takeaways: { id: string; label: string }[];
  patterns: (Omit<R360Pattern, "evidence"> & { evidence: string[] })[];
  working: (Omit<R360Working, "evidence"> & { evidence: string[] })[];
  recommendations: (Omit<R360Recommendation, "evidence"> & { evidence: string[] })[];
};

export type LiveSummary = {
  id: string;
  scope: "relationship" | "cross_relationship";
  relationship_id: string | null;
  content: LiveContent | null;
  coverage: { sources?: number; relationships?: number; observations?: number; single_read?: boolean } | null;
  is_stale: boolean;
  generated_at: string;
  model: string | null;
  evidence_source_ids: string[] | null;
};

export type LiveJob = {
  id: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  error_message: string | null;
  created_at: string;
};

export type LiveReflection = {
  id: string;
  recommendation_id: string | null;
  reflection_kind: "reflection" | "action_outcome" | "review_note";
  response_text: string;
  outcome: "used" | "partly_used" | "not_used" | "not_applicable" | null;
  self_reported_at: string;
  relationship_id: string | null;
};

export type LiveStatus = {
  prime: boolean;
  opted_in: boolean;
  counts: { linked: number; eligible: number; pending: number };
  summary: LiveSummary | null;
  job: LiveJob | null;
  observations: LiveObservation[];
  reflections: LiveReflection[];
};

export type BuildResult =
  | { state: "complete"; coverage: Record<string, unknown>; content: LiveContent }
  | { state: "no_evidence" | "updating" | "cancelled" | "failed"; message?: string; error?: string };

const call = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("relationship360", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
};

export const getLiveStatus = (relationshipId: string | null) =>
  call<LiveStatus>({ action: "status", relationship_id: relationshipId });

export const buildLive = (relationshipId: string | null) =>
  call<BuildResult>({ action: "build", relationship_id: relationshipId });

export const saveReflection = (input: {
  relationshipId: string | null;
  recommendationId?: string | null;
  kind: LiveReflection["reflection_kind"];
  text: string;
  outcome?: LiveReflection["outcome"];
}) =>
  call<{ saved: boolean }>({
    action: "reflect",
    relationship_id: input.relationshipId,
    recommendation_id: input.recommendationId ?? null,
    reflection_kind: input.kind,
    response_text: input.text,
    outcome: input.outcome ?? null,
  });

const SUBJECT_LABEL: Record<LiveObservation["subject_kind"], string> = {
  user_behavior: "You",
  other_behavior: "The other person",
  ai_advice: "Suggested, not known to be used",
  self_report: "Self-reported by you",
};

/**
 * Evidence lines are the stored observations themselves — no raw uploaded
 * message is kept, so nothing else can honestly be shown here.
 */
export const resolveLiveEvidence = (
  ids: string[],
  observations: LiveObservation[],
): ResolvedEvidence[] =>
  ids.flatMap((id) => {
    const observation = observations.find((item) => item.id === id);
    if (!observation) return [];
    const quote = observation.evidence_refs?.[0];
    const range = observation.observed_period_start
      ? `${observation.observed_period_start}${observation.observed_period_end && observation.observed_period_end !== observation.observed_period_start ? ` – ${observation.observed_period_end}` : ""}`
      : "date not recorded";
    return [{
      sourceId: observation.journey_source_id,
      sourceLabel: quote?.label ?? "From a report you included",
      product: SUBJECT_LABEL[observation.subject_kind],
      observedRange: range,
      sender: quote?.speaker ?? SUBJECT_LABEL[observation.subject_kind],
      text: quote?.quote ?? observation.statement,
      ts: observation.created_at,
    }];
  });

/** Honest state of the real engine, never dressed up as a trend. */
export type LiveState =
  | "not_prime"
  | "not_on"
  | "no_evidence"
  | "one_read"
  | "ready"
  | "updating"
  | "stale"
  | "failed";

export const liveState = (status: LiveStatus, building: boolean): LiveState => {
  if (!status.prime) return "not_prime";
  if (!status.opted_in) return "not_on";
  if (building || status.job?.status === "running") return "updating";
  if (status.job?.status === "failed" && !status.summary) return "failed";
  if (status.counts.eligible === 0) return "no_evidence";
  if (!status.summary?.content) return "no_evidence";
  if (status.summary.is_stale) return "stale";
  if (status.summary.coverage?.single_read) return "one_read";
  return "ready";
};

export const LIVE_STATE_COPY: Record<LiveState, string> = {
  not_prime: "Relationship360 is part of Prime.",
  not_on: "Turn Relationship360 on to build it from the conversations you choose.",
  no_evidence: "Nothing is included yet, so there is nothing to show. Confirm which participant is you in a saved report to begin.",
  one_read: "Built from a single read. Patterns are only called patterns once a second conversation supports them.",
  ready: "Built from the conversations you confirmed and included.",
  updating: "Updating from your included conversations…",
  stale: "Something you included, corrected or removed has changed since this was built. Build again to bring it up to date.",
  failed: "The last update did not finish. Nothing was saved and you can build again.",
};
