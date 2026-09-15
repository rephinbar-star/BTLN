import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const analysisId = searchParams.get("analysis_id");
  const groupReadId = searchParams.get("group_read_id");
  const [status, setStatus] = useState<"loading" | "ready">(sessionId ? "loading" : "ready");

  useEffect(() => {
    if (!sessionId || (!analysisId && !groupReadId)) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      let granted = false;
      if (groupReadId) {
        const { data } = await supabase.rpc("has_group_read_unlock", {
          p_group_read_id: groupReadId,
        });
        granted = data === true;
      } else if (analysisId) {
        const { data: rows } = await supabase.rpc("get_analysis_for_session", {
          p_id: analysisId,
          p_session_id: getSessionId(),
        });
        const data = Array.isArray(rows) ? rows[0] : rows;
        granted = data?.is_paid === true;
      }
      if (cancelled) return;
      if (granted || attempts >= 8) {
        setStatus("ready");
      } else {
        setTimeout(tick, 1000);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [sessionId, analysisId, groupReadId]);


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <Helmet>
        <title>Payment complete — BetweenTheLines™</title>
        <meta name="description" content="Confirming your payment and unlocking your full BetweenTheLines relationship report." />
        <link rel="canonical" href="https://betweenthelines.app/checkout/return" />
        <meta property="og:title" content="Payment complete — BetweenTheLines™" />
        <meta property="og:description" content="Your full report is unlocked." />
        <meta property="og:url" content="https://betweenthelines.app/checkout/return" />
        <meta name="robots" content="noindex" />
      </Helmet>
      {status === "loading" ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="mt-6 text-[15px] text-muted-foreground">Confirming your payment…</p>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h1 className="mt-6 text-[28px] font-medium tracking-tight sm:text-[36px]">
            Payment complete
          </h1>
          <p className="mt-3 max-w-md text-[15px] text-muted-foreground">
            {groupReadId
              ? "Your single group report is unlocked. Add the chat again on the Group Read page and we'll run it — we never keep a copy of your conversation."
              : "Your full report is unlocked. Thanks for supporting BetweenTheLines™."}
          </p>
          <Link
            to={groupReadId ? "/group" : analysisId ? `/report/${analysisId}` : "/"}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
          >
            {groupReadId ? "Back to Group Read" : "View your report"}
          </Link>

        </>
      )}
    </div>
  );
}