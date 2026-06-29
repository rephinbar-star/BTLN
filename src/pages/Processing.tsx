import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { track, messageCountBucket } from "@/lib/analytics";
import logoAsset from "@/assets/logo.png.asset.json";

const RELATIONSHIP_FACTS: string[] = [
  "Couples who stay together respond to each other's small bids for attention about 86% of the time; couples who divorce, only 33%.",
  "Contempt — eye-rolling, sneering, mockery — is the single strongest predictor that a relationship will end.",
  "By watching just the first three minutes of a couple's argument, researchers can predict how the whole conversation will go about 96% of the time.",
  "In one landmark study, researchers predicted which newlyweds would divorce with around 94% accuracy — just from how they interacted.",
  "Even happy, lasting couples never resolve about 69% of their conflicts; they simply learn to live with them.",
  "In stable relationships, positive moments outnumber negative ones by about five to one during conflict — and far more outside of it.",
  "How your partner reacts to your good news may predict the relationship's future better than how they handle your bad news.",
  "Starting a hard conversation harshly almost guarantees it ends badly — the first 60 seconds set the tone.",
  "Online dating is now the most common way couples meet, overtaking introductions through friends around 2013.",
  "About 39% of heterosexual couples and roughly 65% of same-sex couples now meet online.",
  "In 1995, just 2% of couples met online; today it's the single most common way new relationships begin.",
  "Before the internet, most couples met through family and friends — those introductions have been declining since World War II.",
  "Couples who meet online are, on average, just as likely to stay together as couples who meet offline.",
  "The intense rush of early love usually cools within the first one to two years, giving way to a calmer, deeper attachment.",
  "We're drawn to people similar to us — the popular idea that 'opposites attract' isn't well supported by research.",
  "Two strangers can feel dramatically closer after answering 36 increasingly personal questions together.",
  "Missing your partner's bid for connection can hurt the relationship more than openly turning it down.",
  "Long-distance couples are not necessarily more likely to break up than couples who live in the same city.",
  "Most people can maintain only about 150 meaningful relationships at once — a limit known as 'Dunbar's number.'",
  "Our relationships nest in layers: roughly 5 intimate, 15 close, 50 good friends, and 150 we'd call friends.",
  "We can recognize and name about 1,500 faces — but truly maintain only around 150 active relationships.",
  "It takes roughly 50 hours of time together to turn an acquaintance into a casual friend.",
  "Going from casual friend to genuine friend takes about 90 hours of time together.",
  "Becoming someone's close or best friend takes more than 200 hours together.",
  "Texting and social media do little to build new friendships — face-to-face time is what forms them.",
  "Hours spent working alongside someone often don't count toward friendship the way shared fun does.",
  "The share of Americans with no close friends has quadrupled since 1990 — from about 3% to 12%.",
  "In 1990, a third of Americans had 10 or more close friends; today only about 13% do.",
  "In 1990, three-quarters of Americans said they had a best friend; far fewer do now.",
  "The 'friendship recession' has hit men hardest — the share with no close friends rose from 3% to 15%.",
  "One in five single men who aren't dating report having no close friends at all.",
  "Americans spent about 6.5 hours a week with friends in the early 2010s; by 2019 that had fallen to roughly 4.",
  "Time spent with friends peaks around age 18 and declines steeply from there.",
  "The number of friends we have tends to peak around age 25, then slowly shrinks.",
  "We quietly replace about half of our close social network roughly every seven years.",
  "Having just one close friend doesn't make people much less lonely than having none — a few makes a real difference.",
  "We tend to befriend the people we're simply near most often — proximity quietly shapes our closest bonds.",
  "Your 'sympathy group' — the roughly 15 people whose loss would truly devastate you — is smaller than most assume.",
  "About 27% of Americans — roughly 67 million people — are estranged from a family member.",
  "Around 40% of Americans say they've experienced family estrangement at some point in their lives.",
  "Among estranged people, rifts with a sibling are more common than rifts with a parent or child.",
  "Most family estrangements aren't permanent — many people cycle in and out of contact over the years.",
  "The most common roads to estrangement are clashing values, money and inheritance, and a 'problematic' in-law.",
  "Your relationship with a sibling is often the longest of your life — outlasting parents and sometimes partners.",
  "We spend the most time with our parents and siblings in our teens; it drops sharply once we leave home.",
  "Nearly 40% of Americans over the age of 89 live alone.",
  "Family estrangement rates are remarkably similar across race, education, and gender.",
  "A single conversation or event often becomes the final trigger for a family rift years in the making.",
  "People with strong social ties are about 50% more likely to survive over a given period than those without.",
  "Lacking social connection carries a mortality risk comparable to smoking up to 15 cigarettes a day.",
  "Loneliness is linked to roughly a 26% higher risk of early death; living alone, about 32%.",
  "In an 80-year Harvard study, the quality of people's relationships — not wealth or fame — best predicted their health and happiness.",
  "How satisfied people were with their relationships at 50 predicted their physical health at 80 better than their cholesterol did.",
  "From our 40s onward, the time we spend alone climbs steadily — reaching 8 to 9 hours a day by age 80.",
  "The variety of people we interact with tends to peak around age 40, then narrows.",
  "Living alone is rising across nearly every age group — but being alone and being lonely aren't the same thing.",
  "Couples argue most about the same handful of things: money, chores, time, and intimacy.",
  "Money is one of the most common sources of conflict — and one of the strongest stressors in marriages.",
  "A bid for connection can be tiny — 'look at that sunset' often really means 'turn toward me.'",
  "Couples who regularly express gratitude out loud tend to feel more satisfied and more committed.",
  "Repair attempts — a joke, a touch, an apology mid-fight — are one of the clearest signs a couple will last.",
  "Knowing the small details of your partner's world — their worries, friends, and dreams — is a foundation of lasting love.",
  "'Phubbing' — snubbing someone by glancing at your phone — measurably lowers relationship and friendship satisfaction.",
  "Partners who feel a phone competes for their attention report lower relationship satisfaction.",
  "Shared laughter is one of the strongest everyday signals of closeness between two people.",
  "Doing new and exciting things together can reignite passion — novelty, not just routine, feeds long-term attraction.",
  "Holding a loved one's hand can measurably dampen the brain's response to pain and threat.",
  "With a friend at your side, a steep hill literally looks less steep — support changes how we perceive challenges.",
  "We tend to 'catch' the moods, habits, and even health behaviors of the people closest to us.",
  "Happiness spreads through social networks — even your friends' friends can nudge your own well-being.",
  "Grandparents who help care for their grandchildren tend to live longer, on average.",
  "Feeling close to even one parent in adolescence is linked to better mental health well into adulthood.",
  "How we learned to handle conflict with our siblings often echoes through our adult relationships.",
  "Despite the popular theory, large studies find birth order has little real effect on personality.",
  "Friendships carry no formal obligation to continue — which is exactly why they fade without deliberate effort.",
  "People tend to be happier on days they spend more time socializing — introverts included.",
  "We consistently underestimate how glad an old friend will be to hear from us out of the blue.",
  "We expect talking to strangers to be awkward, yet people who do it usually report feeling happier afterward.",
  "Generosity tends to deepen friendships more than receiving does.",
  "Friends made through shared activity — sports, hobbies, projects — often outlast friends of mere convenience.",
  "Couples who celebrate each other's wins enthusiastically tend to be happier than those who only show up in hard times.",
  "Small daily kindnesses predict relationship happiness better than grand romantic gestures.",
  "How fondly a couple recalls their early days is a surprisingly strong sign of how the relationship is doing now.",
  "Feeling truly 'known' by your partner matters more to lasting satisfaction than how often you fight.",
  "Most conflicts aren't about the surface topic — the dishes are rarely really about the dishes.",
  "Stonewalling — shutting down and withdrawing during conflict — is one of the most corrosive things to a relationship.",
  "Criticism that attacks character ('you always...') does far more damage than a complaint about a specific action.",
  "Defensiveness tends to escalate an argument rather than defuse it — it reads as blame, not protection.",
  "Same-sex couples were early adopters of online dating, meeting online long before it became the norm for everyone.",
  "Meeting a partner through friends has declined since the mid-1990s; through family, since World War II.",
  "About half of Americans are satisfied with how many friends they have — the other half wish for more.",
  "Loneliness can spread through a social network — and so can connection.",
  "The roughly five people in your innermost circle absorb most of your emotional energy — and the time you give proves it.",
  "Each outer layer of friendship costs about a third as much time and closeness as the layer inside it.",
  "We can often sense within minutes whether a new acquaintance might become a friend — but it still takes ~50 hours to get there.",
  "Couples who accept each other's influence — who let themselves be swayed — tend to have stronger, longer marriages.",
  "A relationship's emotional 'bank account' is built in ordinary moments, not big events — the small deposits add up.",
  "Schools and workplaces throw us together by proximity — which is why so many lifelong friendships start there.",
  "The popular 'love languages' idea is hugely influential, though scientific support for it is surprisingly mixed.",
  "Across cultures and centuries, strong relationships remain the most consistent ingredient of a life people call happy.",
];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const QUOTE_ROTATE_MS = 7000;
const EXPECTED_DURATION_MS = 75_000; // ~middle of 30–90s window

