// Usage:
//   bun scripts/checkout-readiness/run.ts sanitize <raw-prices.json> <fetched_at ISO> > /tmp/catalog.json
//   bun scripts/checkout-readiness/run.ts check [/tmp/catalog.json] [--json]
// Raw input is a Stripe GET /v1/prices list response obtained read-only by the operator
// (lookup_keys = the whitelist, active=true). Keep raw files in /tmp; never commit them.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { evaluate, formatReport, sanitizeCatalog, type SanitizedCatalog } from "./core";

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "sanitize") {
  const [file, fetchedAt] = rest;
  if (!file || !fetchedAt) { console.error("sanitize <raw.json> <fetched_at>"); process.exit(2); }
  const out = sanitizeCatalog(JSON.parse(readFileSync(file, "utf8")), fetchedAt, "stripe GET /v1/prices (operator payments tool)");
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === "check") {
  const json = rest.includes("--json");
  const file = rest.find((a) => !a.startsWith("--"));
  let catalog: SanitizedCatalog | null = null;
  if (file) { try { catalog = JSON.parse(readFileSync(file, "utf8")); } catch { catalog = null; } }
  let rev = "unknown";
  try { rev = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* unknown */ }
  const report = evaluate({
    checkoutSource: readFileSync("supabase/functions/create-checkout/index.ts", "utf8"),
    catalog, now: new Date(), sourceRevision: rev,
  });
  console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.overall === "READY" ? 0 : report.overall === "UNKNOWN" ? 3 : 1);
} else {
  console.error("Usage: run.ts sanitize <raw.json> <fetched_at> | check [catalog.json] [--json]");
  process.exit(2);
}
