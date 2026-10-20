# Revised Quick Take purchases

## Offer
- Keep the first Quick Take free.
- After the free session, offer either a **$4.99 Single report for that one Quick Take** or the **$6.99/month Quick Take plan with Interactive Mode included**.
- Remove the separate $2.99 Interactive Mode add-on choice and development warning from this offer. Keep Prime’s separate availability unchanged.
- Update pricing cards, coverage table, FAQs, chooser and Quick Take purchase screens consistently.

## Working access
- Reuse the existing Stripe integration and existing lookup keys; do not invent products or switch payment providers or key modes.
- Bind each one-time purchase to a specific completed Quick Take owned by the signed-in purchaser. Unlock only that session after verified payment, not future sessions or Interactive Mode.
- Include Interactive Mode for active $6.99 Quick Take subscribers, including existing subscribers, without changing their Stripe subscriptions or charging an add-on. Preserve other legacy access.
- Preserve the conversation and selected purchase through sign-in and checkout; handle delayed confirmation honestly.
- Keep verified-owner checks, content privacy, deletion access and evaluation isolation intact.

## Technical details
- Add an owner-scoped Quick Take unlock record with explicit grants and read-only owner policies; only the existing verified payment handler writes unlocks.
- Extend checkout target validation and the existing idempotent payment handler for Quick Take. Validate the $4.99 USD one-time price before opening checkout.
- Use shared subscription access rules across reconciliation, Interactive Mode and account displays so expiry/cancellation removes access consistently.
- Ensure protected reply results are withheld by the server rather than merely blurred in the browser; keep safety guidance available.

## Verification and delivery
- Add focused tests for first-free access, target-bound $4.99 unlocks, $6.99 bundled Interactive Mode, ownership, unpaid/duplicate confirmation and cancelled/expired plans.
- Check pricing and purchase navigation on desktop and narrow screens; run relevant regression tests and inspect managed build results.
- Use only demonstrably isolated payment tests; do not make real charges, self-grant access or claim live payment verification if credentials/session access block it.
- Document changed files, verification and remaining limitations. Leave the frontend unpublished; payment live-mode activation and publication remain separate.