const POLL_INTERVAL_MS = 2000;
const SLOW_THRESHOLD_MS = 180_000;
const TIMEOUT_MS = 240_000;

const Processing = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const poolRef = useRef<string[]>(shuffle(RELATIONSHIP_FACTS));
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [progress, setProgress] = useState(2);
  const [showSlow, setShowSlow] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const stopped = useRef(false);

  // Rotate quotes. We cycle through the entire shuffled pool before reshuffling,
  // and we guarantee the first quote of a new pool is never the same as the last
  // quote just displayed.
  useEffect(() => {
    const t = setInterval(() => {
      setQuoteIdx((i) => {
        if (i + 1 < poolRef.current.length) {
          return i + 1;
        }
        const lastQuote = poolRef.current[i];
        let nextPool = shuffle(RELATIONSHIP_FACTS);
        while (nextPool.length > 1 && nextPool[0] === lastQuote) {
          nextPool = shuffle(RELATIONSHIP_FACTS);
        }
        poolRef.current = nextPool;
        return 0;
      });
    }, QUOTE_ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  // Animate progress bar — eases toward ~92% over the expected duration,
  // then creeps slowly so it never visually stalls at 100% before completion.
  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const target = Math.min(92, (elapsed / EXPECTED_DURATION_MS) * 92);
      setProgress((p) => {
        if (p >= 99) return p;
        if (p < target) return Math.min(target, p + 0.8);
        return Math.min(99, p + 0.05);
      });
    }, 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!analysisId) {
      navigate(`/error?reason=${encodeURIComponent("not_found")}`, { replace: true });
      return;
    }

    let firstQuery = true;

    const poll = async () => {
      if (stopped.current) return;
      const { data: rows, error } = await supabase.rpc("get_analysis_for_session", {
        p_id: analysisId,
        p_session_id: getSessionId(),
      });
      const data = Array.isArray(rows) ? rows[0] : rows;

      if (error || !data) {
        if (firstQuery) {
          stopped.current = true;
          navigate(`/error?reason=${encodeURIComponent("not_found")}`, { replace: true });
          return;
        }
        // transient — keep polling
        firstQuery = false;
        return;
      }
      firstQuery = false;

      if (data.status === "complete") {
        stopped.current = true;
        setProgress(100);
        // PostHog: only the UUID + coarse signals — never report content.
        const lowConfidence = (() => {
          try {
            const r = (data as { result_json?: unknown }).result_json as { confidence?: string } | null | undefined;
            const c = r?.confidence;
            return typeof c === "string" && /low/i.test(c);
          } catch {
            return false;
          }
        })();
        track("report_completed", {
          analysis_id: analysisId!,
          low_confidence: lowConfidence,
          message_count_bucket: messageCountBucket(
            (data as { message_count?: number | null }).message_count,
          ),
        });
        navigate(`/report/${analysisId}`, { replace: true });
        return;
      }
      if (data.status === "failed") {
        stopped.current = true;
        track("analysis_failed", { reason_code: "engine_error" });
        const reason = data.error_message ?? "Analysis failed.";
        navigate(`/error?reason=${encodeURIComponent(reason)}`, { replace: true });
        return;
      }

      const elapsed = Date.now() - startedAt.current;
      if (elapsed > TIMEOUT_MS) {
        stopped.current = true;
        track("analysis_failed", { reason_code: "timeout" });
        navigate(`/error?reason=${encodeURIComponent("timeout")}`, { replace: true });
        return;
      }
      if (elapsed > SLOW_THRESHOLD_MS) {
        setShowSlow(true);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      stopped.current = true;
      clearInterval(interval);
    };
  }, [analysisId, navigate]);

  const currentQuote = poolRef.current[quoteIdx];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <Helmet>
        <title>Analyzing your conversation — BetweenTheLines™</title>
        <meta name="description" content="Reading between the lines of your messages. Your relationship analysis is being prepared and will be ready in 30–90 seconds." />
        <link rel="canonical" href="https://betweenthelines.app/processing" />
        <meta property="og:title" content="Analyzing your conversation — BetweenTheLines™" />
        <meta property="og:description" content="Your relationship analysis is being prepared." />
        <meta property="og:url" content="https://betweenthelines.app/processing" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="flex items-center gap-2">
        <img src={logoAsset.url} alt="BetweenTheLines™" className="h-24 w-auto" />
      </div>

      <h1 className="sr-only">Analyzing your conversation</h1>

      <p className="mt-10 text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Did you know?
      </p>

      <blockquote
        key={`quote-${quoteIdx}`}
        className="mt-4 max-w-xl animate-in fade-in text-[20px] font-medium leading-snug tracking-tight duration-700 sm:text-[24px]"
      >
        “{currentQuote}”
      </blockquote>

      <div
        className="mt-10 h-2 w-full max-w-md overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Analysis progress"
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-4 text-[14px] font-medium tracking-tight text-muted-foreground sm:text-[16px]">
        Reading between the lines…
      </p>

      <p className="mt-10 max-w-md text-[12px] leading-relaxed text-muted-foreground">
        This usually takes 30–90 seconds. Don't refresh. Your messages will be deleted as soon as the analysis is done.
      </p>

      {showSlow && (
        <p className="mt-4 max-w-md text-[13px] text-pastel-amber-fg-strong">
          Taking longer than expected… still working.
        </p>
      )}

    </div>
  );
};

export default Processing;