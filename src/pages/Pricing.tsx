import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check, Loader2, MessageCircle, MessagesSquare, Users, BookOpen, Laugh, Sparkles, Compass } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { HelpMeChoose } from "@/components/pricing/HelpMeChoose";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";
import { PRICING_BTN } from "@/lib/pricing/button";
import { OPERATOR } from "@/config/operator";

type ProductKey = "BTLN_decode_monthly" | "BTLN_monthly" | "BTLN_annual" | "BTLN_report_unlock";

/** The named modes, used for the chips on every card. */
const MODES = {
  quick: { label: "Quick Take", Icon: MessageCircle },
  interactive: { label: "Interactive Mode", Icon: MessagesSquare },
  deep: { label: "Deep Read", Icon: BookOpen },
  groupRead: { label: "Group Read", Icon: Users },
  groupRoast: { label: "Group Roast", Icon: Laugh },
  r360: { label: "Relationship360", Icon: Compass },
} as const;

type ModeKey = keyof typeof MODES;

const ModeChips = ({ modes }: { modes: ModeKey[] }) => (
  <ul className="mt-3 flex flex-wrap gap-2">
    {modes.map((key) => {
      const { label, Icon } = MODES[key];
      return (
        <li
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px]"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </li>
      );
    })}
  </ul>
);

export { PRICING_BTN };

type Tier = {
  key: ProductKey | "prime";
  name: string;
  price: string;
  period: string;
  modes: ModeKey[];
  description: string;
  features: string[];
  cta: string;
  mint?: boolean;
};

const QUICK_TIER: Tier = {
  key: "BTLN_decode_monthly",
  name: "Quick Take plan",
  price: "$6.99",
  period: "month",
  modes: ["quick"],
  description:
    "One read of a message each time: what it may mean, and three suggested replies.",
  features: [
    "Quick Takes without the one-free-read limit",
    "Each read: interpretation, signals and three suggested replies",
    "One session per read — ongoing exchanges need Interactive Mode",
    "Does not unlock Deep Read, Group Read or Group Roast",
    "Cancel anytime",
  ],
  cta: "Subscribe to Quick Take",
};

const REPORT_TIERS: Tier[] = [
  {
    key: "BTLN_report_unlock",
    name: "Single report",
    price: "$4.99",
    period: "one-time",
    modes: ["deep", "groupRead", "groupRoast"],
    description:
      "1 selected report. The payment is attached to the report you start, so choose the read first.",
    features: [
      "1 selected report: a Deep Read, a Group Read or a Group Roast",
      "Every section of that report",
      "Share and download that report",
      "Does not cover Quick Take sessions",
      "No subscription",
    ],
    cta: "Choose a report to start",
  },
  {
    key: "BTLN_monthly",
    name: "Monthly full-report plan",
    price: "$9.99",
    period: "month",
    modes: ["quick", "deep", "groupRead", "groupRoast"],
    description:
      "Full reports across Deep Read, Group Read and Group Roast, plus Quick Takes, while the plan is active.",
    features: [
      "Deep Reads, Group Reads and Group Roasts while active",
      "Quick Takes without the free-read limit",
      "All report sections unlocked",
      "Interactive Mode and Relationship360 are not included",
      "Cancel anytime",
    ],
    cta: "Subscribe monthly",
  },
  {
    key: "BTLN_annual",
    name: "Annual full-report plan",
    price: "$49.99",
    period: "year",
    modes: ["quick", "deep", "groupRead", "groupRoast"],
    description: "The same full-report access, billed once a year.",
    features: [
      "Deep Reads, Group Reads and Group Roasts while active",
      "Quick Takes without the free-read limit",
      "All report sections unlocked",
      "Interactive Mode and Relationship360 are not included",
      "Billed yearly",
    ],
    cta: "Subscribe annually",
  },
];

