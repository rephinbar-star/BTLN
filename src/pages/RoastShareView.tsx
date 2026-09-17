import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { hashRoastShareToken, type RoastShareSnapshot } from "@/lib/roast/types";

const RoastShareView = () => {
  const { token } = useParams<{ token: string }>();
  const [snapshot, setSnapshot] = useState<RoastShareSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState("gone");
        return;
      }
      try {
        const hash = await hashRoastShareToken(token);
        const { data } = await supabase.rpc("resolve_roast_share", { p_token_hash: hash });
        if (cancelled) return;
        if (!data) {
          setState("gone");
          return;
        }
        setSnapshot(data as unknown as RoastShareSnapshot);
        setState("ok");
        track("roast_share_visited", {});
      } catch {
        if (!cancelled) setState("gone");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>A shared roast | BetweenTheLines</title>
        <meta name="description" content="Someone shared the funny version of their chat." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-12 sm:px-8">
        {state === "loading" && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening…
          </p>
        )}

        {state === "gone" && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <h1 className="text-[22px] font-medium">This link isn't active</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              It was either turned off by whoever made it, or the link is wrong.
            </p>
            <Link
              to="/"
              onClick={() => track("roast_share_conversion", {})}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
            >
              Read your own chat <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {state === "ok" && snapshot && (
          <>
            <p className="text-sm text-muted-foreground">Roast Us</p>
            <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
              {snapshot.headline}
            </h1>

            <ul className="mt-8 space-y-3">
              {snapshot.observations.map((o, i) => (
                <li key={i} className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-[17px] font-medium">{o.label}</h2>
                  <p className="mt-2 text-[16px] leading-relaxed">{o.text}</p>
                </li>
              ))}
            </ul>

            {snapshot.receipt?.quote && (
              <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
                <p className="border-l-2 border-border pl-3 text-[16px] italic">
                  “{snapshot.receipt.quote}”
                </p>
                {snapshot.receipt.note && (
                  <p className="mt-2 text-[15px] text-muted-foreground">{snapshot.receipt.note}</p>
                )}
              </div>
            )}

            {snapshot.closing && (
              <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground">
                {snapshot.closing}
              </p>
            )}

            <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-center">
              <p className="text-[18px] font-medium">What would your chat say?</p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                This page only shows what the person who made it chose to release — no chat text.
              </p>
              <Link
                to="/"
                onClick={() => track("roast_share_conversion", {})}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
              >
                Read my chat <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default RoastShareView;
