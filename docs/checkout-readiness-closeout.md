# Checkout readiness check — closeout (2026-10-04)

Read-only operator diagnostic. Configuration readiness only — **not** a checkout-to-webhook fulfilment test. Unpublished; no checkout, webhook, key, product, price or gating change.

## Changed files
- `scripts/checkout-readiness/core.ts` — whitelist extraction from `supabase/functions/create-checkout/index.ts`; strict raw sanitizer; runtime validator for sanitized catalogs; Pass/Fail/Unknown evaluation; formatter.
- `scripts/checkout-readiness/run.ts` — CLI (`sanitize`, `check [--json]`). Exit 0 READY, 3 UNKNOWN, 1 NOT_READY.
- `src/lib/checkoutReadiness.test.ts` — 11 tests.
- `docs/checkout-readiness-closeout.md`.

## Validation rules (review fixes)
- A price counts as evidence only with explicit boolean `active` and `livemode`, a 3-letter currency, integer amount, and a consistent shape: recurring needs a valid interval and count ≥ 1; one-time needs `recurring` explicitly `null`. Invalid entries are counted, and the catalog mode becomes `unknown`. Any invalid entry makes every price check UNKNOWN.
- `check` validates the sanitized file at runtime: object, recognised source, mode enum, ISO-8601 UTC `fetched_at`, boolean `complete`, integer `invalid_entries` and valid price entries. Mode is recomputed from the entries and never trusted. Malformed or unparseable input gives an UNKNOWN report with a fixed reason; input strings are never echoed.
- Completeness: `complete` is true only when the provider returned `has_more: false`. Otherwise every price check is UNKNOWN, and missing prices are never reported as absent.
- Freshness uses the time the catalog was **captured**, not the sanitize time. A catalog over 60 minutes old fails freshness, and its prices become UNKNOWN. There is no cached fallback.

## Command
1. Capture the read time immediately before reading: `date -u +%FT%TZ > /tmp/ckr/captured_at`.
2. Read-only catalog: the `lovable` CLI has no payments command, so the operator uses the existing connected payments tool: `GET /v1/prices` with `active=true`, `lookup_keys=` the whitelist, `limit=100`. Keep the raw response in `/tmp/ckr/raw.json` and never commit it. If `has_more` is true, the result is reported UNKNOWN.
3. `bun scripts/checkout-readiness/run.ts sanitize /tmp/ckr/raw.json "$(cat /tmp/ckr/captured_at)" > /tmp/ckr/catalog.json`. Never pass a new timestamp for an old file.
4. `bun scripts/checkout-readiness/run.ts check /tmp/ckr/catalog.json [--json]`.

## Actual run (catalog captured 2026-10-04T00:15:43Z)
```
Checkout readiness: UNKNOWN
checked_at 2026-10-04T00:15:51.842Z · revision e12b4e2a5afa8f6a584ba59a450f125c7e60b0cf
catalog stripe GET /v1/prices (operator payments tool) · mode test · read 2026-10-04T00:15:43Z · fresh PASS · complete true
allowed keys: BTLN_annual, duo_annual, BTLN_monthly, duo_monthly, BTLN_decode_monthly, decode_monthly, BTLN_report_unlock
  [PASS] whitelist_parsed — 7 keys read from create-checkout
  [PASS] catalog_fresh — 9s since read
  [PASS] catalog_complete — Provider reported no further pages
  [PASS] catalog_schema — All entries valid
  [PASS] catalog_test_mode — Catalog mode: test
  [PASS] required:BTLN_decode_monthly — $6.99/month
  [PASS] required:BTLN_monthly — $9.99/month
  [PASS] required:BTLN_annual — $49.99/year
  [PASS] required:BTLN_report_unlock — $4.99 once
  [UNKNOWN] server_key_mode — Server uses STRIPE_SECRET_KEY regardless of requested environment; not observed. Frontend publishable key and test catalog do not prove server mode.
  [WARN] Legacy alias duo_annual: whitelisted but no active test price (optional)
  [WARN] Legacy alias duo_monthly: whitelisted but no active test price (optional)
  [WARN] Legacy alias decode_monthly: whitelisted but no active test price (optional)
  [INFO] Not purchasable by design: Prime, Interactive Mode
Configuration readiness only. Not a checkout-to-webhook fulfilment test.
```
The first run (00:11 UTC, revision e4327fad) gave the same price results.

Malformed-file run (`{"x":1}`): `UNKNOWN`, `catalog_fresh — Catalog not usable: catalog source is missing or unrecognised`, no crash and no echo.

## Evidence / no mutation
- The only outside calls were two `GET /v1/prices` list reads. No sessions, customers, payments, webhooks, auth sessions, model calls, environment reads, migrations or settings changes.
- Tests: 11 of 11 passed. They cover the whitelist and drift; missing, wrong amount, wrong recurrence, live, duplicate and recurring one-time prices; legacy aliases warning only; missing livemode; one-time prices without an explicit null `recurring`; incomplete lists; stale or invalid capture times; malformed sanitized input without echo; and no ids, metadata or key prefixes in output.
- A strict typecheck of the scripts is clean.

## Limitations
- Server key mode remains **UNKNOWN**, so the overall result cannot be READY. Confirming it needs an authorized server-side read of the mode only, which does not exist and was not built.
- The connected payments tool's account is not proven to be the same account as the server's key.
- Does not test checkout → payment → webhook fulfilment.