const PRIME_TIER: Tier = {
  key: "prime",
  name: "Prime",
  price: "$19.99",
  period: "month",
  modes: ["quick", "interactive", "deep", "groupRead", "groupRoast", "r360"],
  description:
    "Understand who you are in your relationships—and get insights and coaching for self improvement.",
  features: [
    "Every mode: Quick Take, Deep Read, Group Read and Group Roast",
    "Interactive Mode included — no separate add-on",
    "Your Relationship360 across the conversations you include",
    "Practical coaching that develops as you add more conversations",
    "Relationship360 is in development and Prime is not available to buy yet",
  ],
  cta: "See what's in Prime",
  mint: true,
};

const PRODUCT_TO_OPTION: Record<ProductKey, "monthly" | "annual" | "one_time" | "decode_monthly"> = {
  BTLN_decode_monthly: "decode_monthly",
  BTLN_monthly: "monthly",
  BTLN_annual: "annual",
  BTLN_report_unlock: "one_time",
};

/**
 * Coverage matrix. Every cell is taken from the server rules that actually
 * decide access, not from marketing copy:
 *  - Quick Take: useDecodeAccess / count_completed_decodes — the first read is
 *    free per session/user; any active subscription lifts that limit. The
 *    $4.99 single-report unlock is bound to a report row and grants no Quick
 *    Take session, so that cell states the real free-session status instead.
 *  - Interactive Mode: no entitlement exists yet; the add-on is in development.
 *  - Deep Read: user_has_paid_access (monthly/annual tiers, or a one-time
 *    unlock bound to that analysis).
 *  - Group Read: analyze-group FULL_PLAN_TIERS = monthly, annual, or a
 *    group_read_unlocks row.
 *  - Group Roast: group-roast-data — monthly/annual, or a group_roast_unlocks
 *    row. Group Read access does not grant it.
 *  - Relationship360: no entitlement exists on any plan; it belongs to Prime's
 *    intended coverage and the engine is in development.
 */
const COVERAGE: { row: string; cells: Record<string, string> }[] = [
  {
    row: "Quick Take",
    cells: {
      quick: "Included",
      single: "Not included — first session free",
      monthly: "Included",
      annual: "Included",
      prime: "Included in Prime",
    },
  },
  {
    row: "Interactive Mode",
    cells: {
      quick: "Optional +$2.99/mo · In development",
      single: "Not included",
      monthly: "Not included",
      annual: "Not included",
      prime: "Included in Prime",
    },
  },
  {
    row: "Deep Read",
    cells: {
      quick: "Not included",
      single: "1 selected report",
      monthly: "Included",
      annual: "Included",
      prime: "Included in Prime",
    },
  },
  {
    row: "Group Read",
    cells: {
      quick: "Not included",
      single: "1 selected report",
      monthly: "Included",
      annual: "Included",
      prime: "Included in Prime",
    },
  },
  {
    row: "Group Roast",
    cells: {
      quick: "Not included",
      single: "1 selected report",
      monthly: "Included",
      annual: "Included",
      prime: "Included in Prime",
    },
  },
  {
    row: "Relationship360",
    cells: {
      quick: "Not Included",
      single: "Not Included",
      monthly: "Not Included",
      annual: "Not Included",
      prime: "Included in Prime · In development",
    },
  },
];

const COLUMNS = [
  { id: "quick", label: "Quick Take · $6.99/mo · optional Interactive Mode" },
  { id: "single", label: "Single report · $4.99" },
  { id: "monthly", label: "Monthly · $9.99/mo" },
  { id: "annual", label: "Annual · $49.99/yr" },
  { id: "prime", label: "Prime · $19.99/mo" },
];


