import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MembershipState = {
  loading: boolean;
  /** True when the signed-in user has an active paid plan of any kind. */
  isMember: boolean;
  tier: string | null;
};

/**
 * Lightweight read of the signed-in user's subscription state, used only to
 * decide whether to show an upgrade offer. Access to any report is still
 * enforced server-side; this never grants anything on its own.
 */
export function useMembership(): MembershipState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<MembershipState>({
    loading: true,
    isMember: false,
    tier: null,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isMember: false, tier: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("tier,status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);
      if (cancelled) return;
      const row = data?.[0] as { tier: string | null } | undefined;
      setState({ loading: false, isMember: !!row, tier: row?.tier ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
