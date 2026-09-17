# Prime + Relationship Journey — implementation checklist

Durable build log. Status values: DONE (with evidence), IN PROGRESS, PENDING.
Nothing in this work is published. No real card has been charged, no email sent,
no existing subscriber's billing changed.

## Stage 1 — Journey foundation and private /journey

| Item | Status | Evidence |
| --- | --- | --- |
| Inspect existing schema / auth / payments / generation | DONE | Reviewed `create-checkout`, `payments-webhook`, `ProtectedRoute`, existing analyses/group_reads/decodes/roasts ownership model before writing any new table. |
| Additive Journey schema (no existing table altered) | DONE | Migration adds `journey_profiles`, `journey_relationships`, `journey_sources`, `journey_observations`, `journey_summaries`, `journey_jobs`. No changes to existing tables. |
| Explicit opt-in required | DONE | `journey_profiles.opted_in_at`; `journey_validate_source()` raises `journey opt-in required` when it is null. UI gates the whole page behind an opt-in card. |
| User confirms which participant is them | DONE | `journey_sources.subject_participant`, required in the link form. No name auto-matching anywhere. |
| User chooses/creates the relationship (romantic/friend/family/work group) | DONE | `journey_relationships.kind` CHECK + UI selector. |
| No auto-match / no bulk backfill | DONE | Sources are inserted one at a time from an explicit UI action; no batch job exists. |
| Structured observation record (owner, source kind/id, relationship, observed period vs upload date, subject participant, evidence refs, confidence, alternatives, consent, version) | DONE | Columns on `journey_sources` + `journey_observations` (`subject_kind`, `evidence_refs`, `confidence`, `alternatives`, `observed_period_*`, `consent_at`, `uploaded_at`, `version`, `adapter_version`). |
| Owner-only RLS on every Journey table | DONE | One `FOR ALL TO authenticated USING/WITH CHECK (user_id = auth.uid())` policy per table; no `anon` grant. |
| Server-side ownership validation of linked sources | DONE | `journey_validate_source()` BEFORE INSERT/UPDATE trigger checks the real owner of the decode/analysis/group_read/roast row. |
| No public Journey share route | DONE | Route is `/journey` behind `ProtectedRoute`; page is `noindex,nofollow`; no token table, no share RPC. |
| No raw transcripts in analytics/logs/localStorage | DONE | Journey code stores no message text; page emits no analytics events carrying content. |
| Correction / exclusion / removal / relationship deletion / full deletion | DONE | `excluded_at` + delete actions in UI; `journey_delete_all()` RPC (authenticated-only) removes every Journey row for the caller. |
| Derived summaries invalidate on change | DONE | `journey_bump_version()` AFTER trigger bumps relationship + profile `data_version` and sets `journey_summaries.is_stale`. |
| Late asynchronous jobs cannot recreate deleted data | DONE | Same trigger cancels pending/running `journey_jobs`; `journey_write_summary()` returns false and cancels the job when `started_from_version` no longer matches. |
| Internal helpers not directly callable | DONE | `EXECUTE` revoked from PUBLIC/anon/authenticated on both trigger functions; linter delta is +2 authenticated-only functions (`journey_write_summary`, `journey_delete_all`), both explicitly authorization-checked. |

Stage 1 verification still pending: two-account isolation and forged cross-owner
source tests are Stage 5 items and have **not** been run yet.

## Stage 2 — Source adapters (Quick Take, Deep Read, Group Read, Group Roast)

PENDING. Required behaviour, none implemented yet:
distinguish observed user behaviour / other people's behaviour / AI advice /
self-report; never treat proposed replies as sent; never treat jokes or
archetypes as psychological evidence; de-duplicate overlapping uploads; roast
adapter may use grounded pre-humor observations only; show "insufficient
evidence" instead of manufacturing it for older outputs.

## Stage 3 — Longitudinal synthesis and coaching

PENDING. Per-relationship timeline, cross-relationship view, bounded idempotent
updates, monthly review when due, suggested action → "Did you try it?" loop,
metadata-only token/cost accounting, incremental evidence aggregation.

## Stage 4 — Standalone Group Roast, Prime entitlements/checkout, mobile journeys

PENDING. Prime USD $19.99/month presented on every purchase entry; `/prime`
pre-sales page; standalone Group Roast with no prior-report prerequisite;
server-side entitlement enforcement; configurable metering (no unlimited claim).
Requires a Stripe **test-mode** Prime product/price and lookup key — not yet
created; it will not be invented, and no live-mode change will be made.

## Stage 5 — Targeted verification

PENDING. Two-account isolation, forged cross-owner source, opted-out source,
misidentified participant, duplicate/overlap, insufficient evidence,
multi-period updates, correction/deletion invalidation, late-job cancellation,
all adapters, test-mode Prime checkout success/delay/replay/cancel, legacy
subscribers, standalone roast with no prior report, mobile 360/390/430 with
keyboard and safe area, synthetic 10,000-message run. Synthetic and actual
results will be reported separately.

## Owner inputs still needed

1. Stripe **test-mode** Prime product + $19.99/month price and its lookup key
   (or approval for me to create it in test mode only).
2. Metering policy values (what the configurable allowance should be), since
   "unlimited" is not approved.

## Decision — comparison pages are search landing pages only (owner-approved)

The three competitor comparison pages stay public, indexable and unchanged:
`/compare/chatgpt-vs-betweenthelines`, `/compare/rizz-vs-betweenthelines`,
`/compare/whatbrandonthinks-vs-betweenthelines`. URLs, content, canonical
metadata and sitemap entries are preserved; they are not noindexed, robots-blocked,
gated or deleted, and they serve identical content to visitors and crawlers
(no hidden links, no bot-specific rendering).

