export const QUICK_TAKE_MONTHLY_CENTS = 699;
export const SINGLE_QUICK_TAKE_CENTS = 499;

export function entitlementsForTier(tier: string): string[] {
  if (tier === "decode_monthly") return ["quick_take", "interactive_mode"];
  if (tier === "monthly" || tier === "annual") return ["quick_take", "full_reports"];
  if (tier === "interactive_addon") return ["interactive_mode"];
  if (tier === "prime") return ["prime", "quick_take", "interactive_mode", "full_reports", "relationship360"];
  return [];
}

export function activeSubscription(row: { status?: string | null; current_period_end?: string | null }, now = Date.now()): boolean {
  return ["active", "trialing", "past_due"].includes(row.status ?? "") &&
    (!row.current_period_end || (Number.isFinite(Date.parse(row.current_period_end)) && Date.parse(row.current_period_end) > now));
}

export function includesInteractive(tiers: string[], entitlements: string[] = []): boolean {
  return tiers.includes("prime") || entitlements.includes("prime") || tiers.includes("decode_monthly") ||
    ((tiers.includes("interactive_addon") || entitlements.includes("interactive_mode")) &&
      (tiers.includes("decode_monthly") || entitlements.includes("quick_take")));
}

export function validSingleQuickTakePayment(session: {
  mode?: string; payment_status?: string; amount_total?: number | null; currency?: string | null;
  metadata?: Record<string, string> | null;
}): boolean {
  return session.mode === "payment" && session.payment_status === "paid" &&
    session.amount_total === SINGLE_QUICK_TAKE_CENTS && session.currency === "usd" &&
    session.metadata?.reportKind === "quick_take" && session.metadata?.productKey === "BTLN_report_unlock" &&
    Boolean(session.metadata?.userId && session.metadata?.decodeId);
}