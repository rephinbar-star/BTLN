# Relationship360 — approved build specification and staged checklist

Relationship360 is Prime's longitudinal benefit. Prime stays USD 19.99/month. It combines
eligible completed reports (Quick Take, Deep Read, Group Read where available, Group Roast)
into evidence-grounded observations about the identified user over time.

Internal names (`journey_*` tables, `/journey`, `src/lib/journey/*`, example kind `journey`)
are kept as compatibility aliases. `/journey` and `/examples/journey` must keep working.

## Approved exact copy

- Feature: **Relationship360**. Personal dashboard: **Your Relationship360**. Public example:
  **Relationship360 Preview**.
- Headline: "Understand who you are in your relationships—and get insights and coaching for
  self improvement."
- Supporting: "See the patterns in how you communicate, respond, and connect—with practical
  coaching that develops as you add more conversations."
- Labels: "Suggested next steps", "Suggestions for next time", "Did you use this suggestion?",
  "Suggested response".
- Question 5: "What can I do next?"
- Result connection: "See how this shapes your Relationship360."
- After successful inclusion: "Added to your Relationship360" / "See what this conversation
  contributes to your patterns and next steps." / "View my profile" / "Exclude this
  conversation". Show *Added* only after real successful processing; otherwise *Updating* or an
  actionable error.
- Never use "try" in Relationship360 marketing, recommendations or buttons. Use *practical
  coaching*, not *practical guidance*.

## The five questions

1. What am I noticing in my relationships?
2. What keeps happening?
3. What has changed?
4. Does this happen with different people?
5. What can I do next?

## Recommendation rules

Several useful actions when supported; aim for at least one communication and one behavioural
recommendation **if applicable**. Never fill slots with invented advice. Include "What's
working" backed by evidence, especially where no change is needed. Each recommendation states
observation, suggested action, why it may help, supporting evidence. No diagnosis, no certain
mind-reading, no unsupported health scores, no claim of clinically validated assessment.
Observed behaviour, introspection questions, generated advice and self-reported outcomes stay distinct.

## Introspection coaching contract — owner-approved revision

- Pattern details use **Introspection**, never a passive motive interpretation. The observation and its evidence stay
  separate from any question about what drove it.
- Introspection opens with one question about the person's experience, followed inline by zero to three plausible
  reflection paths only when the cited evidence makes them relevant. Each path links feeling, interpretation, need and
  action through questions; neither the Insight nor its paths requires a click to read.
- Ask what the behaviour accomplished immediately and what it cost or changed over time. Invite the person to decide
  what fits, reject a path, or name another explanation. Boundaries, kindness and useful strategies receive meaningful
  reflection too; no pattern is automatically framed as unhealthy.
- End with an optional focused reflection connected to an applicable suggested next step. No mandatory questionnaire
  and no fake save control. Any future saved answer must remain private, optional and explicitly self-reported; it
  cannot become observed evidence or confirmation merely because a person selected a question.
- Contract: `introspection { openingQuestion, paths[{ label, questions, evidenceRefs }], closingQuestion,
  focusedReflection?, suggestedNextStepId?, selfReportedReflection? }`. Path evidence references must be authorized and
  valid after source exclusion. Old summaries without this field receive one neutral reflection prompt or an explicit
  regeneration path; do not invent detailed motives/evidence and do not bulk regenerate paid summaries.
- Stage 4 synthesis must generate and validate this strict shape, reject diagnostic conclusions and unsupported paths,
  preserve confidence/limitations/alternatives metadata, and keep reflection responses outside observation records.

## Editorial and default-reading contract — owner-approved revision

- One canonical detailed home per insight. Overview, relationship/time filters, Then / Now, monthly review and return
  states may link to or activate that insight, but must not repeat its explanatory prose.
- Default overview: one meaningful headline plus at most three distinct linked takeaways, about 60–90 words maximum
  when enough evidence exists and less when sparse. Show up to three prioritized, meaning-level distinct pattern cards;
  put further genuinely distinct patterns behind **More insights**. This is a maximum, never a quota.
- A pattern shows a short title, one sentence about why it matters, observed period and its change/evidence state. Its
  underlined, noninteractive **Insight** heading, grounded observation, open coaching question and up to three supported
  reflection paths are visible in the normal reading flow. Evidence alone remains under **Why we're showing this**.
- Suggested next steps contain at most three meaning-level distinct communication/behavioural actions, each with a
  short reason and expandable evidence. A pattern links to its canonical recommendation instead of restating it.
  What's working is omitted when it repeats a canonical pattern; no praise or action is generated to fill space.
