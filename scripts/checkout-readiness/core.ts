// Read-only checkout configuration readiness checker.
// Pure functions: no network, no environment reads, no provider calls.

export type Status = "PASS" | "FAIL" | "UNKNOWN";

export interface SanitizedPrice {
  lookup_key: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  type: "recurring" | "one_time" | string;
  interval: string | null;
  interval_count: number | null;
}

export interface SanitizedCatalog {
  source: string;
  mode: "test" | "live" | "mixed" | "unknown";
  fetched_at: string;
  prices: SanitizedPrice[];
}

export const REQUIRED = [
  { lookup_key: "BTLN_decode_monthly", unit_amount: 699, type: "recurring", interval: "month" },
  { lookup_key: "BTLN_monthly", unit_amount: 999, type: "recurring", interval: "month" },
  { lookup_key: "BTLN_annual", unit_amount: 4999, type: "recurring", interval: "year" },
  { lookup_key: "BTLN_report_unlock", unit_amount: 499, type: "one_time", interval: null },
] as const;
export const LEGACY_ALIASES = ["duo_annual", "duo_monthly", "decode_monthly"] as const;
export const INTENTIONALLY_UNAVAILABLE = ["Prime", "Interactive Mode"] as const;
export const MAX_CATALOG_AGE_MS = 60 * 60 * 1000;

/** Extract APPROVED_LOOKUP_KEYS from the actual create-checkout source. */
export function extractAllowedLookupKeys(source: string): string[] | null {
  const m = source.match(/const\s+APPROVED_LOOKUP_KEYS\s*=\s*new\s+Set\(\s*\[([^\]]*)\]\s*\)/);
  if (!m) return null;
  const keys = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  return keys.length ? keys : null;
}

/** Keep only non-sensitive fields; drop ids, product ids, metadata, everything else. */
export function sanitizeCatalog(raw: unknown, fetchedAt: string, source: string): SanitizedCatalog {
  const data = (raw as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) throw new Error("Catalog input is not a price list");
  const prices: SanitizedPrice[] = data.map((p: any) => ({
    lookup_key: String(p?.lookup_key ?? ""),
    active: p?.active === true,
    livemode: p?.livemode === true,
    currency: String(p?.currency ?? ""),
    unit_amount: typeof p?.unit_amount === "number" ? p.unit_amount : null,
    type: String(p?.type ?? ""),
    interval: p?.recurring?.interval ?? null,
    interval_count: p?.recurring?.interval_count ?? null,
  }));
  const modes = new Set(prices.map((p) => (p.livemode ? "live" : "test")));
  const mode = modes.size === 0 ? "unknown" : modes.size > 1 ? "mixed" : ([...modes][0] as "test" | "live");
  return { source, mode, fetched_at: fetchedAt, prices };
}

