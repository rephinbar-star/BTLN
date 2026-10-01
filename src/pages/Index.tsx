import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, MessageSquare, Sparkles, Users, UsersRound, type LucideIcon } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { BottomNav } from "@/components/nav/BottomNav";
import { SeeExample } from "@/components/examples/ExampleExperience";
import { HelpMeChoose } from "@/components/pricing/HelpMeChoose";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ExampleKind } from "@/lib/examples/catalog";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";

const SESSION_KEY = "chemistry_landing_viewed";
const REF_KEY = "btln_ref_visit_fired";

const MODES = [
  {
    to: "/quick",
    label: "Quick Take",
    title: "What did they mean? What should I say?",
    scenario:
      "You’ve started dating someone. They send a message, and you’re not sure whether they’re interested, pulling away, or just busy—or how to reply.",
    benefit:
      "Quick Take looks at your exchange, explains possible meanings, and gives you three ways to respond.",
    extras: [
      "A friend’s reply feels unexpectedly cold.",
      "A family message touches a nerve and you want to respond thoughtfully.",
    ],
    cta: "Get a Quick Take",
    exampleKind: "quick" as const,
    icon: MessageSquare,
    tone: "prism-card border-prism-violet/50 shadow-glow-violet",
    accent: "text-prism-lavender",
    chip: "bg-prism-violet/15 text-prism-lavender",
    action: "bg-gradient-to-r from-prism-violet to-prism-lavender text-background hover:brightness-110",
  },
  {
    to: "/deep",
    label: "Deep Read",
    title: "Why does this keep happening between us?",
    scenario:
      "You care about someone, but conversations keep ending in the same argument—or you’ve noticed a change in how you communicate and can’t quite explain it.",
    benefit:
      "Deep Read examines the wider conversation to reveal recurring patterns, where you connect, where you get stuck, and practical things to try.",
    extras: [
      "You’re wondering whether you’re doing most of the work to stay connected.",
      "You want to understand a friendship or family relationship better.",
    ],
    cta: "Get a Deep Read",
    exampleKind: "deep" as const,
    icon: Users,
    tone: "prism-card border-prism-emerald/35",
    accent: "text-prism-emerald-text",
    chip: "bg-prism-emerald/15 text-prism-emerald-text",
    action: "border border-prism-emerald/50 bg-elevated text-foreground hover:bg-prism-emerald/15",
  },
  {
    to: "/group-roast",
    label: "Group Roast",
    title: "Our group chat deserves its own comedy special.",
    scenario:
      "One friend organises everything. Another appears only when food is mentioned. Someone sends seventeen messages instead of one. Sound familiar?",
    benefit:
      "Upload your group chat and get a playful roast of everyone’s role, the group’s habits, and the dynamics that make you unmistakably you.",
    note: "For three or more people.",
    extras: [
      "A family chat with strong opinions and questionable memes.",
      "A work or hobby group with its own cast of characters.",
    ],
    cta: "Roast our group",
    exampleKind: "group-roast" as const,
    icon: UsersRound,
    tone: "prism-card border-prism-amber/35",
    accent: "text-prism-amber-text",
    chip: "bg-prism-amber/15 text-prism-amber-text",
    action: "bg-gradient-to-r from-prism-amber to-prism-coral text-background hover:brightness-110",
  },
];

type RecentRead = { id: string; created_at: string };

type Mode = {
  to: string;
  label: string;
  title: string;
  scenario: string;
  benefit: string;
  note?: string;
  extras: string[];
  cta: string;
  exampleKind: ExampleKind;
  icon: LucideIcon;
  tone: string;
  accent: string;
  chip: string;
  action: string;
};