- Then / Now and monthly review are purposeful, user-opened views. Since your last review contains only newly supported
  developments; visiting or time passing creates no change.
- Default visible narrative has a soft maximum of 250–350 words, excluding labels/navigation and collapsed source
  evidence. Evidence, uncertainty, counterexamples and original source messages remain available and are not truncated
  to meet that count.
- Generation/editorial pipeline rules for Stage 4: every section must add new information or a different interaction;
  assign a stable `semanticKey`, prioritize before rendering, deduplicate by meaning (not string), avoid reusing a quote
  across cards, and validate title/reason/action lengths plus card/path maxima. Use the existing generation call and a
  deterministic editorial pass; do not add a second model call per view. Avoid formulaic openings, conclusions,
  repeated “you tend to” paraphrases, hype, flattery and motivational filler. Preserve qualifications near each claim.
- Compatibility: `semanticKey`, `priority` and `whyItMatters` are optional when reading old summaries. Missing fields
  fall back to the existing id/order/statement; old history is not automatically regenerated.

## Staged acceptance checklist

### Stage 1 — Shared mobile UX + complete interactive preview — DONE
- [x] Shared typed display components usable by both real and fictional data: overview, period
      timeline, relationship cards, pattern/evidence detail, communication and behavioural
      recommendations, what's working, action check-in, source management.
- [x] Public Relationship360 Preview from one fictional person's dating, friendship and family
      group relationships across multiple periods, with recurrence, meaningful change, a
      counterexample, supported recommendations, a self-reported outcome and an interactive
      source-exclusion demonstration that recalculates only the fictional sample.
- [x] Source messages shown with underlined More/Less; all evidence resolves to a real message
      in the supplied fixtures (no fabricated before/after statistics).
- [x] Period and relationship switching, evidence disclosure, resettable local demo state, no
      account writes and no AI calls.
- [x] "Fictional example" + "In development" labelling while the backend is pending.
- [x] Menu entry "Relationship360 Preview"; underlined "See Example" on /prime and the profile
      entry screen; same renderer in route and modal; drafts preserved by the existing modal.
- [x] `/examples/relationship360` plus legacy `/examples/journey` and `/journey`.
- [x] 360 / 390 / 430 / 1280 verification, typecheck, build.

### Stage 2 — Identity, automatic inclusion and user control — IMPLEMENTED (browser-verified 2026-09-22)
- [x] Activation consent (`journey_activate`, consent_version 2) supersedes report-by-report
      opt-in; profiles on an older consent version see a re-confirm card and are never silently
      widened.
- [x] Mandatory "Which person are you?" per conversation, offering participants detected
      server-side (`journey_source_participants`: Deep Read name1/name2, Group Roast labels) plus
      a free-text option; nothing is matched automatically by display name.
- [x] "I am not in this conversation" (`journey_mark_absent`) keeps the conversation out
      permanently; the validate trigger also rejects inserting an absent source.
- [x] Legacy and auto-included sources sit at `identity_status = 'pending'` and read
      "Identify yourself to include"; they contribute nothing until confirmed. The Group Roast
      journey adapter only runs once identity is confirmed.
- [x] `journey_relationships.scope` (pair/group) is stored and shown separately from `kind`
      (romantic/friend/family/work_group/unspecified).
- [x] Canonical source identity enforced by `journey_sources_canonical_idx`
      UNIQUE (user_id, source_kind, source_id) — duplicates cannot be linked twice.
- [x] Source states: Included / Excluded / Identify yourself to include / You are not in this
      conversation (`sourceState`, unit-tested in `src/lib/journey/__tests__/identity.test.ts`).
- [x] Privacy, opt-out and delete controls render outside the opted-in branch, so they stay
      reachable after opt-out or Prime cancellation; linked sources stay listed and correctable.
- Not yet: highlighted sample messages and screenshot side-choice inside the identity prompt
  (the report record exposes participant names, not per-message sides) — Updating/Failed states
  land with the Stage 4 job pipeline.


### Stage 3 — Quick Take response and follow-up — PENDING
- [ ] "What did you send?" with select-then-confirm, paste, or follow-up screenshot with
      speaker/order confirmation; "I haven't replied" and "I chose not to reply".
- [ ] "What happened next?" accepting the other person's response, an exchange screenshot or a
      reflection.
- [ ] Suggestion / draft / confirmed sent reply / observed follow-up / self-report kept
      separate; provenance and versioning on the original conversation, no duplicates.
- [ ] Existing upload and retention commitments preserved.

