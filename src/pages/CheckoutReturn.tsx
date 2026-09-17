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
  const groupRoastId = searchParams.get("group_roast_id");
  const [status, setStatus] = useState<"loading" | "ready" | "waiting">(sessionId ? "loading" : "waiting");

  useEffect(() => {
    if (!sessionId || (!analysisId && !groupReadId && !groupRoastId)) {
      setStatus("waiting");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      let granted = false;
      if (groupRoastId) {
        const { data } = await supabase.functions.invoke("group-roast-data", {
          body: { action: "get", group_roast_id: groupRoastId },
        });
        granted = data?.roast?.is_unlocked === true;
      } else if (groupReadId) {
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
      if (granted) {
        setStatus("ready");
      } else if (attempts >= 45) {
        setStatus("waiting");
      } else {
        setTimeout(tick, 1000);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [sessionId, analysisId, groupReadId, groupRoastId]);


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <Helmet>
        <title>Confirming payment — BetweenTheLines™</title>
        <meta name="description" content="Confirming your payment and unlocking your full BetweenTheLines relationship report." />
        <link rel="canonical" href="https://betweenthelines.app/checkout/return" />
        <meta property="og:title" content="Confirming payment — BetweenTheLines™" />
        <meta property="og:description" content="Checking the secure payment confirmation for your report." />
        <meta property="og:url" content="https://betweenthelines.app/checkout/return" />
        <meta name="robots" content="noindex" />
      </Helmet>
      {status === "loading" ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="mt-6 text-[15px] text-muted-foreground">Confirming your payment…</p>
        </>
      ) : status === "waiting" ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <h1 className="mt-6 text-[28px] font-medium tracking-tight sm:text-[36px]">
            Still confirming your payment
          </h1>
          <p className="mt-3 max-w-md text-[15px] text-muted-foreground">
            The secure confirmation has not arrived yet. Your report is not marked paid until it does.
          </p>
          <Link
            to={groupRoastId ? `/group-roast/${groupRoastId}` : groupReadId ? "/group" : analysisId ? `/report/${analysisId}` : "/account"}
            className="mt-8 text-[14px] font-medium text-muted-foreground underline hover:text-foreground"
          >
            Check again from your report
          </Link>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h1 className="mt-6 text-[28px] font-medium tracking-tight sm:text-[36px]">
             Payment verified
          </h1>
          <p className="mt-3 max-w-md text-[15px] text-muted-foreground">
             {groupRoastId
               ? "Your full Group Roast is unlocked."
               : groupReadId
              ? "Your single group report is unlocked. Return to Group Read and add the chat again; the paid target is kept for that retry."
              : "Your full report is unlocked. Thanks for supporting BetweenTheLines™."}
          </p>
          <Link
             to={groupRoastId ? `/group-roast/${groupRoastId}` : groupReadId ? "/group" : analysisId ? `/report/${analysisId}` : "/"}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
          >
             {groupRoastId ? "View your Group Roast" : groupReadId ? "Back to Group Read" : "View your report"}
          </Link>

        </>
      )}
    </div>
  );
}