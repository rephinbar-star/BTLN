# Payments fulfilment verification + database linter triage

Date: 2026-09-16 (UTC). All work below is **backend/database only**. The **frontend was not published**.
Stripe ran in **TEST mode only** (client token prefix `pk_test_`); **no real charges**, no live-mode switch,
no new products/prices, no changes to existing prices or intended entitlements. Relationship Wrapped not started.

---

## 1. Stripe test checkout through fulfilment

### Method

- Real hosted **embedded Stripe Checkout** driven with Playwright against `localhost:8080`, test cards
  `4242 4242 4242 4242` (success) and `4000 0000 0000 0002` (decline).
- Webhooks: genuine Stripe test-mode deliveries to the deployed `payments-webhook` function
  (signature verified by `verifyWebhook`). No mocked webhook payloads were used for the pass results below.
- Synthetic users (created via the auth API, excluded from any public counters — they are `@example.com`
  addresses with `btln+e2e*` local parts and are not linked to testimonials or usage proof):

  | Label | User ID | Email |
  |---|---|---|
  | A | `738e6d55-8fcf-4f45-93a3-bff84edbff7e` | `btln+e2ea1789532730@example.com` |
  | B | `a4b5cea6-3249-4729-8aed-44883018c4b5` | `btln+e2eb1789532730@example.com` |
  | C | `c4e590cf-8e69-41e7-8647-3a1ec24c2e1c` | `btln+e2ec1789532730@example.com` |

- Synthetic reports: analyses `11111111-0000-4000-8000-00000000e2e1` (A, Deep Read),
  `...e2e4` (A, decline case), `...e2e5` (B, control); group read `11111111-0000-4000-8000-00000000e2e2` (B).

### Results

| # | Scenario | Method | Result |
|---|---|---|---|
| 1 | A buys own Deep Read, `BTLN_report_unlock` ($4.99) | real checkout | PASS — `analyses.is_paid = true`, exactly 1 `one_time_unlocks` row, audit row `processed` |
| 2 | B buys own Group Read ($4.99) | real checkout | PASS — `group_reads.access_source = 'one_time'`, exactly 1 `group_read_unlocks` row, audit `processed` |
| 3 | B buys `BTLN_monthly` ($9.99/mo) | real checkout | PASS — `user_subscriptions` tier `monthly`, status `active`; full-report access granted |
| 4 | C buys `BTLN_decode_monthly` ($6.99/mo, Quick Take only) | real checkout | PASS — tier `decode_monthly`; `user_has_full_plan` = false; `user_has_paid_access` on C's own Deep Read = false. **Quick Take-only never unlocks Deep/Group.** |
| 5 | Declined card on A's report `...e2e4` | real checkout | PASS — no unlock, `is_paid` stays false |
| 6 | B attempts checkout for A's analysis / A's group read | API call | PASS — 403 `Not your report` / `Not your group read` |
| 7 | Signed-out visitor attempts one-time purchase for an owned report | API call | PASS — 401/403, no session created |
| 8 | Client supplies an arbitrary price ID | API call | PASS — 404 `Price not found`; price/amount/currency/mode are resolved server-side from the lookup key, never from the client |
| 9 | Client-side "success" redirect without server confirmation | UI | PASS — `/checkout/return` polls the server and shows "Still confirming your payment"; no access is granted by the redirect |
| 10 | Forged webhook signature / missing signature | signed-request fixture | PASS — rejected before any processing, no audit row, no entitlement change |
| 11 | Cancel-at-period-end (`sub_1UGAdDRZ68CcxqGphmhAp5zp`, B monthly) | Stripe API on the test subscription | PASS — access retained through the paid period |
| 12 | Subscription actually ended | Stripe API on the test subscription | PASS — status `canceled`; `user_has_full_plan` = false; B's previously purchased one-time unlocks were preserved |
| 13 | Duplicate / retried delivery | observed Stripe retries of the same event ID | PASS — `claim_webhook_event` (unique index on non-null `event_id`) admits one processor; unique constraints on `one_time_unlocks (user_id, analysis_id)` and `group_read_unlocks (user_id, group_read_id)` make grants idempotent. Repeated deliveries of the Deep Read event left the unlock count at exactly 1. |

**Fixtures vs real checkout:** rows 1–5, 11, 12 used real hosted test checkout / real Stripe API objects and real
signed Stripe webhook deliveries. Rows 6–8 are direct API authorization calls (no checkout by design — the request is
refused). Row 10 used crafted unsigned/forged requests. Row 13 is based on observed real retries plus the database
constraints; Stripe offers no "resend event" API, so an on-demand replay could not be forced.

### Bug found and fixed

