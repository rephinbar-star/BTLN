import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CATALOG_SOURCE, evaluate, extractAllowedLookupKeys, sanitizeCatalog, validateSanitizedCatalog, type SanitizedPrice,
} from "../../scripts/checkout-readiness/core";

const src = readFileSync("supabase/functions/create-checkout/index.ts", "utf8");
const now = new Date("2026-10-04T00:30:00Z");
const p = (k: string, amt: number, interval: SanitizedPrice["interval"], extra: Partial<SanitizedPrice> = {}): SanitizedPrice => ({
  lookup_key: k, active: true, livemode: false, currency: "usd", unit_amount: amt,
  type: interval ? "recurring" : "one_time", interval, interval_count: interval ? 1 : null, ...extra,
});
const good = [p("BTLN_decode_monthly", 699, "month"), p("BTLN_monthly", 999, "month"), p("BTLN_annual", 4999, "year"), p("BTLN_report_unlock", 499, null)];
const cat = (prices: SanitizedPrice[], fetched = "2026-10-04T00:20:00Z", extra = {}) =>
  ({ source: CATALOG_SOURCE, mode: "test" as const, fetched_at: fetched, complete: true, invalid_entries: 0, prices, ...extra });
const run = (prices = good, fetched?: string, extra = {}) => evaluate({ checkoutSource: src, catalog: cat(prices, fetched, extra), now, sourceRevision: "abcdef1" });
const st = (r: ReturnType<typeof run>, id: string) => r.checks.find((c) => c.id === id)?.status;
const rawPrice = (o: Record<string, unknown> = {}) => ({ id: "price_X", product: "prod_X", metadata: { a: 1 }, lookup_key: "BTLN_monthly", active: true, livemode: false, currency: "usd", unit_amount: 999, type: "recurring", recurring: { interval: "month", interval_count: 1 }, ...o });

