// Read-only checkout configuration readiness checker.
// Pure functions: no network, no environment reads, no provider calls.

export type Status = "PASS" | "FAIL" | "UNKNOWN";

export interface SanitizedPrice {
  lookup_key: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  type: "recurring" | "one_time";
  interval: "day" | "week" | "month" | "year" | null;
  interval_count: number | null;
}

export interface SanitizedCatalog {
  source: string;
  mode: "test" | "live" | "mixed" | "unknown";
  /** Time the provider catalog was READ, captured at read time — never at sanitize time. */
  fetched_at: string;
  /** true only when the provider list explicitly reported has_more === false. */
  complete: boolean;
  /** Raw entries rejected for missing/invalid fields (e.g. no explicit boolean livemode). */
  invalid_entries: number;
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
export const CATALOG_SOURCE = "stripe GET /v1/prices (operator payments tool)";

const KEY_RE = /^[A-Za-z0-9_]{1,64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const INTERVALS = new Set(["day", "week", "month", "year"]);
const MODES = new Set(["test", "live", "mixed", "unknown"]);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && ISO_RE.test(v) && Number.isFinite(Date.parse(v));

/** Extract APPROVED_LOOKUP_KEYS from the actual create-checkout source. */
export function extractAllowedLookupKeys(source: string): string[] | null {
  const m = source.match(/const\s+APPROVED_LOOKUP_KEYS\s*=\s*new\s+Set\(\s*\[([^\]]*)\]\s*\)/);
  if (!m) return null;
  const keys = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  return keys.length && keys.every((k) => KEY_RE.test(k)) ? keys : null;
}

/** Validate a single price shape; returns null when anything required is missing or inconsistent. */
function validPrice(p: unknown): SanitizedPrice | null {
  if (!isObj(p)) return null;
  const { lookup_key, active, livemode, currency, unit_amount, type } = p;
  if (typeof lookup_key !== "string" || !KEY_RE.test(lookup_key)) return null;
  if (typeof active !== "boolean" || typeof livemode !== "boolean") return null;
  if (typeof currency !== "string" || !/^[a-z]{3}$/.test(currency)) return null;
  if (!(unit_amount === null || (Number.isInteger(unit_amount) && (unit_amount as number) >= 0))) return null;
  // Raw provider shape uses `recurring`; sanitized shape uses interval/interval_count.
  let interval: unknown; let count: unknown;
  if ("recurring" in p) {
    const r = p.recurring;
    if (r === null) { interval = null; count = null; }
    else if (isObj(r)) { interval = r.interval; count = r.interval_count; }
    else return null;
  } else { interval = p.interval; count = p.interval_count; }
  if (type === "one_time") {
    if (interval !== null || count !== null) return null;
  } else if (type === "recurring") {
    if (typeof interval !== "string" || !INTERVALS.has(interval) || !Number.isInteger(count) || (count as number) < 1) return null;
  } else return null;
  return { lookup_key, active, livemode, currency, unit_amount: unit_amount as number | null, type, interval: interval as SanitizedPrice["interval"], interval_count: count as number | null };
}

function modeOf(prices: SanitizedPrice[], invalid: number): SanitizedCatalog["mode"] {
  if (invalid > 0 || prices.length === 0) return "unknown";
  const modes = new Set(prices.map((p) => (p.livemode ? "live" : "test")));
  return modes.size > 1 ? "mixed" : ([...modes][0] as "test" | "live");
}

/**
 * Keep only non-sensitive fields; drop ids, product ids, metadata, everything else.
 * `fetchedAt` must be the time the catalog was read from the provider.
 */
export function sanitizeCatalog(raw: unknown, fetchedAt: string, source = CATALOG_SOURCE): SanitizedCatalog {
  if (!isIso(fetchedAt)) throw new Error("fetched_at must be an ISO-8601 UTC timestamp captured at read time");
  if (!isObj(raw) || !Array.isArray(raw.data)) throw new Error("Catalog input is not a price list");
  const prices: SanitizedPrice[] = [];
  let invalid = 0;
  for (const p of raw.data) { const v = validPrice(p); if (v) prices.push(v); else invalid++; }
  return { source, mode: modeOf(prices, invalid), fetched_at: fetchedAt, complete: raw.has_more === false, invalid_entries: invalid, prices };
}

/** Runtime validation of an already-sanitized catalog file. Reasons are fixed strings (no input echo). */
export function validateSanitizedCatalog(input: unknown): { ok: true; catalog: SanitizedCatalog } | { ok: false; reason: string } {
  if (!isObj(input)) return { ok: false, reason: "catalog is not an object" };
  if (input.source !== CATALOG_SOURCE) return { ok: false, reason: "catalog source is missing or unrecognised" };
  if (typeof input.mode !== "string" || !MODES.has(input.mode)) return { ok: false, reason: "catalog mode is invalid" };
  if (!isIso(input.fetched_at)) return { ok: false, reason: "fetched_at is missing or not ISO-8601 UTC" };
  if (typeof input.complete !== "boolean") return { ok: false, reason: "completeness flag is missing" };
  if (!Number.isInteger(input.invalid_entries) || (input.invalid_entries as number) < 0) return { ok: false, reason: "invalid_entries is missing" };
  if (!Array.isArray(input.prices)) return { ok: false, reason: "prices is not an array" };
  const prices: SanitizedPrice[] = [];
  for (const p of input.prices) {
    if (isObj(p) && "recurring" in p) return { ok: false, reason: "price entry is not in sanitized form" };
    const v = validPrice(p);
    if (!v) return { ok: false, reason: "price entry has missing or invalid fields" };
    prices.push(v);
  }
  // Recompute mode from validated entries; never trust a supplied label.
  return { ok: true, catalog: { source: CATALOG_SOURCE, mode: modeOf(prices, input.invalid_entries as number), fetched_at: input.fetched_at, complete: input.complete, invalid_entries: input.invalid_entries as number, prices } };
}

export interface Check { id: string; status: Status; detail: string }
export interface Report {
  checked_at: string;
  source_revision: string;
  catalog: { source: string; mode: string; fetched_at: string | null; age_seconds: number | null; fresh: Status; complete: boolean | null; invalid_entries: number | null; error: string | null };
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
  catalogError?: string;
  now: Date;
  sourceRevision: string;
}): Report {
  const { checkoutSource, catalog, catalogError, now } = args;
  const sourceRevision = /^[0-9a-f]{7,40}$/.test(args.sourceRevision) ? args.sourceRevision : "unknown";
  const checks: Check[] = [];
  const warnings: string[] = [];
  const allowed = extractAllowedLookupKeys(checkoutSource);
  checks.push(allowed
    ? { id: "whitelist_parsed", status: "PASS", detail: `${allowed.length} keys read from create-checkout` }
    : { id: "whitelist_parsed", status: "FAIL", detail: "APPROVED_LOOKUP_KEYS not found in create-checkout source" });

  let ageSec: number | null = null;
  let fresh: Status = "UNKNOWN";
  if (catalog) {
    ageSec = Math.round((now.getTime() - Date.parse(catalog.fetched_at)) / 1000);
    fresh = ageSec >= 0 && ageSec * 1000 <= MAX_CATALOG_AGE_MS ? "PASS" : "FAIL";
  }
  checks.push({ id: "catalog_fresh", status: fresh,
    detail: !catalog ? (catalogError ? `Catalog not usable: ${catalogError}` : "No catalog supplied")
      : fresh === "PASS" ? `${ageSec}s since read` : `Read ${ageSec}s ago (max ${MAX_CATALOG_AGE_MS / 1000}s) or future-dated` });

  if (catalog) {
    checks.push({ id: "catalog_complete", status: catalog.complete ? "PASS" : "UNKNOWN",
      detail: catalog.complete ? "Provider reported no further pages" : "List may be truncated (has_more not false); absences not asserted" });
    checks.push({ id: "catalog_schema", status: catalog.invalid_entries === 0 ? "PASS" : "UNKNOWN",
      detail: catalog.invalid_entries === 0 ? "All entries valid" : `${catalog.invalid_entries} entries missing required fields (e.g. explicit livemode)` });
    checks.push({ id: "catalog_test_mode", status: catalog.mode === "test" ? "PASS" : catalog.mode === "unknown" ? "UNKNOWN" : "FAIL",
      detail: `Catalog mode: ${catalog.mode}` });
  }

  const usable = !!catalog && fresh === "PASS" && catalog.complete && catalog.invalid_entries === 0;
  const why = !catalog ? "No valid catalog" : fresh !== "PASS" ? "Catalog not fresh" : !catalog.complete ? "Catalog incomplete" : "Catalog has invalid entries";

  for (const req of REQUIRED) {
    const id = `required:${req.lookup_key}`;
    if (allowed && !allowed.includes(req.lookup_key)) { checks.push({ id, status: "FAIL", detail: "Not in checkout whitelist" }); continue; }
    if (!usable) { checks.push({ id, status: "UNKNOWN", detail: why }); continue; }
    const matches = catalog!.prices.filter((p) => p.lookup_key === req.lookup_key && p.active);
    if (matches.length === 0) { checks.push({ id, status: "FAIL", detail: "No active price" }); continue; }
    if (matches.length > 1) { checks.push({ id, status: "FAIL", detail: `${matches.length} active prices (ambiguous)` }); continue; }
    const p = matches[0];
    const problems: string[] = [];
    if (p.livemode) problems.push("live-mode price");
    if (p.currency !== "usd") problems.push("currency is not usd");
    if (p.unit_amount !== req.unit_amount) problems.push(`amount ${p.unit_amount == null ? "none" : money(p.unit_amount)} ≠ ${money(req.unit_amount)}`);
    if (p.type !== req.type) problems.push(`type ${p.type} ≠ ${req.type}`);
    if (req.interval) { if (p.interval !== req.interval || p.interval_count !== 1) problems.push(`recurrence ≠ every 1 ${req.interval}`); }
    else if (p.interval !== null || p.interval_count !== null) problems.push("one-time price has recurrence");
    const label = `${money(req.unit_amount)}${req.interval ? `/${req.interval}` : " once"}`;
    checks.push(problems.length ? { id, status: "FAIL", detail: problems.join("; ") } : { id, status: "PASS", detail: label });
  }

  for (const alias of LEGACY_ALIASES) {
    if (allowed && !allowed.includes(alias)) continue;
    if (!usable) { warnings.push(`Legacy alias ${alias}: unknown (${why.toLowerCase()})`); continue; }
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
    catalog: { source: catalog?.source ?? "none", mode: catalog?.mode ?? "unknown", fetched_at: catalog?.fetched_at ?? null, age_seconds: ageSec, fresh,
      complete: catalog?.complete ?? null, invalid_entries: catalog?.invalid_entries ?? null, error: catalog ? null : catalogError ?? null },
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
  return [
    `Checkout readiness: ${r.overall}`,
    `checked_at ${r.checked_at} · revision ${r.source_revision}`,
    `catalog ${r.catalog.source} · mode ${r.catalog.mode} · read ${r.catalog.fetched_at ?? "n/a"} · fresh ${r.catalog.fresh} · complete ${r.catalog.complete ?? "n/a"}`,
    `allowed keys: ${r.allowed_lookup_keys?.join(", ") ?? "UNPARSED"}`,
    ...r.checks.map((c) => `  [${c.status}] ${c.id} — ${c.detail}`),
    ...r.warnings.map((w) => `  [WARN] ${w}`),
    `  [INFO] Not purchasable by design: ${r.intentionally_unavailable.join(", ")}`,
    r.limitation,
  ].join("\n");
}
