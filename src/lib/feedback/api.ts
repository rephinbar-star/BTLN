import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import type {
  FeedbackOutcome,
  FeedbackRating,
  FeedbackRecord,
  FeedbackTarget,
} from "./types";

type RpcFn = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

const rpc = supabase.rpc as unknown as RpcFn;

export type SubmitFeedbackInput = {
  target: FeedbackTarget;
  rating: FeedbackRating;
  reasonCodes?: string[];
  comment?: string | null;
  outcome?: FeedbackOutcome | null;
  outcomeNote?: string | null;
  /** Fictional examples never enter production learning data. */
  demo?: boolean;
};

export const submitFeedback = async (
  input: SubmitFeedbackInput,
): Promise<{ ok: boolean; error?: string }> => {
  if (input.demo) return { ok: true };
  const { target } = input;
  const { error } = await rpc("submit_ai_feedback", {
    p_source_kind: target.sourceKind,
    p_source_id: target.sourceId,
    p_target_kind: target.targetKind,
    p_target_key: target.targetKey ?? "main",
    p_rating: input.rating,
    p_session_id: getSessionId(),
    p_generation_id: target.generationId ?? null,
    p_prompt_version: target.promptVersion ?? null,
    p_model: target.model ?? null,
    p_reason_codes: input.reasonCodes ?? [],
    p_comment: input.comment ?? null,
    p_outcome: input.outcome ?? null,
    p_outcome_note: input.outcomeNote ?? null,
    p_personalization_consent: true,
    p_product_improvement_consent: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const clearFeedback = async (
  target: FeedbackTarget,
  demo = false,
): Promise<{ ok: boolean; error?: string }> => {
  if (demo) return { ok: true };
  const { error } = await rpc("clear_ai_feedback", {
    p_source_kind: target.sourceKind,
    p_source_id: target.sourceId,
    p_target_kind: target.targetKind,
    p_target_key: target.targetKey ?? "main",
    p_session_id: getSessionId(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const listFeedbackForSource = async (
  sourceKind: FeedbackTarget["sourceKind"],
  sourceId: string,
): Promise<FeedbackRecord[]> => {
  const { data, error } = await rpc("list_ai_feedback_for_source", {
    p_source_kind: sourceKind,
    p_source_id: sourceId,
    p_session_id: getSessionId(),
  });
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    targetKind: String(row.target_kind) as FeedbackRecord["targetKind"],
    targetKey: String(row.target_key ?? "main"),
    rating: String(row.rating) as FeedbackRating,
    reasonCodes: Array.isArray(row.reason_codes) ? (row.reason_codes as string[]) : [],
    comment: (row.comment as string | null) ?? null,
    outcome: (row.outcome as FeedbackOutcome | null) ?? null,
  }));
};

export const resetCoachingPersonalization = async (): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await rpc("reset_coaching_personalization", {});
  return error ? { ok: false, error: error.message } : { ok: true };
};

export const deleteMyFeedback = async (): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await rpc("delete_my_ai_feedback", {});
  return error ? { ok: false, error: error.message } : { ok: true };
};
