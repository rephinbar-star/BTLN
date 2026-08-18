import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/session";

export const FREE_DECODES = 1;

export type DecodeAccess = {
  /** Active subscription of any tier => unlimited decodes. */
  entitled: boolean;
  /** Completed decodes for this session/user. */
  completedCount: number;
  isLoading: boolean;
  refresh: () => void;
};

/**
 * First-free metering for the Quick Decode lane.
 * Any active subscription unlocks unlimited decodes; otherwise the first
 * FREE_DECODES completed decodes show reply options for free.
 */
export function useDecodeAccess(enabled = true): DecodeAccess {
  const { user, loading: authLoading } = useAuth();
  const [entitled, setEntitled] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || authLoading) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const countPromise = supabase.rpc("count_completed_decodes", {
        p_session_id: getSessionId(),
        p_user_id: user?.id ?? null,
      });

      let hasSub = false;
      if (user) {
        const { data: subs } = await supabase
          .from("user_subscriptions")
          .select("status,current_period_end")
          .eq("user_id", user.id);
        hasSub = (subs ?? []).some(
          (s) =>
            ["active", "trialing", "past_due"].includes(s.status) &&
            (!s.current_period_end || new Date(s.current_period_end) > new Date()),
        );
      }

      const { data: count } = await countPromise;
      if (cancelled) return;
      setEntitled(hasSub);
      setCompletedCount(typeof count === "number" ? count : 0);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, user, authLoading, nonce]);

  return { entitled, completedCount, isLoading, refresh };
}
