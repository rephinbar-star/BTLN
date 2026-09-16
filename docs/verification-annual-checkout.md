# Annual subscription verification (Stripe TEST mode)

Date: 2026-09-16 UTC. Environment: sandbox/test only. No real charge, no live-mode mutation.

## Price configuration (read via Stripe API, test mode)
- Lookup key: `BTLN_annual`
- Price id: `price_1UGBjIRZ68CcxqGpG5bqj5DI`
- Product: `prod_UidAz4QknGZ7bQ` ("BTLN Duo Annual")
- Amount: 4999 (USD), recurring interval `year`, interval_count 1
- `livemode: false`, `active: true`
- Previous 7999 price `price_1TjBu6RZ68CcxqGptJtDzqxL` deactivated, lookup key cleared.

## End-to-end run
Synthetic user B `a4b5cea6-3249-4729-8aed-44883018c4b5` (`btln+e2eb...@example.com`), previously `monthly / canceled`.

1. Signed in, opened `/pricing`, clicked "Subscribe annually".
2. Embedded Stripe checkout rendered with TEST MODE badge; displayed price USD 49.99/year (localized presentment showed EUR 44.71 equivalent before switching presentment currency).
3. Paid with test card 4242 4242 4242 4242, exp 12/34, CVC 123.

## Webhook evidence (genuine signed Stripe deliveries, `webhook_events` table)
| event_id | type | status | amount_cents | notes |
|---|---|---|---|---|
| evt_1UGBnnRZ68CcxqGp3viKZIfX | checkout.session.completed | processed | 4999 | session cs_test_a1hACM0TSX1IcJnRykKR7eR41Utxlpk4AQROg8GAJuuaaIDXs2xBu5tjLd, mode subscription |
| evt_1UGBnnRZ68CcxqGpK6AUVNSF | customer.subscription.created | processed | 4999 | lookup_key BTLN_annual, tier annual, status active |
| evt_1UGBnnRZ68CcxqGpSv4LyyRr / evt_1UGBnnRZ68CcxqGpuSrJtZSR | invoice.created / invoice.payment_succeeded | ignored (by design) | — | not entitlement-bearing |

All rows recorded `environment: sandbox`.

## Entitlement result
`user_subscriptions` for user B: `tier=annual`, `status=active`, period 2026-09-16 → 2027-09-16.
Subscription id `sub_1UGBnlRZ68CcxqGpufYXDgyv`, customer `cus_VGi2D1jrMGjVop`.

## UI result (after navigation and a full reload)
`/account` shows: "Subscribed $49.99/Year", "Renews 9/16/2027", webhook audit log present, one-time unlocks: none. State persisted across reload.

Amount shown in UI matches the charged amount (4999) and the advertised site price. The earlier $79.99 discrepancy is closed in test mode.

## Live mode
The connected Stripe integration holds a **test-mode restricted key only** (`rk_test_…`). Live-mode prices could not be read, so the live `BTLN_annual` amount is **UNVERIFIED** — not asserted to be wrong. No live mutation was performed.

**Launch item (owner):** before enabling live payments, confirm/correct the live-mode `BTLN_annual` price to $49.99/year with the same lookup key, and confirm the live `BTLN_monthly` and `BTLN_report_unlock` amounts match the published page.
