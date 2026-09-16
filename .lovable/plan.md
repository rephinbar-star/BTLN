# Five-stage audit follow-up

## Goal
Reconcile the audit against the current unpublished app, close verified product and billing gaps first, then add factual marketing, trust, sample, feedback-consent, and acquisition improvements without changing prices, products, pair-type artwork, or existing modes.

## Stage 1 — Reconcile current state
- Compare the current preview, routes, copy, metadata, sitemap, and structured data with findings D2.4, D1.4, D5.5, D5.1, D5.3, D1.6, D1.1, D3.3, D3.2, and D3.1.
- Classify each finding as **still applies**, **already fixed**, **needs adaptation**, or **blocked**. Record detailed “was” scores as unavailable because the audit only supplied dimension totals.
- Keep a private owner handoff list for missing founder identity/story/photo/contact approvals and future competitor research, including What Brandon Thinks.

## Stage 2 — Verify and close prior work
- Inspect the two synthetic 10,000-message reports and implementation evidence without rerunning expensive model analysis unless a concrete defect appears.
- Verify full selection counts, dates, ordered chunk coverage, provenance, early/middle/late signals, short Deep Read behavior, reopen ownership, share pseudonyms/revocation/nonowner denial, and full-plan versus Quick Take-only access.
- Replace misleading “quoted word for word” coverage copy with accurate wording distinguishing history processed in ordered passes from the recent transcript slice supplied to final synthesis and any evidence actually shown.
- Finish and test the authorized $4.99 single Group Read path using the existing single-report price: owned target and report-kind validation, paid-only fulfilment, idempotent webhook retries, wrong-target denial, cancellation/failure non-unlock, and monthly/annual-only unlimited eligibility. Preserve paid-through access when cancellation is scheduled.
- Use sandbox payment checks or isolated fixtures only. If credentials prevent a real checkout, leave the offer hidden and report the exact blocker.

## Stage 3 — Factual website fixes
- Add visible Pricing navigation on desktop/mobile and in the footer while retaining login/account controls.
- Rewrite pricing to accurately distinguish Quick Take, Deep Read, and Group Read allowances; the one-time report offer; monthly/annual renewal; USD; cancellation; and verified entitlements. Remove unsupported popularity, savings, priority, guarantee, or vague “unlimited analyses” claims.
- Remove the incorrect `@Lovable` social tag unless an existing verified BetweenTheLines handle is found.
- Add unique titles, descriptions, canonicals, Open Graph data, and initial-HTML prerendering for all public informational and acquisition pages.
- Update the sitemap with canonical public routes only, retaining all 39 pair-type category pages and excluding account, reports, checkout returns, and token shares.
- Add truthful Organization and SoftwareApplication offer data from visible current prices and billing periods. Add matching FAQ markup only where the same FAQ is visibly rendered.
- Keep distinct commands: Quick Take “Get my take”; Deep Read and Group Read use product-specific actions.

## Stage 4 — Trust and demonstration
- Add an About page using verified product and support facts only, with scope and limitations. Do not publish an unapproved founder biography, portrait, social profile, placeholder team, or dead contact.
- Correct Trust and Privacy copy to match actual processing, stored report/evidence behavior, opt-in sharing and revocation, deletion controls, analytics consent, and known provider boundaries. Avoid clinical validation and unverified retention/training claims.
- Add an accessible public sample journey, clearly labeled fictional/synthetic, using the representative report structure: pattern, released evidence, practical next step, and pair type. Cover Romantic, Friends, and Family naturally and preserve full pair-card proportions.
- Briefly explain verified product benefits: guided imports, structured reports, deterministic communication metrics where available, practical reply suggestions, pair types, and controlled sharing.

## Stage 5 — Authentic proof and targeted acquisition
- Extend the existing completed-result feedback flow with a separate unchecked marketing-consent control and optional anonymous/pseudonym attribution. Store consent separately from ordinary feedback; never send transcript/report text or identities to analytics.
- Add minimal moderation fields and reuse the existing admin area to approve/reject consented quotes. Public testimonial display remains absent when there are no genuine approved entries; synthetic/development data is never eligible.
- Add 2–3 distinct public guides for supported jobs: mixed-signal texts with Quick Take, WhatsApp export analysis with Deep Read/Group Read, and friend/family group communication. Each includes a clearly fictional example, accurate privacy and input limits, and the matching CTA.
- Add consent-aware, allow-listed analytics for sample views/CTAs and feedback submission/marketing consent, plus existing analysis and purchase events without text, tokens, names, or identifiers beyond existing opaque IDs.
- Defer competitor-specific pages until primary-source research can substantiate balanced claims; no Rizz/ChatGPT comparison tables in this pass.

## Technical details
- Reuse React Router, Helmet, semantic design tokens, existing page shells, parser limits, auth return-intent flow, Stripe embedded checkout, and backend authorization patterns.
- Generalize the current pair-type build plugin into a safe static-head prerender step for public routes while preserving the 39 existing outputs unchanged.
- Any new public table will include explicit grants, RLS, and server-authorized writes in the same migration. Marketing publication requires explicit consent plus admin approval; ordinary feedback alone never qualifies.
- Add focused tests for entitlement and webhook fulfilment, coverage wording, metadata/prerender outputs, feedback consent/moderation, sitemap exclusions, navigation, sample/acquisition routes, and accessibility-critical interactions.
- Validate affected journeys at 1280px desktop and mobile widths, including keyboard navigation; run relevant tests, TypeScript checks, production build, and inspect generated HTML metadata.

## Deliverables
- Reconciliation matrix with each finding code, status, current score, “was” only when available, recommended action, implementation, evidence, and remaining inputs.
- Exact access/payment test results, prior-feature gate evidence, changed files/migrations/routes, owner handoff items, and deferred comparisons.
- Frontend remains unpublished. Backend changes, if required for secure feedback or billing completion, will be identified separately and tested without real charges.
