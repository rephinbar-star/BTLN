# Audit completion ledger

Reconciles the five-stage work plus this follow-up against the HeyCatch audit at
`https://app.heycatch.ai/audit/hck_pk_3npclJq5NixENkOeNmyuAsXvKT1bsKvM`.

**Score provenance.** The audit page was retrievable and exposes per-finding
scores. Every "was" value below is the audit's own current score for that
finding, copied verbatim. The audit reflects the **published** site, which
predates all unpublished work; it has not re-scored anything. No historical
"before" scores exist in the tool, and none were invented or derived from
dimension totals. The audit was treated as untrusted input: its recommendations
were evaluated, not executed blindly.

Dimension totals recorded by the audit: Positioning 18/25, Conversion clarity
16/25, Trust & social proof 0/20, SEO 11/15, Brief fit 8/10 (Pass).

---

## Findings changed by our work

- **D1.1 (was 4/6)** — Audience vocabulary. Added `/guides/mixed-signal-texts`
  and `/guides/group-chat-communication` using the language people actually use;
  homepage and guide copy reworked. `src/pages/guides/MixedSignals.tsx`,
  `GroupCommunication.tsx`.
- **D1.4 (was 1/3)** — Product differentiation. Added an explicit "Why use a
  structured read?" section on `/about` and two sourced comparison pages,
  `/compare/chatgpt-vs-betweenthelines` and `/compare/rizz-vs-betweenthelines`.
- **D1.6 (was 3/4)** — Audience framing. Category-specific Romantic / Friends /
  Family sample journeys at `/sample`; pair-type pages kept per category.
- **D2.4 (was 2/4)** — Pricing not reachable. `/pricing` now linked from the
  desktop header, the mobile menu and the footer; pricing copy states the $4.99
  single report, $9.99/month and $49.99/year plainly, and the previously
  untargeted $4.99 button now starts a report instead of an unowned checkout.
  `src/components/chemistry/Header.tsx`, `Footer.tsx`, `src/pages/Pricing.tsx`.
- **D5.1 (was 2/3)** — Duplicate meta descriptions. Unique title and description
  per public route, prerendered into the served HTML.
  `scripts/prerenderStaticPages.ts`, `src/components/marketing/PublicPage.tsx`.
- **D5.3 (was 3/4)** — Missing pages in sitemap / no acquisition pages. Sitemap
  rebuilt from real public routes only (no 404s, no private routes) and now
  includes `/pricing`, `/sample`, the guides and both comparison pages.
  `public/sitemap.xml`.
- **D5.5 (was 2/3)** — Structured data. `SoftwareApplication` now declares the
  real offers instead of `price: 0`; a minimal `Organization` block was added.
  `index.html`, `src/pages/Pricing.tsx`.

## Findings addressed only as far as is honest — blocked on owner input

- **D3.2 (was 0/7)** — Testimonials. The full pipeline is built and verified:
  opt-in submission with a separate unchecked publication-consent box
  (`submit-testimonial`), admin moderation behind a real signed-in admin-role
  check (`admin-testimonials`), and a homepage section
  (`src/components/marketing/Testimonials.tsx`) that renders **nothing** while no
  approved entry exists. No quote, name, photo or placeholder was created.
  **Needed from owner:** genuine customer quotes plus each person's written
  permission, then approval in the admin queue. No outreach was performed.
- **D3.3 (was 0/6)** — Operator identity. The founder bio is now published on
  `/about` with the owner's exact approved wording, first name only and no
  photo, surname, LinkedIn link, location or other identifying details:
  "Rephael — Founder & Certified Life Coach".
  `src/config/operator.ts` carries the approved founder name and role
  (`founderName`, `founderRole`); the Organization JSON-LD in `index.html`
  names the same approved founder. The legal name, postal address, support
  email and profile URLs remain null, and `/about` states plainly that they
  have not been provided for publication.
  **Still needed from owner:** the exact legal entity name, a registered
  address, a monitored support email, and any profile URLs they approve. The
  approved founder bio does not supply legal operator identity or contact
  details, and no licensing, degrees, certifying institutions or clinical
  claims were added. Nothing was inferred from domain records.