### Stage 4 — Grounded profile engine — PENDING
- [ ] Server validation of ownership, mapped participant, activation consent, entitlement.
- [ ] Adapters: Quick Take signals, Deep Read patterns/stats/evidence, Group Read individual vs
      group, Group Roast pre-humor facts only (jokes are never evidence).
- [ ] Versioned observations with source ref, subject, real observed period, confidence,
      limitations, alternatives, adapter version; dedup without retaining raw text.
- [ ] Relationship and cross-relationship synthesis with the stated evidence thresholds.
- [ ] Bounded idempotent jobs, incremental computation, cached unchanged summaries, validated
      model output, prompt-injection resistance, late-write rejection by version.
- [ ] Empty / loading / insufficient / error / retry states.

### Stage 5 — Actions, reviews, Prime — PENDING
- [ ] Multiple applicable suggestions, optional self-reported check-ins, no invented praise.
- [ ] Monthly review on next visit only with fresh data; no unsolicited email or push.
- [ ] Prime USD 19.99 at existing entry points, return intent preserved through auth, checkout
      and webhook; server entitlement checks; legacy purchase access preserved.
- [ ] Configurable internal caps and cost telemetry; no invented allowance, no "unlimited".
- [ ] Test-mode billing verification of checkout → webhook → entitlement, duplicate webhook
      idempotency and cancellation.

### Stage 6 — Group Roast humor and sharing — PENDING
- [ ] Sharper, evidence-backed callbacks, contradictions, escalation, distinct humour per
      participant; Playful/Spicy intensity; quality pass against repetition and invented claims.
- [ ] Individual share cards and group verdict with preview/redaction before sharing; no
      automatic publishing.
- [ ] Comedy separated from factual evidence; humour never enters the profile.

### Stage 7 — Release validation — PENDING
- [ ] Isolation, forged ids, deletion during running jobs, overlap, evidence mismatch, prompt
      injection, absent user, missing dates, no-recommendation case, copied-not-sent reply,
      three relationships across periods, repeat upload, corrected participant.
- [ ] 10,000-message synthetic ingestion → analysis → adapter with recorded real results.
- [ ] Responsive, keyboard, More/Less, draft preservation, noindex, telemetry without text,
      Stripe test lifecycle, database linter triage.

## Status

Stage 1 is implemented and verified. Stages 2–7 are not started; the preview is explicitly a
fictional illustration and is never presented as the working feature.

The owner-approved Introspection revision is implemented in the Stage 1 shared pattern renderer and fictional
fixture. It includes a source-grounded uncertainty example, a useful boundary/directness reflection, a sparse-data
state and an explicitly self-reported rejected alternative. All supported paths are visible inline. There is no
reflection save control because real reflection persistence and synthesis remain pending.
The Stage 4 contract and validation requirements above are recorded, but no real synthesis prompt or output validator
exists yet and none is claimed complete.

The concise editorial revision is also implemented in the shared Stage 1 components and preview. Overlapping fixture
claims collapse by `semanticKey`; overview and monthly review link to canonical pattern/recommendation details; Insight
and Introspection render inline while evidence, Then / Now and monthly-review content progressively disclose. The same contracts are ready for
the real renderer, but the real synthesis/summary reader remains Stage 4 work and is not presented as complete.
On the long fictional fixture, the default page fell from 1,598 to 810 visible words overall; the report's default
visible narrative is 192 words (source controls, labels and navigation excluded), within the 250–350-word maximum.

## Stage 1 — delivered (implementation, not just spec)

Files added:
- `src/lib/relationship360/preview.ts` — one fictional person ("Rae") across three
  relationships (romantic pair, friend pair, family group) and three periods
  (March / June / September 2026), six source conversations. Every pattern,
  what's-working item and recommendation cites a message id present in these fixtures.
- `src/lib/relationship360/select.ts` — `QUESTION_LABELS` (the five approved questions),
  `resolveEvidence`, and `computeR360View`, which recalculates what may honestly be
  shown when sources are excluded: recurrence needs ≥2 independent periods,
  cross-relationship claims need ≥2 relationships, otherwise the claim is withheld
  with a stated reason rather than softened.
- `src/components/relationship360/display.tsx` — shared typed display components used by
  both fictional and (later) real data: Overview, PeriodTimeline, RelationshipCards,
  PatternDetail (disclosable evidence, introspection questions and counterexample kept separate),
  WhatsWorking, RecommendationCard ("Suggestions for next time", "Suggested response",
  "Did you use this suggestion?", self-report labelled), SourceManager (Included /
  Excluded with the full source conversation and More/Less).
