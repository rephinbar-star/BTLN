import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePaywallScroll } from "./usePaywallScroll";

/**
 * E2E-style verification of the post-sign-in scroll behavior:
 *
 *   User clicks "Unlock the report" → signs in → returns to
 *   /report/:id?intent=unlock. The Report page must scroll the billing
 *   section to the top (so the unlock card is the first thing the user
 *   sees) for locked reports, and must NOT scroll for unlocked reports.
 */

describe("usePaywallScroll (post-sign-in billing scroll)", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    const el = document.createElement("div");
    el.id = "paywall-section";
    (el as unknown as { scrollIntoView: typeof scrollIntoView }).scrollIntoView = scrollIntoView;
    document.body.appendChild(el);
    rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0 as unknown as number;
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    rafSpy.mockRestore();
  });

  it("locked report: scrolls billing section to top after intent=unlock and entitlement resolves", () => {
    const { rerender } = renderHook(
      ({ loading, unlocked }: { loading: boolean; unlocked: boolean }) =>
        usePaywallScroll({
          intent: "unlock",
          entitlementLoading: loading,
          hasUnlockedReport: unlocked,
        }),
      { initialProps: { loading: true, unlocked: false } },
    );

    // While entitlement is loading, we don't scroll yet.
    expect(scrollIntoView).not.toHaveBeenCalled();

    // Entitlement finishes loading, still locked → scrolls.
    rerender({ loading: false, unlocked: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("unlocked report: does NOT auto-scroll even when intent=unlock is present", () => {
    renderHook(() =>
      usePaywallScroll({
        intent: "unlock",
        entitlementLoading: false,
        hasUnlockedReport: true,
      }),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("no intent: does not scroll on a normal locked report visit", () => {
    renderHook(() =>
      usePaywallScroll({
        intent: null,
        entitlementLoading: false,
        hasUnlockedReport: false,
      }),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("only scrolls once per mount, even if entitlement re-resolves", () => {
    const { rerender } = renderHook(
      ({ loading }: { loading: boolean }) =>
        usePaywallScroll({
          intent: "unlock",
          entitlementLoading: loading,
          hasUnlockedReport: false,
        }),
      { initialProps: { loading: true } },
    );
    rerender({ loading: false });
    rerender({ loading: true });
    rerender({ loading: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the paywall element is missing from the DOM", () => {
    document.body.innerHTML = "";
    renderHook(() =>
      usePaywallScroll({
        intent: "unlock",
        entitlementLoading: false,
        hasUnlockedReport: false,
      }),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});