describe("checkout readiness", () => {
  it("parses the actual whitelist", () => {
    expect(extractAllowedLookupKeys(src)).toEqual(["BTLN_annual", "duo_annual", "BTLN_monthly", "duo_monthly", "BTLN_decode_monthly", "decode_monthly", "BTLN_report_unlock"]);
  });
  it("detects drift when a required key leaves the whitelist", () => {
    const r = evaluate({ checkoutSource: src.replace(/"BTLN_monthly", /, ""), catalog: cat(good), now, sourceRevision: "x" });
    expect(st(r, "required:BTLN_monthly")).toBe("FAIL");
    expect(evaluate({ checkoutSource: "nothing", catalog: null, now, sourceRevision: "x" }).checks[0].status).toBe("FAIL");
  });
  it("all required pass but overall stays UNKNOWN while server mode is unknown", () => {
    const r = run();
    expect(r.checks.filter((c) => c.id.startsWith("required:")).every((c) => c.status === "PASS")).toBe(true);
    expect(r.overall).toBe("UNKNOWN");
    expect(r.warnings.filter((w) => w.includes("no active test price"))).toHaveLength(3);
  });
  it("fails missing, wrong amount, wrong recurrence, live, duplicate and recurring one-time prices", () => {
    expect(st(run(good.slice(1)), "required:BTLN_decode_monthly")).toBe("FAIL");
    expect(st(run([p("BTLN_decode_monthly", 599, "month"), ...good.slice(1)]), "required:BTLN_decode_monthly")).toBe("FAIL");
    expect(st(run([p("BTLN_annual", 4999, "month"), ...good.filter((x) => x.lookup_key !== "BTLN_annual")]), "required:BTLN_annual")).toBe("FAIL");
    expect(st(run([p("BTLN_monthly", 999, "month", { livemode: true }), ...good.filter((x) => x.lookup_key !== "BTLN_monthly")]), "required:BTLN_monthly")).toBe("FAIL");
    const dup = run([...good, p("BTLN_report_unlock", 499, null)]);
    expect(st(dup, "required:BTLN_report_unlock")).toBe("FAIL");
    expect(dup.overall).toBe("NOT_READY");
    expect(st(run([...good.slice(0, 3), p("BTLN_report_unlock", 499, "month", { type: "recurring" })]), "required:BTLN_report_unlock")).toBe("FAIL");
  });
  it("missing legacy aliases only warn", () => {
    const r = run();
    expect(r.checks.some((c) => c.id.includes("duo_") || c.id.includes(":decode_monthly"))).toBe(false);
    expect(r.overall).not.toBe("NOT_READY");
  });
  it("missing livemode is not treated as test data", () => {
    const { livemode: _omit, ...noMode } = rawPrice();
    const s = sanitizeCatalog({ data: [noMode], has_more: false }, "2026-10-04T00:20:00Z");
    expect(s.mode).toBe("unknown");
    expect(s.invalid_entries).toBe(1);
    const r = evaluate({ checkoutSource: src, catalog: s, now, sourceRevision: "x" });
    expect(st(r, "catalog_test_mode")).toBe("UNKNOWN");
    expect(st(r, "required:BTLN_monthly")).toBe("UNKNOWN");
    expect(r.checks.some((c) => c.id.startsWith("required:") && c.status === "PASS")).toBe(false);
  });
  it("one-time raw price must have recurring explicitly null", () => {
    const s = sanitizeCatalog({ data: [rawPrice({ lookup_key: "BTLN_report_unlock", type: "one_time", unit_amount: 499 })], has_more: false }, "2026-10-04T00:20:00Z");
    expect(s.invalid_entries).toBe(1);
  });
  it("incomplete list never asserts absence", () => {
    const s = sanitizeCatalog({ data: [rawPrice()], has_more: true }, "2026-10-04T00:20:00Z");
    expect(s.complete).toBe(false);
    const r = evaluate({ checkoutSource: src, catalog: s, now, sourceRevision: "x" });
    expect(st(r, "catalog_complete")).toBe("UNKNOWN");
    expect(st(r, "required:BTLN_decode_monthly")).toBe("UNKNOWN");
    expect(r.overall).toBe("UNKNOWN");
    expect(sanitizeCatalog({ data: [] }, "2026-10-04T00:20:00Z").complete).toBe(false);
  });
  it("stale capture timestamp or missing catalog never yields price success", () => {
    const stale = run(good, "2026-10-03T00:00:00Z");
    expect(st(stale, "catalog_fresh")).toBe("FAIL");
    expect(st(stale, "required:BTLN_monthly")).toBe("UNKNOWN");
    expect(() => sanitizeCatalog({ data: [], has_more: false }, "yesterday")).toThrow(/captured at read time/);
    const none = evaluate({ checkoutSource: src, catalog: null, now, sourceRevision: "x" });
    expect(none.overall).toBe("UNKNOWN");
    expect(none.checks.filter((c) => c.status === "PASS").map((c) => c.id)).toEqual(["whitelist_parsed"]);
  });
  it("malformed sanitized input is rejected with a fixed reason and no echo", () => {
    const bad: unknown[] = [
      null, [], "x",
      { ...cat(good), prices: "nope" },
      { ...cat(good), fetched_at: "2026-10-04" },
      { ...cat(good), complete: undefined },
      { ...cat(good), mode: "<script>" },
      { ...cat(good), prices: [{ ...good[0], livemode: "false" }] },
      { ...cat(good), prices: [{ ...good[0], lookup_key: "sk_live_LEAKY value" }] },
      { ...cat(good), source: "evil" },
    ];
    for (const b of bad) {
      const v = validateSanitizedCatalog(b);
      expect(v.ok).toBe(false);
      if (v.ok === false) {
        const r = evaluate({ checkoutSource: src, catalog: null, catalogError: v.reason, now, sourceRevision: "x" });
        expect(r.overall).toBe("UNKNOWN");
        expect(JSON.stringify(r)).not.toMatch(/script|LEAKY|evil|nope/);
      }
    }
    // supplied mode label is recomputed, never trusted
    const relabeled = validateSanitizedCatalog({ ...cat([p("BTLN_monthly", 999, "month", { livemode: true })]), mode: "test" });
    expect(relabeled.ok && relabeled.catalog.mode).toBe("live");
  });
  it("sanitized output drops ids, products and metadata", () => {
    const s = sanitizeCatalog({ data: [rawPrice()], has_more: false }, "2026-10-04T00:20:00Z");
    const text = JSON.stringify(evaluate({ checkoutSource: src, catalog: s, now, sourceRevision: "x" })) + JSON.stringify(s);
    expect(text).not.toMatch(/price_|prod_|metadata|sk_|pk_/);
  });
});
