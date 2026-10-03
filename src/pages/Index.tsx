import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { BottomNav } from "@/components/nav/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";
import quickArt from "@/assets/home-modes/quick-take.webp.asset.json";
import deepArt from "@/assets/home-modes/deep-read.webp.asset.json";
import groupArt from "@/assets/home-modes/group-roast.webp.asset.json";
import relationshipArt from "@/assets/home-modes/relationship360.webp.asset.json";

const SESSION_KEY = "chemistry_landing_viewed";
const REF_KEY = "btln_ref_visit_fired";

type RecentRead = { id: string; created_at: string };

const modes = [
  {
    to: "/quick", label: "Quick Take", title: "Decode a text",
    description: <>Possible meanings.<br />Three ways to reply.</>,
    action: "Get a Quick Take", art: quickArt,
    tone: "border-prism-lavender/70 bg-prism-violet/10 shadow-glow-violet",
    accent: "text-prism-lavender", actionTone: "border-prism-lavender bg-prism-lavender text-background",
    tag: "home_quick",
  },
  {
    to: "/deep", label: "Deep Read", title: "Understand a relationship",
    description: <>Patterns in a two-person chat.<span className="hidden lg:inline"><br />Practical next steps.</span></>,
    action: "Get a Deep Read", art: deepArt,
    tone: "border-btln-line bg-card", accent: "text-prism-emerald-text",
    actionTone: "border-btln-line bg-elevated text-foreground", tag: "home_deep",
  },
  {
    to: "/group-roast", label: "Group Roast", title: "Roast a group chat",
    description: <>The cast. The chaos.<br />Three or more people.</>,
    action: "Roast our group", art: groupArt,
    tone: "border-btln-line bg-card", accent: "text-prism-amber-text",
    actionTone: "border-btln-line bg-elevated text-foreground", tag: "home_group_roast",
  },
  {
    to: "/prime", label: "Relationship360", title: "Understand your patterns",
    description: <>Insights and coaching over time.</>,
    status: "Prime preview · In development", action: "Explore preview", art: relationshipArt,
    tone: "border-btln-line bg-card", accent: "text-prism-lavender",
    actionTone: "border-btln-line bg-elevated text-foreground", tag: "home_relationship360_preview",
  },
];

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [recent, setRecent] = useState<RecentRead[] | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Referral attribution: PII-free, value comes from a fixed enum-ish tag.
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && !sessionStorage.getItem(REF_KEY)) {
        sessionStorage.setItem(REF_KEY, "1");
        track("referred_visit", { ref });
      }
    } catch {
      // ignore
    }
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    logEvent("landing_viewed");
  }, []);

  // Resume is only offered when saved reads actually exist.
  useEffect(() => {
    if (!user) {
      setRecent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("analyses")
        .select("id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(2);
      if (!cancelled) setRecent((data as RecentRead[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Legacy inbound links (and the import handoff) pointed at the old
  // home-page Deep Read form. Forward them to the focused input route with
  // their query intact so the in-memory handoff and ?redo= still work.
  const legacyDeepRead =
    location.hash === "#input-section" ||
    location.search.includes("from=import") ||
    location.search.includes("redo=");
  if (legacyDeepRead) {
    return <Navigate to={{ pathname: "/deep", search: location.search }} replace />;
  }

  if (authLoading) {
    return <div className="min-h-screen bg-background text-foreground"><Header /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>BetweenTheLines™ — AI relationship analysis from your texts</title>
        <meta name="description" content="Read one text, a whole two-person conversation, or your group chat. Your first read needs no signup." />
        <link rel="canonical" href="https://betweenthelines.app/" />
        <meta property="og:title" content="BetweenTheLines™ — AI relationship analysis from your texts" />
        <meta property="og:description" content="Paste your texts and get a clear read on what's being said, the patterns underneath, and what to try next." />
        <meta property="og:url" content="https://betweenthelines.app/" />
      </Helmet>
      <Header />
      <main className="relative mx-auto w-full max-w-[1088px] px-3 pb-4 pt-6 min-[361px]:px-5 md:px-8 md:pt-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[340px] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--prism-violet)/0.18),transparent_65%)]" />
        <section aria-labelledby="home-heading" className="relative mx-auto mb-6 max-w-[620px] text-center md:mb-8">
          <h1 id="home-heading" className="font-display text-[30px] font-bold leading-[1.12] min-[361px]:text-[34px] md:text-[46px] md:leading-[1.08]">
            What does this text <span className="text-prism-lavender">actually mean?</span>
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground md:text-[16px]">
            AI insights for your conversations.<br />A clearer read. A way forward.
          </p>
        </section>

        <section aria-label="Choose a read" className="relative grid gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {modes.map((mode, index) => (
            <Link
              key={mode.to}
              to={mode.to}
              onClick={() => logEvent("cta_clicked", { location: mode.tag })}
              aria-label={`${mode.label}: ${mode.title}${mode.status ? `. ${mode.status}` : ""}`}
              className={`group grid min-h-[116px] grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-[17px] border transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-prism-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none min-[361px]:min-h-[120px] min-[361px]:grid-cols-[112px_minmax(0,1fr)] md:flex md:min-h-0 md:flex-col ${mode.tone}`}
            >
              <img src={mode.art.url} alt="" width={560} height={560} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="m-1 h-[96px] w-[96px] self-center rounded-[11px] object-cover min-[361px]:h-[112px] min-[361px]:w-[112px] md:m-0 md:aspect-square md:h-auto md:w-full md:rounded-none" />
              <span className="flex min-w-0 flex-col justify-center px-3 py-3 min-[361px]:px-4 md:flex-1 md:justify-start md:px-4 md:py-4">
                <span className="flex items-start justify-between gap-1">
                  <span className={`min-w-0 break-words font-mono text-[11px] font-medium leading-5 min-[361px]:text-[12px] ${mode.accent}`}>{mode.label}</span>
                  <ArrowRight aria-hidden="true" className={`h-4 w-4 shrink-0 ${mode.accent}`} />
                </span>
                <span className="mt-1 block font-display text-[18px] font-bold leading-[1.18] min-[361px]:text-[19px] md:min-h-[3.6em] md:text-[21px]">{mode.title}</span>
                <span className="mt-2 block text-[12px] leading-[1.55] text-muted-foreground md:mt-2 md:text-[13px]">{mode.description}</span>
                {mode.status && <span className="mt-2 block text-[11px] leading-4 text-prism-lavender md:mt-auto md:pt-3">{mode.status}</span>}
                <span aria-hidden="true" className={`mt-auto hidden min-h-11 items-center justify-between gap-2 rounded-[10px] border px-3 text-[13px] font-semibold md:flex ${mode.actionTone}`}>
                  {mode.action}<ArrowRight className="h-4 w-4 shrink-0" />
                </span>
              </span>
            </Link>
          ))}
        </section>

        <details className="group mx-auto mt-5 max-w-xl text-center">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-[14px] text-prism-lavender underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            See what you get <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="mt-2 rounded-[14px] border border-btln-line bg-card p-5 text-left">
            <p className="font-mono text-[11px] font-semibold text-prism-lavender">FICTIONAL QUICK TAKE</p>
            <blockquote className="mt-3 font-quote text-[20px] italic leading-7">“I've just got a lot going on right now.”</blockquote>
            <p className="mt-2 text-[14px] leading-6 text-muted-foreground">This could be a genuine explanation or a way to create distance. This message alone cannot settle which.</p>
            <p className="mt-2 text-[14px] leading-6 text-muted-foreground">One possible reply: “I understand. Would you like me to check in next week, or would you prefer some space?”</p>
            <Link to="/examples" className="mt-2 inline-flex min-h-11 items-center gap-1 text-[14px] text-prism-lavender underline underline-offset-4">Browse full examples <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </details>

        <p className="mt-3 text-center text-[12px] leading-6 text-muted-foreground">
          <span className="block sm:inline">First Quick Take free. No signup to start.</span>
          <span className="block sm:ml-3 sm:inline">Insights, not certainty.</span>
        </p>

        {user && recent && recent.length > 0 && (
          <section className="mx-auto mt-8 max-w-xl border-t border-btln-line pt-5">
            <h2 className="font-display text-[18px] font-bold">Pick up where you left off</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {recent.map((r) => (
                <li key={r.id}><Link to={`/report/${r.id}`} className="flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-btln-line bg-card px-4 hover:bg-elevated">
                  <span className="text-[15px]">Your read from {new Date(r.created_at).toLocaleDateString()}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link></li>
              ))}
            </ul>
            <Link to="/account" className="mt-2 inline-flex min-h-11 items-center text-[14px] text-prism-lavender underline underline-offset-4">All of my reads →</Link>
          </section>
        )}
      </main>
      <footer className="mx-auto max-w-[1040px] border-t border-btln-line px-4 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-3" aria-label="More information">
        <nav aria-label="Information" className="flex flex-wrap justify-center gap-x-5 text-[12px] text-muted-foreground">
          <Link to="/pricing" className="inline-flex min-h-11 items-center hover:text-foreground hover:underline">Pricing</Link>
          <Link to="/trust" className="inline-flex min-h-11 items-center hover:text-foreground hover:underline">Privacy &amp; trust</Link>
          <Link to="/about" className="inline-flex min-h-11 items-center hover:text-foreground hover:underline">About</Link>
        </nav>
      </footer>
      <BottomNav />
    </div>
  );
};

export default Index;
