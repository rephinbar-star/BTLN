import { describe, expect, it } from "vitest";
import { activeSubscription, entitlementsForTier, includesInteractive, QUICK_TAKE_MONTHLY_CENTS, SINGLE_QUICK_TAKE_CENTS, validSingleQuickTakePayment } from "../../supabase/functions/_shared/quickTakePurchases";

describe("Quick Take purchase rules", () => {
  it("keeps the monthly bundle at $6.99 with Interactive Mode included", () => {
    expect(QUICK_TAKE_MONTHLY_CENTS).toBe(699);
    expect(entitlementsForTier("decode_monthly")).toEqual(["quick_take", "interactive_mode"]);
    expect(includesInteractive(["decode_monthly"])).toBe(true);
  });
  it("accepts only a paid $4.99 USD single session with an owned target and approved product metadata", () => {
    expect(SINGLE_QUICK_TAKE_CENTS).toBe(499);
    const session = { mode: "payment", payment_status: "paid", amount_total: 499, currency: "usd", metadata: { reportKind: "quick_take", productKey: "BTLN_report_unlock", userId: "owner", decodeId: "target" } };
    expect(validSingleQuickTakePayment(session)).toBe(true);
    for (const change of [{ payment_status: "unpaid" }, { amount_total: 699 }, { currency: "eur" }, { mode: "subscription" }, { metadata: { ...session.metadata, decodeId: "" } }, { metadata: { ...session.metadata, productKey: "other" } }]) {
      expect(validSingleQuickTakePayment({ ...session, ...change })).toBe(false);
    }
  });
  it("does not grant Interactive Mode for a single report or standalone orphan add-on", () => {
    expect(includesInteractive(["one_time"])).toBe(false);
    expect(includesInteractive(["interactive_addon"])).toBe(false);
    expect(includesInteractive(["monthly"])).toBe(false);
    expect(includesInteractive(["interactive_addon"], ["quick_take"])).toBe(true);
  });
  it("removes expired and cancelled plan access but respects active paid-through periods", () => {
    const now = Date.parse("2026-10-20T00:00:00Z");
    expect(activeSubscription({ status: "active", current_period_end: "2026-10-21T00:00:00Z" }, now)).toBe(true);
    expect(activeSubscription({ status: "active", current_period_end: "2026-10-19T00:00:00Z" }, now)).toBe(false);
    expect(activeSubscription({ status: "canceled" }, now)).toBe(false);
    expect(activeSubscription({ status: "active", current_period_end: "invalid" }, now)).toBe(false);
  });
});