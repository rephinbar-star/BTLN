import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/session";

/** Free group reads per owner (signed-in user or guest device), from cutoff. */
export const FREE_GROUP_READS = 1;

export type GroupAccess = {
  /** Active subscription of any tier => unlimited group reads. */
  entitled: boolean;
  /** Group reads started since the entitlement rule took effect. */
  usedFree: number;
  /** True when the next new group read needs a plan. */
  needsSubscription: boolean;
  isLoading: boolean;
  refresh: () => void;
};

/**
 * Client-side mirror of the server rule enforced in analyze-group. This only
 * drives messaging — the real gate runs server-side before any generation.
 */
export function useGroupAccess(enabled = true): GroupAccess {
  const { user, loading: authLoading } = useAuth();
  const [entitled, setEntitled] = useState(false);
  const [usedFree, setUsedFree] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || authLoading) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const countPromise = supabase.rpc("count_group_reads_since_cutoff", {
        p_session_id: getSessionId(),
        p_user_id: user?.id ?? null,
      });

      let hasSub = false;
      if (user) {
        const { data } = await supabase.rpc("user_has_active_subscription", {
          p_user_id: user.id,
        });
        hasSub = data === true;
      }

      const { data: count } = await countPromise;
      if (cancelled) return;
      setEntitled(hasSub);
      setUsedFree(typeof count === "number" ? count : 0);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, authLoading, nonce]);

  return {
    entitled,
    usedFree,
    needsSubscription: !entitled && usedFree >= FREE_GROUP_READS,
    isLoading,
    refresh,
  };
}