- `src/components/relationship360/Relationship360Preview.tsx` — interactive preview with
  period/relationship switching, evidence disclosure, local check-ins, source exclusion
  and "Reset this demo". Local state only: no account writes, no AI calls.
- `src/lib/relationship360/preview.test.ts` — evidence/fixture consistency, ≥3
  relationships and periods, recurrence withheld when its second period is excluded.

Files changed:
- `src/lib/examples/catalog.ts` — example renamed to "Relationship360 Preview",
  route `/examples/relationship360`, CTA points at `/prime`. Internal kind stays `journey`.
- `src/App.tsx` — added `/examples/relationship360`; `/examples/journey` kept as alias.
- `src/components/examples/ExampleExperience.tsx` — journey kind now renders the shared
  Relationship360 preview; generic "Try …" CTA suppressed for it (no "try" wording).
- `src/pages/Prime.tsx` — approved headline and supporting copy, Relationship360 naming.
- `src/pages/Journey.tsx` — "Your Relationship360" naming; privacy controls (turn off,
  delete) moved out of the opted-in branch so they remain reachable after opt-out, with
  the distinction from source-report deletion stated.
- `src/pages/Index.tsx`, `src/pages/Explore.tsx` — Relationship360 naming, "practical coaching".

Checks actually run: `tsgo --noEmit` clean; vitest 86 tests pass; production build OK;
Playwright at 360/390/430/1280 on `/examples/relationship360` and the `/examples/journey`
alias — correct H1, no horizontal overflow, evidence disclosure, exclusion producing a
"Withheld after your changes" note, and reset restoring the full profile.

Still pending: Stages 2–7 (identity/automatic inclusion, Quick Take follow-up, grounded
profile engine, actions/Prime billing, Group Roast humour pass, release validation).
Prime billing remains switched off; no Stripe test credentials are configured.

## Stage 1 visual steering (owner addition) — delivered

Implemented in the fictional preview with shared components ready for the real profile:

- `src/components/relationship360/RelationshipMap.tsx` — "Your relationship landscape". "You" in the
  centre, relationships on equal-length, equal-weight spokes; position encodes nothing. Tap filters the
  whole profile. Equivalent list view (forced above four relationships), 44px targets, `aria-pressed`,
  "Show everyone" reset.
- `R360WhatsNew` — one supported change, one recurrence, one "what's working"; each with a conclusion,
  the observed period and expandable evidence. Unsupported slots are omitted, never filled.
- `R360ThenNow` — Then/Now period buttons, one observation and real coverage per side, evidence, and
  counted metrics only (label, unit, value **of** denominator, missing-data note). No 0–100 scores, no
  radar, no progress rings.
- `R360StateChip` / pattern cards — "Noticed again", "Different this time", "Not enough to compare",
  plus observed range and an explicit exception line. Text carries the meaning; colour never alone.
- "Since your last review" — compares the last *viewed* source set against the current one. Time passing
  or revisiting changes nothing; honest "No new conversations since your last review" state. No streaks,
  countdowns or notifications.
- Monthly review — a short story sequence (what repeated / what changed / what to continue / suggested
  next step) rendered only when at least two new conversations have been included. Extra uploads are
  never described as growth.
- Demo states in the preview: One conversation (sparse), First review, After new conversations. Absent
  conversations are treated exactly like excluded ones, so unsupported claims are withheld.
- Motion: `transition-colors` with `motion-reduce:transition-none` throughout.
- Analytics (no names, messages or insight text): `profile_viewed` (first/returning),
  `relationship_filter_used`, `comparison_opened`, `evidence_opened`, `recommendation_selected`,
  `checkin_completed`, `source_added`.

Verified: tsgo clean, 86 tests, build OK; Playwright at 360/390/430/1280 — no horizontal overflow, all
sections present, map filter → list view → period comparison → next step interaction completes,
screenshots captured. Still fictional and labelled in development; Stages 2–7 pending.

## Pricing page correction (verified coverage)

Server-audited entitlements behind every matrix cell:
- Quick Take (`useDecodeAccess` + `count_completed_decodes`): any active subscription lifts the one-free-read limit.
- Deep Read (`user_has_paid_access`): tiers monthly/annual, or a one-time unlock bound to that analysis.
- Group Read (`analyze-group` FULL_PLAN_TIERS): monthly/annual, or a `group_read_unlocks` row.
- Group Roast (`group-roast-data`): monthly/annual, or a `group_roast_unlocks` row. Group Read access does NOT grant it.
- Relationship360: no entitlement exists; engine in development, Prime not purchasable.

