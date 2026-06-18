import { supabase } from "@/integrations/supabase/client";

const KEY = "chemistry_session_id";
const PENDING_CLAIM_ANALYSIS_KEY = "pending_claim_analysis_id";

const uuidv4 = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getSessionId = (): string => {
  if (typeof window === "undefined") return uuidv4();
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = uuidv4();
    window.localStorage.setItem(KEY, id);
  }
  return id;
};

export const setPendingClaimAnalysisId = (analysisId: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_CLAIM_ANALYSIS_KEY, analysisId);
};

export const getPendingClaimAnalysisId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_CLAIM_ANALYSIS_KEY);
};

export const clearPendingClaimAnalysisId = (): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_CLAIM_ANALYSIS_KEY);
};

export const claimPendingAnalysis = async (): Promise<{
  attempted: boolean;
  claimed: boolean;
  analysisId: string | null;
}> => {
  const analysisId = getPendingClaimAnalysisId();
  if (!analysisId) return { attempted: false, claimed: false, analysisId: null };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { attempted: false, claimed: false, analysisId };

  const { data, error } = await supabase.rpc("claim_analysis", {
    p_analysis_id: analysisId,
  });

  if (error) {
    console.warn("[claim-analysis] failed", { analysisId, error: error.message });
    return { attempted: true, claimed: false, analysisId };
  }

  if (data === true) {
    clearPendingClaimAnalysisId();
  } else {
    const { data } = await supabase.rpc("get_analysis_for_session", {
      p_id: analysisId,
      p_session_id: getSessionId(),
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.user_id === userData.user.id) {
      clearPendingClaimAnalysisId();
      return { attempted: true, claimed: true, analysisId };
    }
  }

  return { attempted: true, claimed: data === true, analysisId };
};

export const logEvent = (
  event_name: string,
  metadata: Record<string, unknown> = {},
): void => {
  try {
    const session_id = getSessionId();
    // Fire-and-forget — never await, never throw
    void supabase
      .from("events")
      .insert([{ session_id, event_name, metadata: metadata as never }]);
  } catch {
    // swallow
  }
};