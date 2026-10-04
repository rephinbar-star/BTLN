import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluate, extractAllowedLookupKeys, sanitizeCatalog, type SanitizedPrice } from "../../scripts/checkout-readiness/core";

const src = readFileSync("supabase/functions/create-checkout/index.ts", "utf8");
const now = new Date("2026-10-04T00:30:00Z");
const p = (k: string, amt: number, interval: string | null, extra: Partial<SanitizedPrice> = {}): SanitizedPrice => ({
  lookup_key: k, active: true, livemode: false, currency: "usd", unit_amount: amt,
  type: interval ? "recurring" : "one_time", interval, interval_count: interval ? 1 : null, ...extra,
});
const good = [p("BTLN_decode_monthly", 699, "month"), p("BTLN_monthly", 999, "month"), p("BTLN_annual", 4999, "year"), p("BTLN_report_unlock", 499, null)];
const cat = (prices: SanitizedPrice[], fetched = "2026-10-04T00:20:00Z") => ({ source: "t", mode: "test" as const, fetched_at: fetched, prices });
const run = (prices = good, fetched?: string) => evaluate({ checkoutSource: src, catalog: cat(prices, fetched), now, sourceRevision: "x" });
const st = (r: ReturnType<typeof run>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("checkout readiness", () => {
  it("parses the actual whitelist", () => {
    expect(extractAllowedLookupKeys(src)).toEqual(["BTLN_annual", "duo_annual", "BTLN_monthly", "duo_monthly", "BTLN_decode_monthly", "decode_monthly", "BTLN_report_unlock"]);
  });
  it("detects drift when a required key leaves the whitelist", () => {
    const drifted = src.replace(/"BTLN_monthly", /, "");
    const r = evaluate({ checkoutSource: drifted, catalog: cat(good), now, sourceRevision: "x" });
    expect(st(r, "required:BTLN_monthly")).toBe("FAIL");
    expect(evaluate({ checkoutSource: "nothing", catalog: null, now, sourceRevision: "x" }).checks[0].status).toBe("FAIL");
  });
  it("all required pass but overall stays UNKNOWN while server mode is unknown", () => {
    const r = run();
    expect(r.checks.filter((c) => c.id.startsWith("required:")).every((c) => c.status === "PASS")).toBe(true);
    expect(r.server_key_mode).toBe("UNKNOWN");
    expect(r.overall).toBe("UNKNOWN");
    expect(r.warnings.filter((w) => w.includes("Legacy alias"))).toHaveLength(3);
  });
  it("fails missing, wrong amount, wrong recurrence, live and duplicate prices", () => {
    expect(st(run(good.slice(1)), "required:BTLN_decode_monthly")).toBe("FAIL");
    expect(st(run([p("BTLN_decode_monthly", 599, "month"), ...good.slice(1)]), "required:BTLN_decode_monthly")).toBe("FAIL");
    expect(st(run([p("BTLN_annual", 4999, "month"), ...good.filter((x) => x.lookup_key !== "BTLN_annual")]), "required:BTLN_annual")).toBe("FAIL");
    const live = run([p("BTLN_monthly", 999, "month", { livemode: true }), ...good.filter((x) => x.lookup_key !== "BTLN_monthly")]);
    expect(st(live, "required:BTLN_monthly")).toBe("FAIL");
    const dup = run([...good, p("BTLN_report_unlock", 499, null)]);
    expect(st(dup, "required:BTLN_report_unlock")).toBe("FAIL");
    expect(dup.overall).toBe("NOT_READY");
  });
  it("missing legacy aliases only warn", () => {
    const r = run();
    expect(r.checks.some((c) => c.id.includes("duo_") || c.id.includes(":decode_monthly"))).toBe(false);
    expect(r.overall).not.toBe("NOT_READY");
  });
  it("stale or missing catalog never yields price success", () => {
    const stale = run(good, "2026-10-03T00:00:00Z");
    expect(st(stale, "catalog_fresh")).toBe("FAIL");
    expect(st(stale, "required:BTLN_monthly")).toBe("UNKNOWN");
    const none = evaluate({ checkoutSource: src, catalog: null, now, sourceRevision: "x" });
    expect(none.overall).toBe("UNKNOWN");
    expect(none.checks.filter((c) => c.status === "PASS").map((c) => c.id)).toEqual(["whitelist_parsed"]);
  });
  it("sanitized output drops ids, products and metadata", () => {
    const raw = { data: [{ id: "price_SECRETISH", product: "prod_X", metadata: { a: 1 }, lookup_key: "BTLN_monthly", active: true, livemode: false, currency: "usd", unit_amount: 999, type: "recurring", recurring: { interval: "month", interval_count: 1 } }] };
    const s = sanitizeCatalog(raw, "2026-10-04T00:20:00Z", "t");
    const text = JSON.stringify(evaluate({ checkoutSource: src, catalog: s, now, sourceRevision: "x" })) + JSON.stringify(s);
    expect(text).not.toMatch(/price_|prod_|metadata|sk_|pk_/);
  });
});
