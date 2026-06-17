import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/session";

export type EntitlementResult = {
  isOwner: boolean;
  isAnonymousOwner: boolean;
  hasFullAccess: boolean;
  isLoading: boolean;
  refresh: () => void;
};

export function useEntitlement(
  analysisId: string | undefined,
  refreshSignal = 0,
  enabled = true,
): EntitlementResult {
  const { user, loading: authLoading } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [isAnonymousOwner, setIsAnonymousOwner] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!analysisId || authLoading || !enabled) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const { data: row } = await supabase
        .from("analyses")
        .select("user_id, session_id")
        .eq("id", analysisId)
        .maybeSingle();
      if (cancelled) return;
      const owner = !!user && !!row?.user_id && row.user_id === user.id;
      const anonOwner =
        !user && !!row?.session_id && row.session_id === getSessionId();
      setIsOwner(owner);
      setIsAnonymousOwner(anonOwner);
      if (owner) {
        const { data: paid } = await supabase.rpc("user_has_paid_access", {
          p_user_id: user!.id,
          p_analysis_id: analysisId,
        });
        if (cancelled) return;
        setHasFullAccess(paid === true);
      } else {
        setHasFullAccess(false);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId, user, authLoading, enabled, nonce, refreshSignal]);

  // Realtime: when the user's entitlement changes elsewhere (subscription
  // webhook fires, one-time unlock inserted, or the analysis row is
  // flipped to is_paid), refresh immediately so the report unblurs
  // without a full page reload.
  useEffect(() => {
    if (!analysisId || !user?.id) return;
    const channel = supabase
      .channel(`entitlement:${user.id}:${analysisId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "one_time_unlocks",
          filter: `analysis_id=eq.${analysisId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
          filter: `id=eq.${analysisId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [analysisId, user?.id, refresh]);

  return { isOwner, isAnonymousOwner, hasFullAccess, isLoading, refresh };
}