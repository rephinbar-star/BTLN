import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, MessageSquare, Users, UsersRound } from "lucide-react";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { BottomNav } from "@/components/nav/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";

const SESSION_KEY = "chemistry_landing_viewed";
const REF_KEY = "btln_ref_visit_fired";

const MODES = [
  {
    to: "/quick",
    eyebrow: "One text",
    title: "Quick Take",
    body: "Stuck on what they meant—or what to say back?",
    icon: MessageSquare,
  },
  {
    to: "/deep",
    eyebrow: "The two of us",
    title: "Deep Read",
    body: "Does the same thing keep happening between you?",
    icon: Users,
  },
  {
    to: "/group-roast",
    eyebrow: "Our group",
    title: "Group Roast",
    body: "Who keeps this chat together—and who brings the chaos?",
    icon: UsersRound,
  },
];

type RecentRead = { id: string; created_at: string };

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
    return (
      <div className="min-h-screen bg-btln-paper text-foreground">
        <Header />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-btln-paper text-foreground">
      <Helmet>
        <title>BetweenTheLines™ — AI relationship analysis from your texts</title>
        <meta
          name="description"
          content="Read one text, a whole two-person conversation, or your group chat. Your first read needs no signup."
        />
        <link rel="canonical" href="https://betweenthelines.app/" />
        <meta property="og:title" content="BetweenTheLines™ — AI relationship analysis from your texts" />
        <meta
          property="og:description"
          content="Paste your texts and get a clear read on what's being said, the patterns underneath, and what to try next."
        />
        <meta property="og:url" content="https://betweenthelines.app/" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-28 pt-2 sm:px-8 md:pb-16">
        <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[44px]">
          {user ? "What are we reading today?" : "Know what's really being said."}
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
          Bring a text, a conversation, or a group chat. You'll get a clear read of what's
          going on and something practical to do next — in plain language, in minutes.
        </p>

        <ul className="mt-7 flex flex-col gap-3">
          {MODES.map(({ to, eyebrow, title, body, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => logEvent("cta_clicked", { location: `home_${title}` })}
                className="flex min-h-[88px] items-center gap-4 rounded-[20px] border border-btln-line bg-card p-[18px] transition-colors hover:bg-muted/40"
              >
                <span className="flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-2xl bg-btln-mint">
                  <Icon className="h-5 w-5 text-btln-forest" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-muted-foreground">{eyebrow}</span>
                  <span className="block text-[17px] font-medium">{title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-muted-foreground">
                    {body}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>

        {user && recent && recent.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[18px] font-medium tracking-tight">Pick up where you left off</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/report/${r.id}`}
                    className="flex min-h-[56px] items-center justify-between gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] hover:bg-muted/40"
                  >
                    <span className="text-[15px]">
                      Your read from {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/account"
              className="mt-3 inline-flex min-h-[44px] items-center text-[14px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              All of my reads →
            </Link>
          </section>
        )}

        <section className="mt-8 rounded-[20px] border border-btln-line bg-btln-mint/50 p-[18px]">
          <h2 className="text-[16px] font-medium">Before you decide anything</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Every read explains the patterns it sees and where it isn't sure. It reads
            communication, not people — it isn't a diagnosis or a clinical assessment.
            You see what a read covers before anything is paid for.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link
              to="/sample"
              className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-btln-forest underline-offset-4 hover:underline"
            >
              See a sample read →
            </Link>
            <Link
              to="/explore"
              className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-btln-forest underline-offset-4 hover:underline"
            >
              Group Read, Wrapped and more →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default Index;
