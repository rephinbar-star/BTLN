// Usage:
//   bun scripts/checkout-readiness/run.ts sanitize <raw-prices.json> <captured_at ISO> > /tmp/ckr/catalog.json
//   bun scripts/checkout-readiness/run.ts check [/tmp/ckr/catalog.json] [--json]
// <captured_at> is the UTC time recorded WHEN the provider list was read (e.g. `date -u +%FT%TZ`
// run immediately before the read), never the time of sanitizing. Raw files stay in /tmp; never commit.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { evaluate, formatReport, sanitizeCatalog, validateSanitizedCatalog, type SanitizedCatalog } from "./core";

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "sanitize") {
  const [file, capturedAt] = rest;
  if (!file || !capturedAt) { console.error("sanitize <raw.json> <captured_at>"); process.exit(2); }
  try {
    console.log(JSON.stringify(sanitizeCatalog(JSON.parse(readFileSync(file, "utf8")), capturedAt), null, 2));
  } catch (e) {
    const known = e instanceof Error && /^(fetched_at|Catalog input)/.test(e.message);
    console.error(known ? (e as Error).message : "Raw catalog could not be read or parsed");
    process.exit(1);
  }
} else if (cmd === "check") {
  const json = rest.includes("--json");
  const file = rest.find((a) => !a.startsWith("--"));
  let catalog: SanitizedCatalog | null = null;
  let catalogError: string | undefined;
  if (file) {
    let parsed: unknown;
    try { parsed = JSON.parse(readFileSync(file, "utf8")); } catch { catalogError = "catalog file missing or not valid JSON"; }
    if (!catalogError) {
      const v = validateSanitizedCatalog(parsed);
      if (v.ok) catalog = v.catalog; else catalogError = v.reason;
    }
  }
  let rev = "unknown";
  try { rev = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* unknown */ }
  const report = evaluate({
    checkoutSource: readFileSync("supabase/functions/create-checkout/index.ts", "utf8"),
    catalog, catalogError, now: new Date(), sourceRevision: rev,
  });
  console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.overall === "READY" ? 0 : report.overall === "UNKNOWN" ? 3 : 1);
} else {
  console.error("Usage: run.ts sanitize <raw.json> <captured_at> | check [catalog.json] [--json]");
  process.exit(2);
}
