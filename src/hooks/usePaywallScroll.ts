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
    // Late-loading content (deep report sections, images) can grow the
    // document above the paywall after the initial scroll, leaving the
    // billing card out of the viewport — particularly on small mobile
    // viewports. Re-scroll a few times over the next ~1s so the anchor
    // settles correctly regardless of when content finishes rendering.
    const run = () => el.scrollIntoView({ behavior: "smooth", block: "start" });
    const schedule = (delay: number) =>
      typeof window !== "undefined" ? window.setTimeout(run, delay) : 0;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    } else {
      run();
    }
    const t1 = schedule(150);
    const t2 = schedule(450);
    const t3 = schedule(1000);
    return () => {
      if (typeof window === "undefined") return;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [intent, entitlementLoading, hasUnlockedReport, elementId]);
}