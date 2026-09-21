import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, MessageSquare, Sparkles, Users, UsersRound, type LucideIcon } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { BottomNav } from "@/components/nav/BottomNav";
import { SeeExample } from "@/components/examples/ExampleExperience";
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
    cta: "Help me with this text",
    exampleKind: "quick" as const,
    icon: MessageSquare,
    tone: "bg-btln-mint",
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
    cta: "Help me understand us",
    exampleKind: "deep" as const,
    icon: Users,
    tone: "bg-card",
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
    tone: "bg-btln-peach",
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
};

const SituationCard = ({ mode }: { mode: Mode }) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `home-${mode.exampleKind}-situations`;
  const Icon = mode.icon;

  return (
    <article className={`rounded-[20px] border border-btln-line p-5 sm:p-6 ${mode.tone}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background/80">
          <Icon className="h-5 w-5 text-btln-forest" aria-hidden="true" />
        </span>
        <p className="text-[13px] font-semibold uppercase text-btln-forest">{mode.label}</p>
      </div>

      <h2 className="mt-4 text-[24px] font-medium leading-tight sm:text-[27px]">{mode.title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-6">
        <p>{mode.scenario}</p>
        <p className="font-medium text-btln-forest">{mode.benefit}</p>
        {mode.note && <p className="text-[14px] font-semibold">{mode.note}</p>}
      </div>

      <Button
        type="button"
        variant="link"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="mt-2 min-h-11 px-0 text-foreground underline underline-offset-4"
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

      <div className="mt-5 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-5">
        <Button asChild className="min-h-12 rounded-full px-5">
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
      <main className="mx-auto max-w-2xl px-5 pb-28 pt-2 sm:px-8 md:pb-16">
        <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[44px]">
          What brought you here today?
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
          Find the read that fits your situation.
        </p>

        <div className="mt-7 space-y-4">
          {MODES.map((mode) => (
            <SituationCard key={mode.to} mode={mode} />
          ))}
        </div>

        <section className="mt-9 border-y border-btln-line py-7" aria-labelledby="prime-heading">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-btln-mint">
              <Sparkles className="h-5 w-5 text-btln-forest" aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-btln-forest">PRIME</p>
          </div>
          <h2 id="prime-heading" className="mt-4 text-[24px] font-medium leading-tight sm:text-[27px]">
            Is this a pattern in my relationships?
          </h2>
          <p className="mt-4 text-[15px] leading-6">
            You’ve noticed something familiar across different relationships—perhaps you avoid
            difficult conversations, seek reassurance, or keep taking responsibility for everyone
            else. You want to understand whether the pattern is real and how it changes.
          </p>
          <p className="mt-3 text-[15px] font-medium leading-6 text-btln-forest">
            We’re building Your Relationship360 to connect insights from conversations you
            choose to include, help you recognise patterns over time, and offer practical coaching
            and check-ins.
          </p>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">
            Relationship360 Preview · In development
          </p>

          <Button asChild className="mt-5 min-h-12 rounded-full px-5">
            <Link to="/prime">
              Explore Prime — $19.99/month
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

      </main>
      <BottomNav />
    </div>
  );
};

export default Index;
