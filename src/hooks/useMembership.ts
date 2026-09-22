import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MembershipState = {
  loading: boolean;
  /** True when the signed-in user has an active paid plan of any kind. */
  isMember: boolean;
  tier: string | null;
  /** All active tiers, so a future add-on can coexist with its required base plan. */
  tiers: string[];
  hasInteractiveMode: boolean;
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
    tiers: [],
    hasInteractiveMode: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isMember: false, tier: null, tiers: [], hasInteractiveMode: false });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("tier,status")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (cancelled) return;
      const rows = (data ?? []) as { tier: string | null }[];
      const tiers = rows.flatMap((row) => row.tier ? [row.tier] : []);
      const tier = tiers.find((value) => value === "prime")
        ?? tiers.find((value) => value !== "interactive_addon")
        ?? tiers[0]
        ?? null;
      setState({
        loading: false,
        isMember: tiers.length > 0,
        tier,
        tiers,
        hasInteractiveMode: tiers.includes("prime") || tiers.includes("interactive_addon"),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
