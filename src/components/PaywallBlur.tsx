import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/session";

type ProductKey = "BTLN_monthly" | "BTLN_annual" | "BTLN_report_unlock";

type Props = {
  locked: boolean;
  children: React.ReactNode;
  isOwner: boolean;
  isAnonymousOwner?: boolean;
  analysisId: string;
  ctaPosition?: "centered" | "top";
};

export function PaywallBlur({ locked, children, isOwner, isAnonymousOwner = false, analysisId, ctaPosition = "centered" }: Props) {
  useEffect(() => {
    if (locked) {
      const user_state = isOwner
        ? "authed_owner"
        : isAnonymousOwner
          ? "anonymous_owner"
          : "visitor";
      logEvent("paywall_viewed", {
        analysis_id: analysisId,
        is_owner: isOwner,
        user_state,
      });
    }
  }, [locked, isOwner, isAnonymousOwner, analysisId]);

  if (!locked) return <>{children}</>;

  // Children are expected to render their own blur on the locked content
  // (section headings remain unblurred so the user can see what's behind
  // the paywall). The CTA floats at viewport eye-level via sticky
  // positioning so it's visible the moment the user reaches the paywall.
  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-none absolute inset-0 flex justify-center"
        aria-hidden="false"
      >
        <div
          className="pointer-events-auto sticky w-full px-4 flex justify-center"
          style={{ top: "10vh", alignSelf: "flex-start", maxHeight: "85vh" }}
        >
          {isOwner ? (
            <UnlockOptions analysisId={analysisId} />
          ) : isAnonymousOwner ? (
            <AnonymousOwnerCta analysisId={analysisId} />
          ) : (
            <VisitorCta />
          )}
        </div>
      </div>
    </div>
  );
}

function VisitorCta() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-lg">
      <h3 className="text-[22px] font-medium tracking-tight">Run your own analysis to see this</h3>
      <p className="mt-3 text-[14px] text-muted-foreground">
        Get your couple's full breakdown — communication patterns, attachment styles, hidden dynamics, and a weekly plan.
      </p>
      <Link
        to="/#input-section"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-[14px] font-medium text-background hover:opacity-90"
      >
        Start your analysis
      </Link>
    </div>
  );
}

function AnonymousOwnerCta({ analysisId }: { analysisId: string }) {
  const returnTo = `/report/${analysisId}`;
  const onClick = () =>
    logEvent("signup_cta_clicked", {
      source: "paywall",
      analysis_id: analysisId,
    });
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-lg">
      <Link
        to={`/auth?return_to=${encodeURIComponent(returnTo)}&intent=unlock`}
        onClick={onClick}
        className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-[14px] font-medium text-background hover:opacity-90"
      >
        Unlock the full analysis
      </Link>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Free account, then choose your option.
      </p>
      <Link
        to={`/auth?mode=signin&return_to=${encodeURIComponent(returnTo)}`}
        className="mt-2 inline-block text-[12px] text-muted-foreground underline-offset-2 hover:underline"
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
}

function UnlockOptions({ analysisId }: { analysisId: string }) {
  const { user } = useAuth();
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [pending, setPending] = useState<ProductKey | null>(null);
  const [priorUnlockCount, setPriorUnlockCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setPriorUnlockCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("one_time_unlocks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("analysis_id", analysisId);
      if (!cancelled) setPriorUnlockCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, analysisId]);

  const isReturning = (priorUnlockCount ?? 0) > 0;

  const launch = (priceId: ProductKey) => {
    setPending(priceId);
    logEvent("unlock_cta_clicked", { product_key: priceId, analysis_id: analysisId });
    try {
      openCheckout({
        priceId,
        customerEmail: user?.email,
        userId: user?.id,
        analysisId,
        returnUrl: `${window.location.origin}/report/${analysisId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      });
      logEvent("checkout_session_created", { product_key: priceId, analysis_id: analysisId });
    } catch (e) {
      logEvent("checkout_session_failed", {
        product_key: priceId,
        analysis_id: analysisId,
        error: (e as Error).message,
      });
    } finally {
      setPending(null);
    }
  };

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-6">
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
    );
  }

  return (
    <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 text-center shadow-lg sm:p-7">
      <div className="flex justify-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Lock className="h-4 w-4" />
        </span>
      </div>
      <h3 className="mt-3 text-[22px] font-medium tracking-tight">
        {isReturning ? "This is a new read" : "Unlock your full report"}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        {isReturning
          ? "You've unlocked 1 report. Go unlimited for $9.99/mo — every analysis opens automatically, no paywall."
          : "See all four communication patterns, your full attachment profiles, the Four Horsemen check, and your personalized practice plan."}
      </p>

      <div className="mt-6 flex flex-col gap-3 text-left">
        <PriceOption
          highlighted
          label="Monthly subscription"
          price="$9.99/mo"
          subtext={isReturning ? "Every analysis opens automatically — no paywall" : "Unlimited analyses + relationship insights"}
          buttonLabel="Subscribe monthly"
          loading={pending === "BTLN_monthly"}
          onClick={() => launch("BTLN_monthly")}
        />
        <PriceOption
          label="Annual subscription"
          price="$49.99/yr"
          subtext="Just $4.17/mo — save 58%"
          buttonLabel="Subscribe annually"
          loading={pending === "BTLN_annual"}
          onClick={() => launch("BTLN_annual")}
        />
        <PriceOption
          deemphasized
          label={isReturning ? "Unlock just this one" : "Just this report"}
          price="$4.99 one-time"
          subtext="Unlock only this analysis"
          buttonLabel={isReturning ? "Unlock just this one" : "Unlock this report"}
          loading={pending === "BTLN_report_unlock"}
          onClick={() => launch("BTLN_report_unlock")}
        />
      </div>

      <p className="mt-5 text-[12px] text-muted-foreground">
        Secure checkout via Stripe. Cancel anytime.
      </p>
    </div>
  );
}

function PriceOption({
  label,
  price,
  subtext,
  buttonLabel,
  onClick,
  loading,
  highlighted,
  deemphasized,
}: {
  label: string;
  price: string;
  subtext: string;
  buttonLabel: string;
  onClick: () => void;
  loading: boolean;
  highlighted?: boolean;
  deemphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
        highlighted
          ? "border-foreground/30 bg-muted/30"
          : deemphasized
            ? "border-border bg-card opacity-90 hover:opacity-100 hover:border-foreground/20"
            : "border-border bg-card hover:border-foreground/20"
      }`}
    >
      <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[22px] font-medium tracking-tight">{price}</div>
      <div className="text-[12px] text-muted-foreground">{subtext}</div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`mt-3 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-medium transition-all duration-200 hover:scale-[1.03] disabled:opacity-50 border border-border bg-card text-foreground hover:bg-foreground hover:text-background hover:shadow-lg`}
      >
        {loading ? "Opening checkout…" : buttonLabel}
      </button>
    </div>
  );
}