`recordAudit` in `supabase/functions/payments-webhook/index.ts` used `upsert(..., { onConflict: "event_id" })`
against a **partial** unique index, which Postgres rejects ("no unique or exclusion constraint matching the
ON CONFLICT specification"). Consequence: audit rows stayed at `processing` and the function returned 500 to Stripe,
causing needless retries — grants themselves were still correct and idempotent.
Fix: update by `event_id`, insert if no row matched. Deployed and re-verified (rows 1–3 now record `processed`).

### Not implemented (not invented)

**Refunds/reversals are not implemented** in this codebase — there is no `charge.refunded` /
`charge.dispute.created` handling and no revocation policy. Nothing was invented; this is an owner decision.

### Residue

Six synthetic `webhook_events` rows created **before** the fix remain at `processing`. They are test-mode rows; their
grants already applied correctly and Stripe's own retry (allowed again after 10 minutes by `claim_webhook_event`)
resolves them idempotently. No production data affected.

---

## 2. Database linter triage

**Before: 61 findings. After: 56 findings.** (4 × `0008_rls_enabled_no_policy` resolved, 1 × anon
SECURITY DEFINER exposure resolved.)

### Resolved

| Finding | Object | Severity | Exposure | Action |
|---|---|---|---|---|
| 0008 RLS enabled, no policy | `messages_temp` | INFO (real data sensitivity: raw message text) | Deny-by-default already, but grants were wide and intent undocumented | Explicit deny-all policy for `anon`/`authenticated`; `REVOKE ALL`; `service_role` only. Written/deleted by `analyze-conversation` via service role. |
| 0008 | `analysis_share_links` | INFO | Holds share token hashes + snapshots | Same treatment; reached only through `resolve_analysis_share` / `analysis-share` function |
| 0008 | `roast_share_links` | INFO | Same | Same treatment |
| 0008 | `events` | INFO | Analytics event log | Writes only via `log_event()`/service role (insert policy `false`, grants revoked); **admins** may read (`has_role`), which also repairs the admin analytics panel |
| 0028 anon-executable SECURITY DEFINER | `save_analysis_recipient_perspective` | WARN | Function already rejects anonymous callers | `REVOKE EXECUTE ... FROM anon` |

### Additional security fixes (not linter-flagged, found during inspection)

- **`submit_feedback` had no ownership check** and was callable by anyone, signed in or not — any party who knew a
  report UUID could overwrite that report's feedback score/text/email. Now requires the caller to be the report's
  signed-in owner, or the report to be unclaimed/anonymous. Verified: other-user and anonymous attempts return
  `not authorized`; the owner succeeds.
- The legacy 4-argument `submit_feedback` overload was dropped (unused by the app; it made every PostgREST call
  ambiguous — `PGRST203`).
- `has_role(uuid, app_role)` had **no EXECUTE grant for `authenticated`**, so every admin-only RLS policy that calls
  it (`share_clicks`, the new `events` policy) failed with "permission denied for function". Granted.

### Accepted, with reasons (not launch blockers)

- **23 × 0028 / 33 × 0029 remaining SECURITY DEFINER warnings.** These functions *are* the application's API surface
  and are deliberately callable. Every one was read: each either (a) scopes by `auth.uid()` and/or an unguessable
  session/token value before returning anything (`get_*_for_session`, `get_*_share_for_owner`,
  `resolve_*_share`, `get_shared_analysis`, `user_has_*`, `count_*`), (b) is an append-only writer with validation
  (`log_event`, `record_share_click`, `record_paywall_intent`, `capture_email`, `submit_survey`,
  `submit_testimonial_candidate`), or (c) requires authentication internally (`claim_*`,
  `save_recipient_perspective`, `set_couple_type_image_url` which additionally requires the admin role).
  Anonymous execution is required so signed-out visitors can start and view their own reads. Revoking it would break
  the anonymous product flow with no security gain. `claim_webhook_event`, `has_role`, `handle_new_user`,
  `list_approved_testimonials` and `submit_testimonial_candidate` are **not** anon-executable; a direct SQL attempt to
  call `claim_webhook_event` was refused (`permission denied`).
- Wide table `GRANT`s elsewhere are constrained by RLS policies that were individually read and are owner/role-scoped;
  no blanket policy rewrite was performed.
- No performance findings were reported by the linter (all 56 are the two SECURITY DEFINER categories); no index
  changes were made, so no usage-review deferrals are outstanding.

### Authorization evidence (post-change)

| Check | Result |
|---|---|
| anon `SELECT` on `messages_temp` / `events` / `analysis_share_links` / `roast_share_links` | permission denied (42501) |
| user B reading user A's analysis row | `[]` |
| non-admin signed-in user reading `events` | `[]` |
| user B / anon calling `submit_feedback` on A's report | `not authorized` |
| owner A calling `submit_feedback` on own report | success |
| bogus / revoked share token via `resolve_analysis_share` | `null` |
| anon `get_analysis_for_session` with a wrong session ID | `[]` |
| `claim_webhook_event` called outside `service_role` | permission denied |
| Quick Take-only plan (user C) against `user_has_full_plan` / `user_has_paid_access` | false / false |

---

## 3. Changes

**Files modified**
- `supabase/functions/payments-webhook/index.ts` — `recordAudit` no longer relies on `ON CONFLICT` against a partial index.

**Migrations applied**
1. `submit_feedback` ownership guard; deny-all policies + `REVOKE ALL` on `messages_temp`, `analysis_share_links`,
   `roast_share_links`; `events` admin read policy, insert-deny policy and grant tightening;
   `REVOKE EXECUTE ON save_analysis_recipient_perspective FROM anon`.
2. `DROP FUNCTION submit_feedback(uuid,integer,text,text)`; `GRANT EXECUTE ON has_role(uuid, app_role) TO authenticated`.

**Deployments (backend only, not a frontend publish):** `payments-webhook`.

**Rollback notes**
- Feedback guard: `CREATE OR REPLACE` the previous body (no ownership `SELECT`/`RAISE`), and re-create the 4-arg
  overload if an external dashboard needs it.
- Table lockdown: `DROP POLICY "No direct client access to <table>"` and re-`GRANT SELECT, INSERT, UPDATE, DELETE`
  to `anon, authenticated`. No data was altered or deleted.
- `events`: `DROP POLICY "Admins can read events"` / `"No direct writes to events"` and restore the prior grants.
- `has_role` grant: `REVOKE EXECUTE ... FROM authenticated` (this will re-break admin-only RLS policies).
- Webhook code: revert the single `recordAudit` block and redeploy.

## 4. Verification

- `bunx vitest run` — 8 files, **71/71 passed** (including the 10,000-message ingestion test).
- `tsgo --noEmit` — clean. `bun run build` — succeeded; 10 static + 39 pair-type pages prerendered.
- Linter re-run: **61 → 56**.

## 5. Unresolved / needs owner input

1. **Refund and dispute policy** — not implemented; decide whether `charge.refunded` / dispute events should revoke
   a one-time unlock or a subscription, and over what window.
2. **`ADMIN_PASSWORD`-based functions** (`verify-admin-password`, `compare-model`, `admin-update-product`) still use a
   shared password rather than the admin role used by `admin-list-users` / `admin-testimonials` / `test-webhook-secret`.
   Recommended follow-up, not done here to avoid locking the owner out mid-task.
3. **Legal operator identity / contact details** for the About and Organization data — still unavailable.
4. **Genuine testimonials and usage proof** remain hidden; no approved entries exist.
5. **Live-mode webhook secret** (`STRIPE_WEBHOOK_SECRET_LIVE`) exists but was deliberately never exercised.

**Frontend was not published. No real charges were made.**

---

## 6. Annual subscription — real test-mode checkout through fulfilment (2026-09-16)

| Step | Evidence |
|---|---|
| Hosted Stripe **test** Checkout (embedded) completed with card `4242 4242 4242 4242` by synthetic user A (`738e6d55-8fcf-4f45-93a3-bff84edbff7e`) | real checkout, not a fixture |
| Genuine signed webhook deliveries | `evt_1UGBYPRZ68CcxqGpOn5bJXpu` (`customer.subscription.created`, `processed`), `evt_1UGBYPRZ68CcxqGpWrE8qGaC` (`checkout.session.completed`, `processed`); unrelated events recorded as `ignored` |
| Entitlement | `user_subscriptions`: tier `annual`, status `active`, period `2026-09-16` → `2027-09-16`, `cancel_at_period_end = false` |
| UI + reopen | `/account` shows the annual membership; still shown after a full page reload |

### Pricing discrepancy found — owner decision required

The sandbox price with lookup key `BTLN_annual` is **7999 cents ($79.99/year)**
(`price_1TjBu6RZ68CcxqGptJtDzqxL`, test mode). The site advertises **$49.99/year**
(`src/pages/Pricing.tsx`, `src/components/PaywallBlur.tsx`, `src/pages/Account.tsx` label
"Subscribed $49.99/Year", the Offer JSON-LD in `index.html` and `src/pages/Pricing.tsx`, and both
comparison pages). The charged amount in the test checkout was 7999.

Nothing was changed: the instruction is not to alter existing prices, and the correct resolution is a
business decision — either the Stripe price or the published copy must move. Until then the published annual
price is not truthful and this is a launch blocker for the pricing page.