Quick Take plan price key: `BTLN_decode_monthly`, $6.99/month — matches `DecodeResult.tsx` and docs/audit-reconciliation.md.
NOT verified against live Stripe (no STRIPE_TEST_SECRET_KEY in the sandbox); no price or product was created or changed.
One-time $4.99 stays report-bound: the pricing CTA opens a mode chooser (/deep, /group, /group-roast) instead of charging an unbound report.
"Most popular" badge removed (no usage data). Prime rendered as a full pricing card (36px price, mint background) with its in-development status and current-plan note for members.

## Owner-approved commercial revision (2026-09-22) and eight-step ledger

### Decisions recorded
- **Interactive Mode** is the name for continued Quick Take exchanges. It is a **$2.99/month
  add-on** on top of the **$6.99/month** Quick Take plan (**$9.98/month combined**), never sold
  standalone. Base Quick Take = one initial read plus three suggested replies. Interactive Mode =
  continue the same conversation with the reply actually sent, later screenshots, and updated
  reads/replies, keeping generated / draft / copied / sent / self-reported distinct.
- **Prime $19.99/month includes everything**, Interactive Mode and Relationship360 included. A
  Prime member is never upsold.
- **Entitlement audit (current server truth, unchanged by this revision):** Quick Take metering is
  `count_completed_decodes` + "any active subscription" (`useDecodeAccess`); Deep Read is
  `user_has_paid_access`; Group Read is `analyze-group` FULL_PLAN_TIERS (monthly/annual) or
  `group_read_unlocks`; Group Roast is `group-roast-data` (monthly/annual) or `group_roast_unlocks`;
  Relationship360 has **no** entitlement. Therefore **Interactive Mode must become its own
  entitlement**: existing monthly/annual/decode_monthly subscribers must NOT gain it through the
  current "any active subscription" rule. Legacy access to everything they have today is
  grandfathered and must not be revoked.
- **Single report ($4.99) stays report-bound.** It grants no Quick Take session, so the Quick Take
  row of the Single-report column states the real status ("Not included — first session free")
  instead of the requested "1 single session" label, which the server does not support. Reported as
  an explicit mismatch rather than advertised.
- **Relationship360 coverage:** exactly "Not Included" on every non-Prime plan; Prime shows
  "Included in Prime · In development" until the real engine ships.
- No live billing, no publication, no silent migration of existing subscriptions.
- **Pricing UX revision (2026-09-22):** Interactive Mode is not a standalone pricing card or
  comparison-plan column. It appears inside the Quick Take card as an optional, unchecked
  checkbox. Selecting it shows the explicit $6.99 base + $2.99 add-on = $9.98/month intent and
  preserves that intent through the guide/auth URL; because no verified test add-on price exists,
  the combined purchase stays disabled while base Quick Take remains separately purchasable.
  Prime/current add-on states render as included/current and cannot be double-selected.

### Eight-step completion ledger
| # | Step | Status | Evidence / blocker |
|---|------|--------|--------------------|
| 1 | Close browser verification (inline Insight/Introspection, pricing corrections, guide, menus) | done | Playwright 360/390/430/1280/1440: inline Insight + Introspection with no toggles, pricing centred; Help me choose on home + pricing with focus restore; menus exclude Roast Us/Wrapped; later pricing revision folds Interactive Mode into Quick Take instead of a separate card; tsgo clean, build OK |
| 2 | Participant confirmation, inclusion consent, identity pending state | done | Migration (consent fields, scope, identity_status, canonical unique index, rewritten validate trigger, 5 RPCs); `src/lib/journey/{api,types}.ts`, `src/pages/Journey.tsx`; 6 new unit tests (96 total); signed-in Playwright run: activation brought in 9 owned reports as pending, real participants "Maya/Jonas" offered, confirm → Included (9→8 pending), "I am not in this conversation" → excluded (→7); test rows removed afterwards |

| 3 | Paid Interactive Mode (sent replies, ongoing exchanges, provenance) | pending | requires step 6 entitlement first |
| 4 | Real Relationship360 adapters + synthesis engine | pending | fixtures only today |
| 5 | Private saved reflections and periodic reviews | pending | not started |
| 6 | Prime/add-on billing + entitlement reconciliation | pending | no Interactive Mode price exists with the payment provider; BYOK `STRIPE_SECRET_KEY` mode unverified in this sandbox |
| 7 | Group Roast humour pass, Playful/Spicy, share cards | pending | not started |
| 8 | Release validation matrix (isolation, injection, 10k-message ingestion, linter triage) | pending | not started |
