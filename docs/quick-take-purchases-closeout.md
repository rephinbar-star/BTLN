# Revised Quick Take purchases — 2026-10-20

## Implemented
- First Quick Take is free; the first-created non-evaluation session keeps free reply access even after later sessions exist. Pending earlier sessions cannot create extra free sessions. Failed first sessions can be retried under the same target.
- $4.99 Single report now includes one selected Quick Take session. It does not include ongoing Interactive Mode or unlock future sessions.
- Existing $6.99/month Quick Take subscribers receive Interactive Mode without a separate add-on charge or Stripe subscription mutation. Expired/cancelled subscriptions are not active access. Existing broader Quick Take access is preserved.
- Pricing, comparison, FAQs, chooser and result purchase controls reflect the revised offer. Prime remains unavailable.
- Protected reply options are removed in the server result read until access is verified, not merely blurred in the browser. Interpretation, signals and safety guidance retain their existing preview behavior.
- Direct browser reads of the stored result column are revoked; metadata-only owned reads remain available for source management. Anonymous reads retain the existing opaque session capability model.
- Single-purchase checkout verifies owner, completed target, evaluation exclusion, existing access and the active $4.99 USD one-time price. Monthly checkout validates $6.99 USD/month.
- Webhook and authenticated checkout-return reconciliation independently verify paid status and target ownership before an idempotent target unlock. Return query parameters alone never grant access. Sign-in preserves purchase type and target, with an explicit owner claim for anonymous decodes.
- Existing Stripe and OpenRouter integrations, branding and Prime pricing are unchanged. No payment key-mode switching, charges, model calls or frontend publication occurred.

## Verification
- 22 focused regression tests passed: revised price/entitlement rules, cancelled/expired access, unpaid/wrong-price/wrong-product rejection, legacy prerequisite rules, chooser routes and existing readiness diagnostic.
- Managed preview typecheck/build: latest entries `build OK` after edits.
- Browser pricing at 320, 375 and 1280 widths: no horizontal overflow or page errors; Single report choice includes `/quick`. Screenshots reviewed for narrow-screen chooser wrapping.
- Live content-free anonymous fixtures: first pending target returned `_access_locked=false`; second returned `true`. Wrong-session reads returned zero rows. Direct anonymous invocation of privileged `decode_access_allowed` returned permission denied (42501). Temporary fixtures were removed.
- Migration/tool read role could not execute the protected RPC directly; checks used the actual app anonymous client instead. No privilege was widened to accommodate the diagnostic.
- Five existing functions were deployed; two additive migrations applied. These backend changes are live because preview and published app share the backend. Frontend remains unpublished.

## Limitations
- No real payment or isolated Stripe checkout was performed: server key mode has not been authoritatively confirmed, so sandbox catalog/browser keys do not prove isolation. Real paid fulfilment and a subscribed customer's Interactive Mode browser flow remain unverified.
- The signed-in owner is not used to fabricate entitlement, and no customer subscription was changed. No new customer/synthetic auth session was minted.
- Existing refund/dispute behavior is unchanged; this work does not claim a new refund-policy implementation.
- Anonymous first-free tracking retains the existing browser/session capability limits; it is not a cross-device person-identification guarantee.

## Changed areas
`Pricing`, `HelpMeChoose` and its tests, `DecodeResult`, `InteractiveModePanel`, `useMembership`, checkout hook/component, analytics target enum; shared `quickTakePurchases` rules/tests; `create-checkout`, `payments-webhook`, `sync-subscription`, `interactive-mode`, `decode-conversation`; two `drizzle/migrations` files; `AGENTS.md`, roadmap and this closeout.

Saved revision observed during verification: `62cb6772c60347abda38c73e956fb08825d99800` (subsequent final safeguards/docs are managed separately; no manual Git commit performed).