import { useEffect, useState } from "react";
import { getConsent, isConsentRequired, setConsent } from "@/lib/consent";
import { grantAnalyticsConsent, denyAnalyticsConsent } from "@/lib/analytics";

// EU-only opt-in banner. Default action is the privacy-preserving one:
// "Decline" is the visually primary choice equal in weight to "Accept",
// and we never set consent without an explicit click.
export const ConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isConsentRequired()) return;
    if (getConsent() !== "unset") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    setConsent("granted");
    grantAnalyticsConsent();
    setVisible(false);
  };
  const decline = () => {
    setConsent("denied");
    denyAnalyticsConsent();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-lg">
        <p className="text-[14px] leading-relaxed text-foreground">
          We use privacy-first product analytics (PostHog) to understand how the app is used —
          screen visits and a small set of named events. We never send your conversation,
          names, emails, feedback text, or report content.{" "}
          <a href="/privacy" className="underline underline-offset-2">Learn more</a>.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={decline}
            className="rounded-full border border-border px-5 py-2.5 text-[14px] font-medium text-foreground hover:bg-muted"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background hover:opacity-90"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
};