export interface Check { id: string; status: Status; detail: string }
export interface Report {
  checked_at: string;
  source_revision: string;
  catalog: { source: string; mode: string; fetched_at: string | null; age_seconds: number | null; fresh: Status };
  allowed_lookup_keys: string[] | null;
  checks: Check[];
  warnings: string[];
  intentionally_unavailable: string[];
  server_key_mode: "UNKNOWN";
  overall: "READY" | "NOT_READY" | "UNKNOWN";
  limitation: string;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function evaluate(args: {
  checkoutSource: string;
  catalog: SanitizedCatalog | null;
  now: Date;
  sourceRevision: string;
}): Report {
  const { checkoutSource, catalog, now, sourceRevision } = args;
  const checks: Check[] = [];
  const warnings: string[] = [];
  const allowed = extractAllowedLookupKeys(checkoutSource);
  checks.push(allowed
    ? { id: "whitelist_parsed", status: "PASS", detail: `${allowed.length} keys read from create-checkout` }
    : { id: "whitelist_parsed", status: "FAIL", detail: "APPROVED_LOOKUP_KEYS not found in create-checkout source" });

  let ageSec: number | null = null;
  let fresh: Status = "UNKNOWN";
  if (catalog) {
    const t = Date.parse(catalog.fetched_at);
    if (Number.isFinite(t)) {
      ageSec = Math.round((now.getTime() - t) / 1000);
      fresh = ageSec >= 0 && ageSec * 1000 <= MAX_CATALOG_AGE_MS ? "PASS" : "FAIL";
    }
  }
  checks.push({ id: "catalog_fresh", status: fresh,
    detail: !catalog ? "No catalog supplied" : fresh === "PASS" ? `${ageSec}s old` : fresh === "FAIL" ? `Catalog is ${ageSec}s old (max ${MAX_CATALOG_AGE_MS / 1000}s) or future-dated` : "fetched_at missing or invalid" });

  const usable = catalog && fresh === "PASS";
  if (catalog) {
    checks.push({ id: "catalog_test_mode", status: catalog.mode === "test" ? "PASS" : catalog.mode === "unknown" ? "UNKNOWN" : "FAIL",
      detail: `Catalog mode: ${catalog.mode}` });
  }

  for (const req of REQUIRED) {
    const id = `required:${req.lookup_key}`;
    if (allowed && !allowed.includes(req.lookup_key)) {
      checks.push({ id, status: "FAIL", detail: "Not in checkout whitelist" });
      continue;
    }
    if (!usable) { checks.push({ id, status: "UNKNOWN", detail: "No fresh catalog" }); continue; }
    const matches = catalog!.prices.filter((p) => p.lookup_key === req.lookup_key && p.active);
    if (matches.length === 0) { checks.push({ id, status: "FAIL", detail: "No active price" }); continue; }
    if (matches.length > 1) { checks.push({ id, status: "FAIL", detail: `${matches.length} active prices (ambiguous)` }); continue; }
    const p = matches[0];
    const problems: string[] = [];
    if (p.livemode) problems.push("live-mode price");
    if (p.currency !== "usd") problems.push(`currency ${p.currency}`);
    if (p.unit_amount !== req.unit_amount) problems.push(`amount ${p.unit_amount == null ? "none" : money(p.unit_amount)} ≠ ${money(req.unit_amount)}`);
    if (p.type !== req.type) problems.push(`type ${p.type} ≠ ${req.type}`);
    if (req.interval && (p.interval !== req.interval || p.interval_count !== 1)) problems.push(`recurrence ${p.interval_count}/${p.interval} ≠ 1/${req.interval}`);
    const label = `${money(req.unit_amount)}${req.interval ? `/${req.interval}` : " once"}`;
    checks.push(problems.length ? { id, status: "FAIL", detail: problems.join("; ") } : { id, status: "PASS", detail: label });
  }

  for (const alias of LEGACY_ALIASES) {
    if (allowed && !allowed.includes(alias)) continue;
    if (!usable) { warnings.push(`Legacy alias ${alias}: unknown (no fresh catalog)`); continue; }
    const n = catalog!.prices.filter((p) => p.lookup_key === alias && p.active).length;
    if (n === 0) warnings.push(`Legacy alias ${alias}: whitelisted but no active test price (optional)`);
    else if (n > 1) warnings.push(`Legacy alias ${alias}: ${n} active prices (ambiguous)`);
  }
  if (allowed) {
    const known = new Set<string>([...REQUIRED.map((r) => r.lookup_key), ...LEGACY_ALIASES]);
    for (const k of allowed) if (!known.has(k)) warnings.push(`Whitelist contains unclassified key ${k}`);
  }

  checks.push({ id: "server_key_mode", status: "UNKNOWN",
    detail: "Server uses STRIPE_SECRET_KEY regardless of requested environment; not observed. Frontend publishable key and test catalog do not prove server mode." });

  const statuses = checks.map((c) => c.status);
  const overall = statuses.includes("FAIL") ? "NOT_READY" : statuses.includes("UNKNOWN") ? "UNKNOWN" : "READY";
  return {
    checked_at: now.toISOString(),
    source_revision: sourceRevision,
    catalog: { source: catalog?.source ?? "none", mode: catalog?.mode ?? "unknown", fetched_at: catalog?.fetched_at ?? null, age_seconds: ageSec, fresh },
    allowed_lookup_keys: allowed,
    checks,
    warnings,
    intentionally_unavailable: [...INTENTIONALLY_UNAVAILABLE],
    server_key_mode: "UNKNOWN",
    overall,
    limitation: "Configuration readiness only. Not a checkout-to-webhook fulfilment test.",
  };
}

export function formatReport(r: Report): string {
  const lines = [
    `Checkout readiness: ${r.overall}`,
    `checked_at ${r.checked_at} · revision ${r.source_revision}`,
    `catalog ${r.catalog.source} · mode ${r.catalog.mode} · fetched ${r.catalog.fetched_at ?? "n/a"} · fresh ${r.catalog.fresh}`,
    `allowed keys: ${r.allowed_lookup_keys?.join(", ") ?? "UNPARSED"}`,
    ...r.checks.map((c) => `  [${c.status}] ${c.id} — ${c.detail}`),
    ...r.warnings.map((w) => `  [WARN] ${w}`),
    `  [INFO] Not purchasable by design: ${r.intentionally_unavailable.join(", ")}`,
    r.limitation,
  ];
  return lines.join("\n");
}