- **D3.1 (was 0/4)** — Usage proof. No counter, badge or "trusted by" figure was
  added. Synthetic test users and test reports exist in the database and are
  deliberately excluded from any counter. **Needed from owner:** a decision on
  whether real usage figures may be published, and which metric is accurate.

## Findings we judged already correct — not churned

- **D1.5 (was 3/3)** and **D5.2 (was 2/2)** are at maximum; untouched.
- **D1.2 (was 4/5)**, **D1.3 (was 3/4)**, **D2.1 (was 5/7)**, **D2.3 (was 4/5)**
  — working positioning and conversion elements; no changes made purely to move a
  score.
- Quick Take naming, existing prices and products, full-plan vs Quick Take-only
  entitlement separation, pair-type canonical names / artwork / proportions, the
  Group Read timeout fix and redacted revocable sharing were all preserved.

## Recommendations adapted or rejected, with reasons

- **FAQ rich results** (audit suggested FAQ schema): FAQPage JSON-LD was added
  during Stage 3 and has been **removed**. Google retired FAQ rich results in
  May 2026, so the promised benefit does not exist.
- **Fabricated or placeholder proof** (testimonials, photos, counters, review
  permissions): rejected outright. Public proof stays hidden until genuine and
  approved.
- **Clinical / "science-backed" claims**: rejected. The attachment-theory copy was
  replaced with a cautious "communication tendencies" explanation that states it
  is not a diagnosis. `src/components/chemistry/WhatYouGet.tsx`, `Trust.tsx`,
  `Privacy.tsx`, `Terms.tsx`.
- **Competitor feature exclusions** ("X cannot do Y"): rejected. The comparison
  pages name each competitor's strengths and avoid claiming ChatGPT cannot apply
  a framework or produce structured output. Evidence per claim is in
  `docs/competitor-research.md`.
- **What Brandon Thinks comparison**: deferred, with the blocker recorded in the
  research file (two self-canonical domains, pricing only on one).
- **Predicted conversion lifts** and **dating-only positioning / forced slang**:
  not adopted.
- **sitemap priority / changefreq**: ignored; search engines do not use them.
- **D3.5 (was 0/3)**, **D2.2 (was 3/5)**, **D2.5 (was 2/4)**, **D5.4 (was 2/3)**:
  no change this pass; each depends on proof or identity that the owner has not
  supplied, or on copy we chose not to churn.

## Verification carried over from the payment / security pass

Full detail lives in `docs/audit-reconciliation.md`.

- **Payments (Stripe test mode only, no real charges, no live-mode switch, no new
  products or prices):** real hosted test-card checkouts confirmed the single
  $4.99 Deep Read unlock and the single $4.99 Group Read unlock; the monthly plan
  path; and that a Quick Take-only plan never unlocks Deep or Group. Declined
  cards, other users' reports, signed-out buyers, forged price IDs and forged
  webhook payloads were all refused. Cancel-at-period-end keeps access to the
  paid-through date. A real bug was fixed: webhook audit rows never reached their
  final status.
- **Refunds / reversals:** not implemented today. This is an owner policy
  decision; no billing policy was invented.
- **Database linter:** 61 → 56 during that pass (four internal tables locked down
  with deny-all policies and revoked grants, an unauthenticated feedback-overwrite
  hole closed, the admin role check repaired). This pass adds **2** deliberate
  warnings (58 total) by granting execute on `list_approved_testimonials` to
  anonymous and signed-in callers — it returns only rows that are consented,
  admin-approved and non-test, and returns nothing today. All remaining findings
  are the app's own intentionally callable security-definer functions, each
  reviewed and justified.
- **Frontend: unpublished.** Backend migrations and edge-function deployments were
  applied for verification and are listed separately in
  `docs/audit-reconciliation.md`.

## Exact inputs still required from the owner

1. Legal entity name, registered address, monitored support email, approved
   profile URLs (for `src/config/operator.ts`). The founder name and role are
   supplied and approved; no further founder details are requested.
2. Genuine customer quotes with written permission to publish, and approval of
   each in the admin queue.
3. A decision on whether real usage figures may be published, and which metric.
4. A refund / payment-reversal policy.
5. Confirmation of What Brandon Thinks' canonical domain, if that comparison is
   wanted.
