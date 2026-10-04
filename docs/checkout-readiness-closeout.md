# Checkout readiness check — closeout (2026-10-04)

Read-only operator diagnostic. Configuration readiness only — **not** a checkout-to-webhook fulfilment test. Unpublished; no checkout, webhook, key, product, price or gating change.

## Changed files
- `scripts/checkout-readiness/core.ts` — pure checker (whitelist extraction from `supabase/functions/create-checkout/index.ts`, sanitizer, Pass/Fail/Unknown evaluation, formatter).
- `scripts/checkout-readiness/run.ts` — CLI (`sanitize`, `check [--json]`). Exit 0 READY, 3 UNKNOWN, 1 NOT_READY.
- `src/lib/checkoutReadiness.test.ts` — 7 tests: actual whitelist parse, drift, missing/wrong amount/wrong recurrence/live/duplicate, legacy warnings only, stale/missing catalog → no success, unknown server mode blocks READY, output contains no price/product ids, metadata or key prefixes.
- `docs/checkout-readiness-closeout.md`.

## Command
1. Fresh catalog (read-only): the `lovable` CLI has no payments command, so the operator uses the existing connected payments tool: `GET /v1/prices` with `active=true`, `lookup_keys=` the whitelist, `limit=100`. Save the response to `/tmp` (never commit).
2. `bun scripts/checkout-readiness/run.ts sanitize /tmp/ckr/raw.json "$(date -u +%FT%TZ)" > /tmp/ckr/catalog.json` — keeps only lookup_key, active, livemode, currency, amount, type, interval.
3. `bun scripts/checkout-readiness/run.ts check /tmp/ckr/catalog.json [--json]`. Catalogs older than 60 min fail freshness; no catalog → UNKNOWN. No cached fallback.

## Actual run (fresh catalog read 2026-10-04 00:11 UTC)
```
Checkout readiness: UNKNOWN
checked_at 2026-10-04T00:11:04.081Z · revision e4327fad1232613dac9ca8a0d768d8d2cb091ed9
catalog stripe GET /v1/prices (operator payments tool) · mode test · fetched 2026-10-04T00:11:03Z · fresh PASS
allowed keys: BTLN_annual, duo_annual, BTLN_monthly, duo_monthly, BTLN_decode_monthly, decode_monthly, BTLN_report_unlock
  [PASS] whitelist_parsed — 7 keys read from create-checkout
  [PASS] catalog_fresh — 1s old
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

## Evidence / no mutation
- Only call made: one `GET /v1/prices` list. No sessions, customers, payments, webhooks, auth sessions, model calls, env reads, migrations or settings changes.
- Tests: 7/7 passed; strict typecheck of the scripts clean.

## Limitations
- Server key mode remains **UNKNOWN** — so overall cannot be READY. Confirming it needs an authorized server-side mode-only read, which does not exist and was not built.
- The connected payments tool's account is not proven to be the same account as the server's key.
- Does not test checkout → payment → webhook fulfilment.