export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMember, tier: memberTier, hasInteractiveMode } = useMembership();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [pending, setPending] = useState<string | null>(null);
  const [chooseMode, setChooseMode] = useState(false);
  const [searchParams] = useSearchParams();
  // A plan the user picked before signing in. It is only highlighted on return —
  // never charged automatically.
  const intended = searchParams.get("plan");
  const selectedByGuide = searchParams.get("interactive") === "1";
  const isPrime = memberTier === "prime";
  const [interactiveSelected, setInteractiveSelected] = useState(selectedByGuide);
  const intendedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (intended && intendedRef.current) {
      intendedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [intended]);

  useEffect(() => {
    if (selectedByGuide || hasInteractiveMode || isPrime) setInteractiveSelected(true);
  }, [selectedByGuide, hasInteractiveMode, isPrime]);

  const setInteractiveIntent = (checked: boolean) => {
    if (hasInteractiveMode || isPrime) return;
    setInteractiveSelected(checked);
    const next = new URLSearchParams(searchParams);
    next.set("plan", "BTLN_decode_monthly");
    if (checked) next.set("interactive", "1");
    else next.delete("interactive");
    navigate(`/pricing?${next.toString()}#sec-quick`, { replace: true });
  };

  const launch = (priceId: ProductKey) => {
    setPending(priceId);
    logEvent("pricing_cta_clicked", { product_key: priceId });
    track("pricing_cta_clicked", { source: "pricing_page", option: PRODUCT_TO_OPTION[priceId] });

    if (priceId === "BTLN_report_unlock") {
      setChooseMode(true);
      setPending(null);
      return;
    }
    if (!user) {
      navigate(`/auth?return_to=${encodeURIComponent(`/pricing?plan=${priceId}`)}`);
      setPending(null);
      return;
    }

    try {
      openCheckout({
        priceId,
        customerEmail: user.email,
        userId: user.id,
        returnUrl: `${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      });
      logEvent("checkout_session_created", { product_key: priceId, source: "pricing_page" });
    } catch (e) {
      logEvent("checkout_session_failed", {
        product_key: priceId,
        source: "pricing_page",
        error: (e as Error).message,
      });
    } finally {
      setPending(null);
    }
  };

  const currentPlanKey =
    memberTier === "monthly"
      ? "BTLN_monthly"
      : memberTier === "annual"
        ? "BTLN_annual"
        : memberTier === "decode_monthly"
          ? "BTLN_decode_monthly"
          : null;

  const TierCard = ({ tier }: { tier: Tier }) => {
    const isCurrent = currentPlanKey === tier.key;
    const isIntended = intended === tier.key;
    return (
      <div
        ref={isIntended ? intendedRef : undefined}
        className={`relative flex w-full flex-col rounded-2xl border p-6 transition-all duration-200 motion-reduce:transition-none hover:shadow-lg sm:w-[330px] ${
          tier.mint ? "border-btln-line bg-btln-mint/60" : "border-border bg-card"
        } ${isIntended ? "ring-2 ring-foreground/40" : ""}`}
      >
        <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {tier.name}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-[36px] font-medium tracking-tight">{tier.price}</span>
          <span className="text-[14px] text-muted-foreground">/{tier.period}</span>
        </div>
        <ModeChips modes={tier.modes} />
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{tier.description}</p>

        <ul className="mt-6 flex flex-1 flex-col gap-2.5">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[14px]">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {tier.key === "prime" ? (
          <Link to={`/prime?return_to=${encodeURIComponent("/pricing")}`} className={`mt-8 ${PRICING_BTN}`}>
            {tier.cta}
          </Link>
        ) : isCurrent ? (
          <Link to="/account" className={`mt-8 ${PRICING_BTN}`}>
            Your current plan · Manage
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => launch(tier.key as ProductKey)}
            disabled={pending === tier.key}
            className={`mt-8 ${PRICING_BTN}`}
          >
            {pending === tier.key ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Opening checkout…
              </>
            ) : (
              tier.cta
            )}
          </button>
        )}
        {isMember && memberTier !== "prime" && tier.key === "prime" && (
          <p className="mt-3 text-[13px] text-muted-foreground">
            You're on the {memberTier} plan. Prime isn't available to buy yet.
          </p>
        )}
      </div>
    );
  };

  const QuickTakeCard = () => {
    const quickIsCurrent = currentPlanKey === "BTLN_decode_monthly";
    const addonIncluded = hasInteractiveMode || isPrime;
    const bundleUnavailable = interactiveSelected && !addonIncluded;
    const status = isPrime
      ? "Included with Prime — no add-on charge"
      : hasInteractiveMode
        ? "Interactive Mode is current on your account"
        : "In development — not available to buy yet";

    return (
      <div
        ref={intended === QUICK_TIER.key ? intendedRef : undefined}
        className={`relative flex w-full max-w-[600px] flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 motion-reduce:transition-none hover:shadow-lg sm:p-6 ${intended === QUICK_TIER.key ? "ring-2 ring-foreground/40" : ""}`}
      >
        <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Quick Take plan</div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-[36px] font-medium tracking-tight">$6.99</span>
          <span className="text-[14px] text-muted-foreground">/month</span>
        </div>
        <ModeChips modes={["quick"]} />
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          The base plan reads one message at a time and gives you three suggested replies.
        </p>
        <ul className="mt-4 space-y-2.5">
          {QUICK_TIER.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[14px]">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-xl border border-btln-line bg-btln-mint/30 p-4">
          <label className={`flex min-h-11 items-start gap-3 ${addonIncluded ? "cursor-default" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={interactiveSelected}
              disabled={addonIncluded}
              onChange={(event) => setInteractiveIntent(event.target.checked)}
              className="mt-1 h-5 w-5 flex-none accent-btln-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btln-ink focus-visible:ring-offset-2"
            />
            <span>
              <span className="block text-[15px] font-medium">Add Interactive Mode — +$2.99/month</span>
              <span className="mt-1 block text-[13px] text-muted-foreground">Requires Quick Take · $6.99/month</span>
            </span>
          </label>

          <div className="mt-3 border-t border-btln-line pt-3" aria-live="polite" aria-atomic="true">
            <p className="text-[20px] font-medium">{interactiveSelected ? "$9.98/month" : "$6.99/month"}</p>
            <p className="text-[13px] text-muted-foreground">
              {interactiveSelected ? "$6.99 Quick Take + $2.99 Interactive Mode" : "$6.99 Quick Take only"}
            </p>
          </div>

          <h3 className="mt-4 text-[15px] font-medium">Interactive Mode adds:</h3>
          <ul className="mt-2 space-y-2 text-[14px] leading-relaxed">
            {[
              "Continue the same conversation as new messages arrive.",
              "Add the response you actually sent, by text or follow-up screenshot.",
              "Get updated insights and fresh reply suggestions based on the continuing exchange.",
              "Keep the context together instead of starting a new read each time.",
              "Record what happened next and reflect on how the exchange unfolded.",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted-foreground">
            With Prime, eligible exchanges also contribute to your Relationship360.
          </p>
          <p className="mt-3 text-[13px] font-medium">{status}</p>
        </div>

        {isPrime ? (
          <Link to="/account" className={`mt-6 ${PRICING_BTN}`}>Included with Prime · Manage</Link>
        ) : hasInteractiveMode ? (
          <Link to="/account" className={`mt-6 ${PRICING_BTN}`}>Interactive Mode current · Manage</Link>
        ) : bundleUnavailable ? (
          <>
            <button type="button" disabled className={`mt-6 ${PRICING_BTN}`}>Bundle not available to buy yet</button>
            <button
              type="button"
              onClick={() => {
                setInteractiveIntent(false);
                if (!quickIsCurrent) launch("BTLN_decode_monthly");
              }}
              className="mt-3 min-h-11 text-[14px] font-medium underline underline-offset-4"
            >
              {quickIsCurrent ? "Keep my current Quick Take plan" : "Continue with base Quick Take only — $6.99/month"}
            </button>
          </>
        ) : quickIsCurrent ? (
          <Link to="/account" className={`mt-6 ${PRICING_BTN}`}>Your current plan · Manage</Link>
        ) : (
          <button
            type="button"
            onClick={() => launch("BTLN_decode_monthly")}
            disabled={pending === "BTLN_decode_monthly"}
            className={`mt-6 ${PRICING_BTN}`}
          >
            {pending === "BTLN_decode_monthly" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Opening checkout…</> : "Subscribe to Quick Take — $6.99/month"}
          </button>
        )}
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "SoftwareApplication", name: "BetweenTheLines", applicationCategory: "LifestyleApplication", operatingSystem: "Web", url: "https://betweenthelines.app/pricing", offers: [
            { "@type": "Offer", name: "Quick Take plan", price: "6.99", priceCurrency: "USD" },
            { "@type": "Offer", name: "Single report", price: "4.99", priceCurrency: "USD" },
            { "@type": "Offer", name: "Monthly full-report plan", price: "9.99", priceCurrency: "USD" },
            { "@type": "Offer", name: "Annual full-report plan", price: "49.99", priceCurrency: "USD" }
          ]
        })}</script>
        <title>Pricing — BetweenTheLines™</title>
        <meta name="description" content="Quick Take, Deep Read, Group Read and Group Roast pricing: a $6.99 Quick Take plan, a $4.99 single report, or a $9.99 monthly / $49.99 annual full-report plan." />
        <link rel="canonical" href="https://betweenthelines.app/pricing" />
        <meta property="og:title" content="Pricing — BetweenTheLines™" />
        <meta property="og:description" content="See exactly which plan covers Quick Take, Deep Read, Group Read and Group Roast." />
        <meta property="og:url" content="https://betweenthelines.app/pricing" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <Header />

      <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Simple, transparent pricing
          </span>
          <h1 className="mt-4 text-[32px] font-medium tracking-tight sm:text-[42px]">
            First choose what you need
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Pick the mode that matches your situation, then choose how often you want it. Every
            card names the modes it covers.
          </p>
          <HelpMeChoose />
        </div>

        {intended && !isMember && (
          <p className="mx-auto mt-6 max-w-xl rounded-2xl border border-border bg-muted/40 p-4 text-center text-[14px]">
            Your plan choice is still selected below. Nothing has been charged — open checkout when you're ready.
          </p>
        )}

        <section className="mt-12" aria-labelledby="sec-quick">
          <h2 id="sec-quick" className="text-center text-[20px] font-medium">
            Quick Take — one message at a time
          </h2>
          <p className="mx-auto mt-1 max-w-xl text-center text-[14px] text-muted-foreground">
            Quick Take reads one message and suggests three replies. Interactive Mode keeps the same
            conversation going.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            <QuickTakeCard />
          </div>
        </section>

        <section className="mt-12" aria-labelledby="sec-reports">
          <h2 id="sec-reports" className="text-center text-[20px] font-medium">
            Full reports — Deep Read, Group Read, Group Roast
          </h2>
          <p className="mx-auto mt-1 max-w-xl text-center text-[14px] text-muted-foreground">
            One report when you need it, or a plan that covers all three.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            {REPORT_TIERS.map((tier) => (
              <TierCard key={tier.key} tier={tier} />
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="sec-prime">
          <h2 id="sec-prime" className="text-center text-[20px] font-medium">
            Prime — every mode, plus your Relationship360
          </h2>
          <div className="mt-4 flex justify-center">
            <TierCard tier={PRIME_TIER} />
          </div>
        </section>

        <section className="mt-16" aria-labelledby="sec-compare">
          <h2 id="sec-compare" className="text-center text-[20px] font-medium">
            Which plan covers what?
          </h2>
          <p className="mx-auto mt-1 max-w-xl text-center text-[14px] text-muted-foreground">
            Taken from the access rules the server actually applies. Interactive Mode,
            Relationship360 and Prime are in development and cannot be purchased yet.
          </p>


          {/* Wide screens: one table. */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-[14px]">
              <caption className="sr-only">Which plan covers each read</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-border p-3 font-medium">
                    Read
                  </th>
                  {COLUMNS.map((col) => (
                    <th key={col.id} scope="col" className="border-b border-border p-3 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COVERAGE.map((row) => (
                  <tr key={row.row}>
                    <th scope="row" className="border-b border-border p-3 font-medium">
                      {row.row}
                    </th>
                    {COLUMNS.map((col) => (
                      <td key={col.id} className="border-b border-border p-3 text-muted-foreground">
                        {row.cells[col.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: the same matrix, stacked per plan. */}
          <div className="mt-4 flex flex-col gap-4 md:hidden">
            {COLUMNS.map((col) => (
              <div key={col.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[14px] font-medium">{col.label}</p>
                <dl className="mt-2 space-y-1.5">
                  {COVERAGE.map((row) => (
                    <div key={row.row} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[14px]">{row.row}</dt>
                      <dd className="text-right text-[14px] text-muted-foreground">{row.cells[col.id]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl border-t border-border pt-10">
          <h2 className="text-[24px] font-medium">Pricing questions</h2>
          <div className="mt-6 divide-y divide-border">
            <div className="py-5">
              <h3 className="font-medium">What is Interactive Mode, and what does it cost?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Quick Take on its own reads one message and suggests three replies. Interactive Mode
                lets you carry on: tell us what you actually sent, add what came back, and get an
                updated read. Select the optional checkbox inside the Quick Take card to see the
                $6.99 base plus $2.99 add-on breakdown — $9.98/month combined. It is included in
                Prime without an add-on charge. It is still being built, so selecting it cannot
                start a bundle purchase yet.
              </p>
            </div>
            <div className="py-5">
              <h3 className="font-medium">Does the $4.99 single report cover a Quick Take?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                No. The single-report payment is attached to one Deep Read, Group Read or Group
                Roast. Quick Take has its own free first session, then the $6.99/month plan.
              </p>
            </div>
            <div className="py-5">
              <h3 className="font-medium">Can I buy a single report before starting it?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                A one-time purchase is attached to a specific report, so start the read first. Choose Deep Read,
                Group Read or Group Roast and checkout appears for that exact report.
              </p>
            </div>
            <div className="py-5">
              <h3 className="font-medium">Does the Quick Take plan unlock Deep Read or the group reads?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                No. The $6.99 Quick Take plan covers Quick Takes only. Deep Read, Group Read and Group Roast need
                the full-report plan or a single-report purchase.
              </p>
            </div>
            <div className="py-5">
              <h3 className="font-medium">Is Prime available?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Not yet. Relationship360 is still in development, so Prime cannot be purchased. The Prime page
                shows what it will include and its current status.
              </p>
            </div>
            <div className="py-5">
              <h3 className="font-medium">What happens after I cancel?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Access remains through the paid period shown in your account, then ends unless the plan renews.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-12 text-center">
          <p className="text-[13px] text-muted-foreground">
            Secure checkout via Stripe. Prices in USD. Questions?{" "}
            <a href={`mailto:${OPERATOR.contactEmail}`} className="underline hover:text-foreground">
              {OPERATOR.contactEmail}
            </a>
          </p>
        </div>
      </main>

      <Footer />

      {chooseMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a report to start"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[18px] font-medium">Which report do you want?</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              The $4.99 payment attaches to the report you start, so pick the read first.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {[
                { to: "/deep", label: "Deep Read — one conversation, two people" },
                { to: "/group", label: "Group Read — a serious read of a group chat" },
                { to: "/group-roast", label: "Group Roast — a playful roast of a group chat" },
              ].map((item) => (
                <Link key={item.to} to={item.to} className={`${PRICING_BTN} justify-start`}>
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setChooseMode(false)}
              className={`mt-4 ${PRICING_BTN}`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-background/80 p-4 sm:p-6">
          <div className="my-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-lg">
            <button
              type="button"
              onClick={closeCheckout}
              className={`mb-3 ${PRICING_BTN}`}
            >
              Close
            </button>
            {checkoutElement}
            <button
              type="button"
              onClick={closeCheckout}
              className={`mt-4 ${PRICING_BTN}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
