import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { GROUP_CATEGORY_LABEL, hashShareToken, type GroupShareSnapshot } from "@/lib/group/types";

const GroupShareView = () => {
  const { token } = useParams<{ token: string }>();
  const [snapshot, setSnapshot] = useState<GroupShareSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState("gone");
        return;
      }
      try {
        const hash = await hashShareToken(token);
        const { data } = await supabase.rpc("resolve_group_share", { p_token_hash: hash });
        if (cancelled) return;
        if (!data) {
          setState("gone");
          return;
        }
        setSnapshot(data as unknown as GroupShareSnapshot);
        setState("ok");
        // Token never leaves the URL bar — nothing token-related is sent here.
        track("group_share_visited", {});
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
        {/* No chat text, names or quotes in metadata, and never indexed. */}
        <title>A shared Group Read | BetweenTheLines</title>
        <meta name="description" content="Someone shared how their group chat works." />
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
              to="/group"
              onClick={() => track("group_share_conversion", {})}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
            >
              Read your own group chat <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {state === "ok" && snapshot && (
          <>
            <p className="text-sm text-muted-foreground">
              Group Read · {GROUP_CATEGORY_LABEL[snapshot.category] ?? "Group"}
            </p>
            <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
              {snapshot.title}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
              {snapshot.subtitle}
            </p>

            <ul className="mt-8 space-y-3">
              {snapshot.role_cards.map((c, i) => (
                <li key={i} className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-[18px] font-medium">
                    {c.label} · <span className="text-muted-foreground">{c.role}</span>
                  </h2>
                  {c.headline && <p className="mt-2 text-[16px]">{c.headline}</p>}
                  {c.why && <p className="mt-2 text-[15px] text-muted-foreground">{c.why}</p>}
                  {c.evidence && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-[14px] italic text-muted-foreground">
                      {c.evidence}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {snapshot.strengths.length > 0 && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-5">
                <h2 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What this group does well
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[16px]">
                  {snapshot.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-center">
              <p className="text-[18px] font-medium">Is one of these you?</p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                This page only shows what the person who made it chose to release. To see a read of
                your own, start one from your side of the chat.
              </p>
              <Link
                to="/group"
                onClick={() => track("group_share_conversion", {})}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background"
              >
                Read my group chat <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-6 text-center text-[13px] text-muted-foreground">
              {snapshot.participant_count} people
              {snapshot.message_count ? ` · ${snapshot.message_count} messages` : ""} · no
              conversation text is shared on this page
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GroupShareView;