All user-facing promotion of those pages is removed from the rest of the app:
- Removed the "Compare" link from the shared footer (`src/components/chemistry/Footer.tsx`).
- No Compare entry exists in desktop or mobile navigation, the menu, homepage,
  Explore, product input/result screens, upsells, the Prime page or checkout —
  verified by search across `src/`.
- The previously proposed contextual competitor comparisons are NOT added.
- Benefit messaging in ordinary app journeys stays BTLN-specific, with no
  competitor references and no outbound competitor links.

Visitors arriving from search or a direct link can still enter the product via the
CTA on the comparison page itself.

## Screen-by-screen ledger — mobile redesign turn

| Screen | Route | Status | Notes |
|---|---|---|---|
| Home (guest + signed-in, one variant) | `/` | DONE | Benefit-led H1 + 3 mode cards (Quick Take / Deep Read / Group Roast). Resume block only renders when the signed-in user actually has saved `analyses` rows. Old stacked heroes and the home Deep Read form removed. |
| Quick Take input | `/quick` | DONE | Existing `DecodeInput` handlers/state unchanged. |
| Deep Read input | `/deep` | DONE | Existing `InputSection` (hideIntro). Receives all legacy inbound traffic. |
| Explore | `/explore` | DONE | Group Read, Roast Us, Wrapped, pair types, sample, pricing, Journey (signed-in). |
| Prime pre-sales | `/prime` | DONE (frontend) | $19.99/month, included list, sample timeline, privacy, `return_to` same-site only. Purchase button disabled and labelled not open yet — no Stripe Prime price exists. |
| Group Roast standalone | `/group-roast` | UX DONE / ENGINE PENDING | Honest status screen, noindex, links to Group Read and pair Roast as available today. Does NOT route to source-required Roast Us. |
| Shared compact header | redesigned screens + results | DONE | Prototype-matched 58px mobile / 62px desktop shell, centered text wordmark, deterministic back control and one accessible menu. No wide desktop link row. |
| Bottom nav | `/`, `/account`, `/explore`, `/journey` | DONE | Start / My reads / Explore with equal items, active mint state, safe-area padding and >=44px targets; compact static navigation at the desktop content boundary. |
| Legacy marketing footer | home, focused product screens, results | REMOVED | No oversized logo footer, duplicate navigation or arbitrary mobile spacer on these flows. Legal and unrelated public pages retain their existing footer. |
| Prime offer at purchase entries | `/pricing`, PaywallBlur, Group Read unlock, Quick Take paywall | DONE | `PrimeOffer` hidden for active members; never starts checkout. |
| Post-result follow-through | Report, DecodeResult, GroupResult, RoastResult | DONE | `NextSteps` = repeat + cross-sell + Prime offer, entitlement-aware. |

Legacy inbound handling: `/#input-section`, `/?from=import`, `/?redo=<id>` all forward to `/deep` with the query string intact (`Index.tsx` Navigate, replace). `GroupRead` two-person handoff now navigates to `/deep?from=import`; the in-memory `handoff.ts` store is unchanged, so no raw chat touches browser storage.

Owner correction applied: the complete `Before you decide anything` section was removed from `/` and was not relocated or replaced. Header menu keeps account/sign-in, Explore, sample, pricing, About, Trust, Privacy, Terms, guides, contact and feedback reachable; competitor pages are not linked.

Checks actually run this turn: `bunx vitest run` 81/81, `tsgo --noEmit` clean, `bun run build` clean (18 static + 39 pair-type pages prerendered), Playwright at 360/390/430/1280 across `/`, `/quick`, `/deep`, `/explore`, `/prime`, `/group-roast` — no horizontal overflow at any width (scrollWidth == viewport), correct H1 per route, screenshots in /tmp/browser/home. Console errors observed are a pre-existing react-helmet-async forwardRef warning cascade, unrelated to these screens.

Still pending: Journey stages 2 and 3 (source adapters, longitudinal synthesis and coaching), standalone Group Roast engine, Prime checkout (needs a test-mode Prime product/price + lookup key), metering allowance numbers, stage 5 verification. Nothing published.

## Brand and navigation consolidation — September 17, 2026

- Added one reusable visible shell wordmark: exact `BetweenTheLines`, with capital B/T/L, 17px/700/-0.7px styling, dark `#183B35` for “Between” and “Lines,” and lighter `#528A6F` for “The.”
- The shared header keeps the approved 58px mobile and 62px desktop heights, geometric center slot, deterministic back targets, account/resources menu, and focus-visible controls.
- The legacy image-logo footer is gone. Its remaining browsing/public callers now render the shared Start / My reads / Explore navigation; focused auth, reset, result-share, input, checkout and result flows do not render duplicate bottom tabs.
- Legal pages now use the shared header and compact bottom navigation. The asset remains available only for generated share artwork; icons, metadata assets, and all pair-type illustrations are unchanged.
- Route coverage audited: home, Quick Take, Deep Read, Explore, Prime, Group Roast, processing/error, Group Read/results/share, Roast/results/share, Deep/Quick results/share, checkout, pricing, pair-type index/detail, Trust/Privacy/Terms/About, guides, sample, Wrapped, comparisons, auth/reset/callback/consent, account/Journey, admin tools, and not-found handling.
- The removed “Before you decide anything” block remains absent. Comparison routes remain direct/search-accessible and are not linked from the shared shell.
