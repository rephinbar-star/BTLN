import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimPendingAnalysis, getSessionId } from "@/lib/session";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const finalize = async () => {
      const getUser = async () => (await supabase.auth.getSession()).data.session?.user ?? null;

      let user = await getUser();
      if (!user) {
        await new Promise((r) => setTimeout(r, 2000));
        user = await getUser();
      }
      if (cancelled) return;

      if (!user) {
        navigate("/error?reason=auth_failed", { replace: true });
        return;
      }

      try {
        await claimPendingAnalysis();
        const sid = getSessionId();
        await supabase.rpc("claim_anonymous_analyses", {
          p_session_id: sid,
          p_user_id: user.id,
        });
      } catch {
        // non-fatal
      }

      const returnTo = params.get("return_to");
      const safe =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account";
      navigate(safe, { replace: true });
    };

    void finalize();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
};

export default AuthCallback;