const SituationCard = ({ mode }: { mode: Mode }) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `home-${mode.exampleKind}-situations`;
  const Icon = mode.icon;

  return (
    <article className={`relative overflow-hidden rounded-[20px] border p-5 sm:p-6 ${mode.tone}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mode.chip}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className={`font-mono text-[12px] font-semibold uppercase tracking-[0.08em] ${mode.accent}`}>{mode.label}</p>
      </div>

      <h2 className="mt-4 font-display text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">{mode.title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-6">
        <p className="text-muted-foreground">{mode.scenario}</p>
        <p className={`font-medium ${mode.accent}`}>{mode.benefit}</p>
        {mode.note && <p className="text-[14px] font-semibold">{mode.note}</p>}
      </div>

      <Button
        type="button"
        variant="link"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className={`mt-2 min-h-11 px-0 underline underline-offset-4 ${mode.accent}`}
      >
        {expanded ? "Fewer situations" : "More situations"}
      </Button>

      <div id={detailsId} hidden={!expanded}>
        <ul className="space-y-2 border-l-2 border-btln-line pl-4 text-[14px] leading-6 text-muted-foreground">
          {mode.extras.map((extra) => (
            <li key={extra}>{extra}</li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-1">
        <Button asChild className={`min-h-12 w-full justify-between rounded-xl px-5 text-[15px] font-semibold shadow-none ${mode.action}`}>
          <Link
            to={mode.to}
            onClick={() => logEvent("cta_clicked", { location: `home_${mode.label}` })}
          >
            {mode.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <SeeExample kind={mode.exampleKind} />
      </div>
    </article>
  );
};

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
      <main className="relative mx-auto max-w-2xl overflow-x-clip px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        <div aria-hidden="true" className="prism-bloom pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px]" />
        <section aria-labelledby="home-heading" className="relative flex flex-col items-center text-center">
          <h1 id="home-heading" className="max-w-xl font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[48px]">
            What does this text <span className="prism-text-gradient">actually mean?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]">
            Screenshot or paste a confusing exchange. Get a clearer read and three ways you could reply.
          </p>
          <p className="mt-2 text-[14px] text-muted-foreground">For dating, friends and family.</p>
          <div className="mt-5 flex w-full max-w-sm flex-col items-center gap-1">
            <Button asChild className="min-h-12 w-full rounded-xl bg-gradient-to-r from-prism-violet to-prism-lavender px-6 text-[15px] font-semibold text-background shadow-glow-violet hover:brightness-110">
              <Link to="/quick" onClick={() => logEvent("cta_clicked", { location: "home_hero_quick" })}>
                Read this text <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <SeeExample kind="quick" />
          </div>
        </section>

        <section className="relative mt-12 border-t border-btln-line pt-8 text-center" aria-labelledby="choose-heading">
          <h2 id="choose-heading" className="font-display text-[24px] font-bold leading-tight sm:text-[32px]">
            What brought you here today?
          </h2>
          <HelpMeChoose
            source="home_page"
            variant="link"
            supportLine="Answer a few quick questions to find the right option."
          />
        </section>

        <div className="mt-7 space-y-4">
          {MODES.map((mode) => (
            <SituationCard key={mode.to} mode={mode} />
          ))}
        </div>

        <section className="prism-card relative mt-9 overflow-hidden rounded-[20px] border border-prism-lavender/30 p-5 sm:p-6" aria-labelledby="prime-heading">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-prism-lavender/15">
              <Sparkles className="h-5 w-5 text-prism-lavender" aria-hidden="true" />
            </span>
            <p className="font-mono text-[12px] font-semibold tracking-[0.08em] text-prism-lavender">PRIME</p>
          </div>
          <h2 id="prime-heading" className="mt-4 font-display text-[22px] font-bold leading-tight sm:text-[27px]">
            Is this a pattern in my relationships?
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-muted-foreground">
            You’ve noticed something familiar across different relationships—perhaps you avoid
            difficult conversations, seek reassurance, or keep taking responsibility for everyone
            else. You want to understand whether the pattern is real and how it changes.
          </p>
          <p className="mt-3 text-[15px] font-medium leading-6 text-prism-lavender">
            We’re building Your Relationship360 to connect insights from conversations you
            choose to include, help you recognise patterns over time, and offer practical coaching
            and check-ins.
          </p>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">In development — not available to buy</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Relationship360 preview · Proposed: $19.99/month</p>

          <Button asChild className="mt-5 min-h-12 w-full justify-between rounded-xl border border-prism-lavender/40 bg-elevated px-5 text-[15px] font-semibold text-foreground shadow-none hover:bg-prism-lavender/15">
            <Link to="/prime">
              Explore Prime preview
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </section>

        {user && recent && recent.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[18px] font-medium tracking-tight">Pick up where you left off</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/report/${r.id}`}
                    className="flex min-h-[56px] items-center justify-between gap-3 rounded-[16px] border border-btln-line bg-card p-[18px] hover:bg-muted"
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
        <section className="mt-10 border-t border-btln-line pt-7" aria-label="Before you begin">
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-5">
            <div>
              <h2 className="text-[16px] font-medium">Your privacy</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">Your conversations are processed to create your read, not kept as a reusable raw transcript. Reports may include selected excerpts.</p>
              <Link to="/trust" className="inline-flex min-h-11 items-center text-[14px] font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">How we handle your messages</Link>
            </div>
            <div>
              <h2 className="text-[16px] font-medium">A reflection, not a verdict</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">It offers possible interpretations and practical next steps; it cannot know someone's intentions.</p>
            </div>
            <div>
              <h2 className="text-[16px] font-medium">See what you get before sharing</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">Explore a fictional sample, not a customer story.</p>
              <Link to="/sample" className="inline-flex min-h-11 items-center text-[14px] font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">See a sample</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-btln-line px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5 sm:px-8 md:pb-8" aria-label="More information">
        <div className="mx-auto max-w-2xl">
          <nav aria-label="Information" className="flex flex-wrap gap-x-5 gap-y-1">
            {[["About", "/about"], ["See a sample", "/sample"], ["Pricing", "/pricing"], ["Trust", "/trust"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, to]) => (
              <Link key={to} to={to} className="inline-flex min-h-11 items-center text-[14px] font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</Link>
            ))}
          </nav>
          <nav aria-label="Comparisons" className="mt-4 border-t border-btln-line pt-4">
            <p className="text-[13px] text-muted-foreground">Comparisons</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {[["ChatGPT", "/compare/chatgpt-vs-betweenthelines"], ["RIZZ", "/compare/rizz-vs-betweenthelines"], ["What Brandon Thinks", "/compare/whatbrandonthinks-vs-betweenthelines"]].map(([label, to]) => (
                <Link key={to} to={to} className="inline-flex min-h-11 items-center text-[13px] text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</Link>
              ))}
            </div>
          </nav>
        </div>
      </footer>
      <BottomNav />
    </div>
  );
};

export default Index;
