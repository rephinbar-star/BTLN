import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Server-verified administrator check.
 *
 * The role lives in public.user_roles and is read through the
 * security-definer has_role() function, so the answer cannot be forged by
 * the browser. No shared password and no browser-stored admin flag.
 */
export function useAdminRole() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!cancelled) setIsAdmin(!error && data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isAdmin, checking: loading || isAdmin === null, user };
}
