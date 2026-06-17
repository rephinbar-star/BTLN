import { useEffect, useRef } from "react";

/**
 * Scrolls the paywall section (id="paywall-section") into view when the
 * user arrives on a locked report from the sign-in/unlock flow.
 *
 * Triggers when ALL of:
 *   - `intent === "unlock"` (typically from `?intent=unlock` in the URL)
 *   - entitlement has finished loading (`entitlementLoading === false`)
 *   - the report is still locked (`hasUnlockedReport === false`)
 *
 * Runs at most once per mount.
 *
 * Exported separately so it can be unit-tested without rendering the
 * full Report page.
 */
export function usePaywallScroll(params: {
  intent: string | null;
  entitlementLoading: boolean;
  hasUnlockedReport: boolean;
  elementId?: string;
}) {
  const { intent, entitlementLoading, hasUnlockedReport, elementId = "paywall-section" } = params;
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (scrolledRef.current) return;
    if (intent !== "unlock") return;
    if (entitlementLoading) return;
    if (hasUnlockedReport) return;
    const el = typeof document !== "undefined" ? document.getElementById(elementId) : null;
    if (!el) return;
    scrolledRef.current = true;
    const run = () => el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    } else {
      run();
    }
  }, [intent, entitlementLoading, hasUnlockedReport, elementId]);
}