import { supabase } from "@/integrations/supabase/client";
import type { AskAnswer, AskMoment } from "../../../supabase/functions/_shared/r360AskCore";

export type { AskAnswer, AskMoment };
export { askScopeKey, ASK_LIMITS } from "../../../supabase/functions/_shared/r360AskCore";

export type AskResult = AskAnswer | { state: "no_evidence"; support: { sources: number; dated: number; notes: number } };

export const SUGGESTED_QUESTIONS = ["What keeps repeating?", "What has changed?", "What can I work on?"] as const;

/** Ephemeral: nothing about the question or answer is stored by the app. */
export const askPatterns = async (question: string, sourceIds: string[]): Promise<AskResult> => {
  const { data, error } = await supabase.functions.invoke("relationship360", {
    body: { action: "ask", question, source_ids: sourceIds },
  });
  if (error) {
    // supabase-js wraps non-2xx; read the server's honest message when present.
    let message = "We could not get an answer right now. Nothing was saved.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error && typeof body.error === "string") message = body.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as AskResult;
};
