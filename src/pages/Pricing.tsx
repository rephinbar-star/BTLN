import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";

type ProductKey = "BTLN_monthly" | "BTLN_annual" | "BTLN_report_unlock";

const TIERS: {
  key: ProductKey;
  name: string;
  price: string;
  period: string;
  badge?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}[] = [
  {
    key: "BTLN_report_unlock",
    name: "Single report",
    price: "$4.99",
    period: "one-time",
    description: "Unlock one full analysis and its deep-dive sections.",
    features: [
      "Full report for one conversation",
      "Communication patterns & attachment styles",
      "The Four Horsemen check",
      "Personalized practice plan",
    ],
    cta: "Unlock a report",
    highlighted: false,
  },
  {
    key: "BTLN_monthly",
    name: "Monthly",
    price: "$9.99",
    period: "month",
    badge: "Most popular",
    description: "Unlimited analyses, insights, and relationship tracking.",
    features: [
      "Unlimited analyses",
      "All deep-dive sections unlocked",
      "Compare reports over time",
      "Cancel anytime",
    ],
    cta: "Subscribe monthly",
    highlighted: true,
  },
  {
    key: "BTLN_annual",
    name: "Annual",
    price: "$49.99",
    period: "year",
    badge: "Best value",
    description: "Save 58% with a full year of unlimited access.",
    features: [
      "Unlimited analyses for a full year",
      "All deep-dive sections unlocked",
      "Compare reports over time",
      "Priority support",
    ],
    cta: "Subscribe annually",
    highlighted: false,
  },
];

const PRODUCT_TO_OPTION: Record<ProductKey, "monthly" | "annual" | "one_time"> = {
  BTLN_monthly: "monthly",
  BTLN_annual: "annual",
  BTLN_report_unlock: "one_time",
};

export default function Pricing() {
  const { user } = useAuth();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [pending, setPending] = useState<ProductKey | null>(null);

  const launch = (priceId: ProductKey) => {
    setPending(priceId);
    logEvent("pricing_cta_clicked", { product_key: priceId });
    track("pricing_cta_clicked", { source: "pricing_page", option: PRODUCT_TO_OPTION[priceId] });

    const returnUrl = user
      ? `${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`
      : `${window.location.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    try {
      openCheckout({
        priceId,
        customerEmail: user?.email,
        userId: user?.id,
        returnUrl,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Pricing — BetweenTheLines™</title>
        <meta name="description" content="Unlock deeper relationship insights with BetweenTheLines. Choose a monthly, annual, or single-report plan." />
        <link rel="canonical" href="https://betweenthelines.app/pricing" />
        <meta property="og:title" content="Pricing — BetweenTheLines™" />
        <meta property="og:description" content="Choose the plan that fits you: unlimited monthly, annual, or a single report." />
        <meta property="og:url" content="https://betweenthelines.app/pricing" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <Header />

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Simple, transparent pricing
          </span>
          <h1 className="mt-4 text-[32px] font-medium tracking-tight sm:text-[42px]">
            Choose your plan
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Get the full picture of your relationship. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.key}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 hover:shadow-lg ${
                tier.highlighted
                  ? "border-foreground/30 bg-muted/30"
                  : "border-border bg-card"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background">
                  {tier.badge}
                </span>
              )}
              <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                {tier.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-[36px] font-medium tracking-tight">{tier.price}</span>
                <span className="text-[14px] text-muted-foreground">/{tier.period}</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {tier.description}
              </p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[14px]">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => launch(tier.key)}
                disabled={pending === tier.key}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-[14px] font-medium transition-all duration-200 hover:scale-[1.03] disabled:opacity-50 ${
                  tier.highlighted
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-border bg-card text-foreground hover:bg-foreground hover:text-background"
                }`}
              >
                {pending === tier.key ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening checkout…
                  </>
                ) : (
                  tier.cta
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[13px] text-muted-foreground">
            Secure checkout via Stripe. Prices in USD. Questions?{" "}
            <a href="mailto:support@betweenthelines.app" className="underline hover:text-foreground">
              support@betweenthelines.app
            </a>
          </p>
        </div>
      </main>

      <Footer />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-background/80 p-4 sm:p-6">
          <div className="my-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-lg">
            <button
              type="button"
              onClick={closeCheckout}
              className="mb-3 w-full text-right text-[13px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Close
            </button>
            {checkoutElement}
            <button
              type="button"
              onClick={closeCheckout}
              className="mt-4 w-full text-center text-[13px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
