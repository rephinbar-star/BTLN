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

### Stage 2 — Identity, automatic inclusion and user control — PARTIALLY VERIFIED
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
- Shared ingestion now requires a participant, a confirmed screenshot side, or an explicit
  "I am not in this conversation" choice before real analysis. Group Read and Group Roast repeat
  validation server-side and reject a selected identity outside the submitted participant set.
- Still pending: a two-account browser isolation proof and a real Quick Take source-participant
  candidate contract. Updating/Failed states land with the Stage 4 job pipeline.


### Stage 3 — Quick Take response and follow-up — IN PROGRESS
- [x] "What did you send?" with paste, supported export, or follow-up screenshot with
      speaker/order confirmation; "I haven't replied" and "I chose not to reply".
- [x] "What happened next?" accepting the other person's response, an exchange screenshot or a
      reflection.
- [x] Suggestion / draft / confirmed sent reply / observed follow-up / self-report kept
      separate; provenance and versioning on the original conversation, no duplicates.
- [x] Existing upload and retention commitments preserved: screenshot OCR runs once for preview;
      continuation receives the reviewed transcript, while raw images are not persisted with events.
- [ ] Provider-backed paid addon checkout remains unavailable because no verified addon price exists.
      Server entitlement checks are implemented; external billing lifecycle verification remains blocked.

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

Stage 1 is implemented and verified. Stage 2 and Stage 3 have substantial implementation but retain
the explicit verification gaps below. Stages 4–7 remain pending; the preview is explicitly a fictional
illustration and is never presented as the working feature.

The owner-approved Introspection revision is implemented in the Stage 1 shared pattern renderer and fictional
fixture. It includes a source-grounded uncertainty example, a useful boundary/directness reflection, a sparse-data
state and an explicitly self-reported rejected alternative. All supported paths are visible inline. There is no
reflection save control because real reflection persistence and synthesis remain pending.
The Stage 4 contract and validation requirements above are recorded, but no real synthesis prompt or output validator
exists yet and none is claimed complete.

## Shared conversation ingestion — implemented foundation

| Entry point | Before | Current shared path |
|---|---|---|
| Quick Take | Paste and screenshots through a mode-specific form | Screenshots, supported chat export, paste; preview and identity required |
| Deep Read | Separate paste/file/screenshot controls | Same shared input and reviewed canonical transcript; existing relationship context retained |
| Group Read | Paste/export only | Shared screenshots/export/paste; 3–15 participant editing and date controls retained |
| Group Roast | Paste/export only | Shared screenshots/export/paste; 3–15 participant editing and date controls retained |
| Interactive Mode | Separate paste/screenshot form | Shared screenshots/export/paste appended to the same gated thread |
| Relationship360 | Existing owned reports only | New upload entry routes to Deep Read; only an eligible completed owned report can then be included |

Supported and fixture-tested export variants: WhatsApp bracketed iOS TXT, WhatsApp Android-style
dash TXT, the defined iMessage-style dated TXT, and CSV containing sender/message with optional
timestamp/direction columns. Safe ZIP accepts one selected TXT/CSV transcript, ignores media, and
rejects traversal, nested archives, excessive entry count, excessive declared size and suspicious
expansion. PNG/JPEG/WebP screenshots are accepted; HEIC/HEIF is rejected with conversion guidance.
There is no XML parser, so Android SMS XML and a universal native iMessage export are not claimed.

Canonical ingestion assigns deterministic conversation/message IDs, source provenance, parsed or
uncertain confidence, participant candidates, nullable timestamps, warnings and date coverage.
Screenshot OCR honors the uploader-confirmed side. Group screenshot OCR keeps visible sender labels
and uses "Unknown participant" instead of guessing. Users can reorder/remove screenshots and edit
the extracted speaker/order transcript before analysis. Files remain in component memory only.

Checks in this increment: TypeScript clean; 12 Vitest files / 99 tests pass, including distinct
WhatsApp/iMessage variants, ambiguity, malformed and unsafe archive cases, canonical retry IDs,
screenshot type rejection and deterministic 10,000-message parsing. Deployed `extract-chat-input`,
`analyze-group`, and `analyze-group-roast`; malformed extraction returned 400, forged Group Read
identity returned 400 before generation, invalid Group Roast auth returned 401, and one generated
two-image pair screenshot test returned three ordered messages with the confirmed right side mapped
to You. Quick Take now rejects malformed canonical participant IDs and contradictory absent-plus-
participant claims with 400 before creating or running a report. Interactive Mode validates the same
canonical membership after authentication and independently checks base-plus-addon or Prime entitlement.
This proves these rejection boundaries and the extraction endpoint, not a full paid report or every
phone UI variant.

Deep Read now sends the already-reviewed canonical transcript only. Its prior screenshot-storage
submission branch is no longer reachable, so screenshots are not uploaded and OCR'd a second time.
Quick Take and Interactive Mode likewise consume validated canonical messages directly instead of
paying for another extraction pass. Source kind and conversation/message provenance remain attached.

Still unverified: a real group screenshot extraction sample, full screenshot-to-each-mode completion,
10,000-message real model analysis through a Relationship360 adapter, mobile browser/file-picker and
draft-return matrix, encrypted-ZIP behavior, and paid provider checkout. The database linter reports
**69** SECURITY DEFINER execution warnings as of the 2026-09-22 snapshot (27 anon-executable,
42 signed-in-executable); see `docs/security-triage.md` for the object-by-object disposition. It is
not clean, and an elevated-privilege function is not by itself an exploit.

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

| 3 | Paid Interactive Mode (sent replies, ongoing exchanges, provenance) | done, except purchase | Live run 2026-09-22 against the deployed `interactive-mode` function with a synthetic entitled account: confirmed sent reply → observed follow-up (speaker order confirmed) → real contextual model response (`openai/gpt-6-astra`) that referenced the earlier read ("They suggested Thursday, which shifts the picture away from avoiding a plan") plus three fresh reply options; one thread across all events; retry with the same `client_request_id` returns the same event with no second model call (response shape normalised this run); a second account is refused with 402 and cannot list the thread. Entitlement came from a `test_fixture` provider row, NOT a purchase — checkout remains step 6. |
| 4 | Real Relationship360 adapters + synthesis engine | built and verified live (see below) | `supabase/functions/_shared/r360Adapters.ts`, `supabase/functions/relationship360/index.ts` (deployed), `src/lib/relationship360/live.ts`, `src/components/relationship360/Relationship360Live.tsx`, wired into `src/pages/Journey.tsx`; two migrations (grant `journey_write_summary` to authenticated; drop the observation-level version bump that made every build cancel itself). Live run 2026-09-22 below. |
| 5 | Private saved reflections and periodic reviews | pending | not started |
| 6 | Prime/add-on billing + entitlement reconciliation | pending | no Interactive Mode price exists with the payment provider; BYOK `STRIPE_SECRET_KEY` mode unverified in this sandbox |
| 7 | Group Roast humour pass, Playful/Spicy, share cards | pending | not started |
| 8 | Release validation matrix (isolation, injection, 10k-message ingestion, linter triage) | part done | Two-account isolation, forged-participant rejection, deletion invalidating derived state, guest-path preservation and hostile-header rate-limit bypass all run as real authenticated HTTP requests on 2026-09-22 — see `docs/security-triage.md`, which also records the two defects those runs found and fixed. Still to run: prompt injection, 10k-message upload → model analysis → adapter, mobile matrix |


## Step 4 — real engine, live verification (2026-09-22)

Run against the deployed `relationship360` function with two synthetic accounts
(`r360-a/b-1790055777@btln-test.dev`). Account A's Prime came from a `test_fixture`
entitlement row, **not a purchase**.

What actually ran:
- Two **real** Deep Reads through `analyze-conversation` (real model calls, `analyses`
  `92a90023…` and `f6eb038f…`, both `complete`), claimed to account A.
- Activation with automatic inclusion staged both as `pending`; a duplicate manual link was
  rejected by the canonical unique index.
- `journey_confirm_identity` refused an invented participant ("choose a participant from this
  conversation") and accepted "Taylor"; account B confirming A's source returned `false`.
- `build` → `complete`, coverage `{sources:2, relationships:2, observations:15}`, grounded
  narrative that explicitly refuses to over-read ("does not establish that you always do more"),
  evidence ids validated against stored observations.
- Excluding one source removed its observations (15 → 8) and marked the summary stale; the rebuild
  reported `single_read: true` with one source. Re-including and rebuilding returned to 2/15.
- `reflect` saved a private note (`{"saved":true}`).
- Denials: account B `build` → 402 "Relationship360 is part of Prime"; signed-out → 401; B reading
  A's `journey_summaries` / `journey_observations` over REST → `[]`.
- UI: `/journey` at 390px signed in as A renders the real profile — relationship chips, "Built from
  2 included conversations across 2 relationships and 1 period", underlined Insight open,
  Introspection inline, no fixture content. Only pre-existing React ref warnings in console.

Known rough edge, not hidden: automatic inclusion creates one relationship per staged report, so the
same person can appear as two relationships until the user merges or relabels them. The synthesis
says so rather than inventing a cross-relationship pattern.

Unit coverage: `src/lib/relationship360/adapters.test.ts` (6 tests) pins the attribution rules —
behaviour is the person's only when their confirmed participant is named, suggested replies stay
`ai_advice` ("not known to be sent"), self-reports stay `self_report`, Group Roast yields no
observations, group role cards map by confirmed name only. 119 tests total, `tsgo` clean.

Still pending in steps 4/5: periodic reviews driven by new evidence, and reflections feeding the
next synthesis with explicit provenance.


## Feedback-to-improvement loop (2026-09-22)

Two separate loops, both built as working code rather than a ratings UI on top of a table.

**Collection.** A shared `FeedbackControl` (outline thumbs-up / thumbs-down trigger opening a
white rounded popover with "Helpful" / "Don't Like It") rates one target at a time. One tap
records the rating; reason chips, an optional "What should we understand differently?" note and the
correction hand-off are all optional and come after. Escape closes, focus returns to the trigger,
targets are 44px+. Placements today: Quick Take overall and each of the three reply options,
each Interactive Mode turn (current and history), every Deep Read section, the Group Read result,
the Group Roast result (humour chips), and Relationship360 insight / introspection / next-step
cards. Fictional examples render inside a `demo` provider, so example ratings never reach the
product loop.

**Storage.** `public.ai_feedback`, keyed by `owner_key` (`user:<uuid>` or `session:<uuid>`) plus
source kind/id and target kind/key, with the generation id, model and prompt version captured at
rating time. A unique index makes a changed rating an update, never a second count. Ownership is
checked server-side per source kind (`ai_feedback_owns_source`), so a public share viewer cannot
rate someone else's report; an hourly cap bounds abuse. Owner-only reads; the admin aggregate is
role-checked and returns counts only — no message text, names or written feedback.

**Loop A — personal adaptation.** `get_coaching_feedback_context` returns a bounded private summary
(liked/disliked reason codes plus a few short notes). `supabase/functions/_shared/coachingPreferences.ts`
turns it into a fenced style block appended to the Quick Take and Interactive Mode system prompts.
The block is treated as untrusted preference data, not instructions, and it adjusts style only —
it can't override evidence, the rubric or speaker mapping. Account → "How your reads are
personalised" shows what is stored and offers reset and delete; both work without a membership.

**Loop B — product improvement.** `/admin/feedback` (operator-only) shows negative hotspots by
mode, section, model and prompt version with sample sizes, plus the reasons given; negative results
are never filtered out and small samples are labelled. `src/lib/eval/` holds **prototype** tooling,
not a production learning workflow, and must not be described as one: a frozen Deep Read rubric
(`rubric.ts`) checking groundedness, evidence accuracy, speaker attribution, uncertainty, absence of
diagnosis/mind-reading, refusal to adopt an unsupported user premise, coaching specificity and
repetition; `harness.ts`, which **compares outputs supplied to it** — it does not itself generate
baseline or candidate outputs from a model; `proposeCandidates`, which only surfaces issues with at
least 20 ratings and a 25%+ negative share; and `versions.ts`, an **in-memory** class holding a
version ledger for the lifetime of the process — there is no persistent, server-authorised
candidate/evaluation/audit store yet, reviewer identity is a caller-supplied string rather than an
authenticated operator, and promotion is not bound to a stored evaluated version. Building that
persistent, operator-authenticated store with immutable prompt/model/dataset hashes is open work
under Priority C. Deterministic word checks in the rubric are automated screens only; they do not
establish coaching correctness, which needs human adjudication.


**Honest status.** Feedback does not retrain a model; the UI says so. Fine-tuning is out of scope.
Automatic production promotion is off — nothing in the app promotes a prompt. Verified:
`bunx tsgo --noEmit` clean and 109 tests passing (13 files), including 10 new evaluation tests that
prove a rater-pleasing candidate fails the frozen rubric while a grounded improvement passes and can
be promoted and rolled back. Not yet verified: multi-account rating isolation in a live browser
session, the personalisation block changing a real generation end to end, and the operator
dashboard against real aggregated volume. Relationship360 controls now render against the real
engine for an opted-in Prime account; the public preview remains fictional and labelled.


## Ledger — 22 Sep 2026 (grouping, attribution, dates, safeguards)

**Implemented.**
- Automatic grouping without guessing: `journey_stage_completed_source` / `journey_auto_include`
  create an *unconfirmed* relationship carrying `conversation_key`; `journey_suggest_relationships`
  offers same-conversation and same-kind candidates; `journey_confirm_relationship`,
  `journey_assign_source`, `journey_split_source` and `journey_merge_relationships` are owner-scoped
  and mark affected summaries stale. UI: `src/components/relationship360/RelationshipGrouping.tsx`
  in `src/pages/Journey.tsx`. Unconfirmed relationships are excluded from cross-relationship claims.
- Attribution: `r360Adapters.ts` classifies by structured actor fields only. Name-inside-a-sentence
  claims become `relationship_context` with a null subject label. Quick Take reads are
  `generated_interpretation`; suggested replies are `ai_advice`; Group Roast yields no observations.
- Dates: only verified exchange dates are used; submission/analysis timestamps never stand in.
- Generation safeguards: one running job per owner/scope (unique partial index), input-fingerprint
  cache, representative (not oldest-first) selection with `omitted_observations` disclosed, consent
  and ownership rechecked at commit, evidence ids validated, recurrence claims validated against
  distinct sources / confirmed relationships / distinct dates, reflections validated against the
  caller's own summaries.

**Actually verified** (two synthetic accounts, real model calls, 22 Sep 2026):
- Grouping: suggestion offered, cross-account `journey_suggest_relationships` returned empty and
  `journey_assign_source` returned false; owner assignment merged two auto-created relationships
  into one confirmed relationship and marked the summary stale.
- Real build: `complete`, coverage `sources 2 / confirmed_relationships 1 / observations 15`,
  narrative 59 words, total visible copy 187 words, one pattern, no padded recommendations.
- Concurrency: two simultaneous builds → one `complete`, one `updating`. Third build served from
  cache (`cached: true`) with no model call.
- Updated synthesis after a later exchange: a third genuine Deep Read (analysis
  `8f30bd4d-…`) staged as *pending* in an unconfirmed relationship; a forged participant was
  refused ("choose a participant from this conversation"), "Taylor" accepted, assignment to the
  confirmed relationship accepted, `review.due` became true with `new_sources 1`, rebuild produced
  a genuinely different summary (3 sources, 23 observations, 57-word narrative) that still refused
  to claim a change.
- Reflections: saved for the owner, invisible to the second account, exclusion refused for the
  second account and accepted for the owner, forged relationship reference rejected.

**Pending / blocked.**
- `dated_observations` is 0 for Deep Read sources: staging does not carry verified message dates
  from the analysis, so Then/Now comparisons stay unavailable rather than being faked.
- Billing lifecycle remains blocked on provider test credentials (no Interactive Mode price).
- Persistent operator-authorised evaluation store, Group Roast humour pass, 10,000-message
  end-to-end run and the mobile matrix are still open.

## Dated ledger — 2026-09-22 (grouping + conversation dates + Then/Now)

Implemented
- `report_ingest_meta` now records dates for reports finished before sign-in (the
  earlier `if (!input.userId) return` dropped them silently). Deep Read parses its
  own transcript server-side; no client-supplied date is trusted.
- `journey_auto_include` is SECURITY DEFINER (anon revoked in a follow-up
  migration) so it can read that metadata; existing staged conversations were
  backfilled from retained metadata only — nothing regenerated.
- Per-source period control in `RelationshipGrouping.tsx`: parsed ranges shown as
  read; undated conversations offer "From/To", stored via `journey_set_source_period`
  and labelled self-reported, invalidating affected profiles.
- Then/Now section in `Relationship360Live.tsx` renders `coverage.comparison`,
  with named honest reasons when a comparison is not supported.
- Tests: `src/lib/relationship360/dates.test.ts` (9) covering parsed ranges,
  day/month ambiguity, unknown stays unknown, future rejection, OCR provenance,
  identical-vs-edited transcript keys, long-span claims losing dates, and an
  undated later exchange never inheriting the original period. Suite: 132 passing.

Actually verified (test account A, real model calls)
- Two dated Deep Reads (03–06 Mar 2026 and 06–09 Aug 2026) → metadata stored with
  provenance `parsed`, 8 dated / 0 undated each, ambiguity noted.
- Suggestion offered for the existing confirmed relationship rather than a silent
  merge; label confirmed; second conversation assigned.
- Build: 2 sources, 1 confirmed relationship, 14 observations, 14 dated,
  comparison available with the two real periods (7 observations each) and no
  improvement claim; narrative 46 words.
- UI at 390px: parsed ranges, "no dates could be read" period editor, and Then/Now
  under the relationship filter.

Pending / blocked
- RESOLVED 2026-09-25 for NEW Deep Reads (see "Person-specific attribution" below).
  Legacy Deep Reads without structured attribution still report no named actor.
- Concurrency-during-correction and cross-account forged-date rejection re-checks
  for this increment not re-run.
- Add-on billing still blocked: no provider test price.


## Person-specific attribution — ledger 2026-09-25

Implemented (code):
- `supabase/functions/_shared/attributedEvidence.ts` — schema v1 `result_json.attributed_evidence`: canonical
  participant ids p1/p2 (independent of names), message ids m<n>, per-message days only from the server-parsed
  export (screenshots/model-extracted rows stay undated). Deterministic, speaker-verified counts plus one bounded
  model pass (≤400 messages, ≤8 items, 1,500 tokens). Validator: unknown message ids dropped, no valid evidence →
  rejected; actor must be a supplied id AND the sender of ≥1 supporting message (otherwise downgraded to unknown);
  joint needs evidence from both speakers; interpretations stay interpretations; a claim is dated only when all
  its evidence is dated. Only ≤2 clipped (160 char) evidence lines per item are retained.
- `analyze-conversation` attaches it before temporary messages are deleted (both normal and long-history paths).
- `journey_sources.subject_participant_id`; `journey_confirm_identity` accepts `id:p1|id:p2` for Deep Read and
  refuses name-only confirmation when both people share a display name. Journey picker confirms by position.
- `r360Adapters.adaptAttributedDeepRead`: user_behavior only via the confirmed participant id (or a unique name
  match), other_behavior to the actual participant, joint/unknown/unresolved self → relationship_context,
  interpretation → generated_interpretation, suggestions → ai_advice. Legacy reports unchanged (unattributed).
- Synthesis prompt: person-specific insights must rest on user_behavior; other_behavior is context only.
  Fingerprint includes the participant id, so a correction invalidates caches (source update also bumps version).

Actually verified (live, synthetic account r360-a, Prime via test_fixture — not a purchase):
- Two real model-backed dated Deep Reads (12 Jan 2026 / 20 May 2026, deliberately opposite behaviours):
  7 attributed items each, 0 rejected/downgraded; "Alex … comment about a third party (Taylor)" stayed Alex's.
- Confirmed as p1 (Taylor) → Then 3 about you / 3 about them, Now 2 / 4; synthesis described Taylor's questions
  and one-word replies. Corrected to p2 (Alex) → every observation flipped, Now 4 / 2, new synthesis about Alex's
  non-committal answers with no Taylor conclusions carried over. Account B confirm → false; forged `id:p9` refused.
- 390px Journey view renders Then/Now counts, underlined Insight and inline Introspection.
- Unit tests: `src/lib/relationship360/attribution.test.ts` (11) — named object, quoted speech, forged ids,
  joint, interpretation, undated, same display names, absent user, advice, legacy. Suite 143 passing; typecheck clean.

(The "not tested" items from this entry are closed by the 2026-09-26 entry below.)

## Attribution review fixes + acceptance — ledger 2026-09-26

Implemented:
- One date rule. `exchangeDates.ts` `resolveDayOrder` / `resolveStampDays` is used by both ingestion
  (`deriveDateMetaFromText`) and `attributedEvidence.daysFromStamps`. Day/month order that no value proves
  ("ambiguous") or that values prove both ways ("conflict") yields NO dates — unknown until the person supplies a
  period (stored `user_supplied`, labelled self-reported). ISO stamps read as written; time/zone offsets ignored and
  timezone reported unknown; impossible calendar dates (30 Feb, 31 Apr) rejected by round-trip check. Precision is
  now `date`, not `minute`. Consequence: exports whose dates are all ≤12/≤12 (e.g. earlier 03/03 test data) no
  longer produce parsed periods.
- Evidence selection. Any unresolvable message id rejects the whole claim (`unknown_message_id`). Kept references
  (≤2) always include the actor's own message, or one message from each person for joint; the claim's period is
  computed only from the kept, shown references. Model claims carry `support: "references_and_speaker_checked"` —
  reference existence and speaker only; meaning is not machine-verified. Counts carry `support: "counted"`.
- Long-history scope. `validation.scope` records model window (last 400 messages), per-message clip (500 chars),
  `model_partial_history`, and that counts cover all supplied messages. Model claims over a truncated history are
  `scope: "recent_window"`, adapt as `*.recent_window` at low confidence, and Relationship360 coverage reports
  `recent_window_observations` with a visible line that they describe the recent stretch, not the whole history.
- Tests: 10 new (all-ambiguous, conflicting, proving value either order, ISO/date-only/offset, invalid calendar,
  actor in third ref, joint support in third ref, mixed invalid ref, support label, recent-window adaptation).
  Suite 153 passing; typecheck clean. Deployed analyze-conversation, decode-conversation, relationship360.

Verified live (test account A, Prime via test_fixture — not a purchase; account B not Prime):
- Correction during a running build: forced a real build (self p1), job observed `running` at 2.2 s, switched self
  to p2 at 4.8 s; build returned `cancelled` ("changed while this was building, so nothing was saved") at 24.1 s, job
  row `cancelled`, previous summary kept and marked stale; the p1 result was never written.
- Screenshot Deep Read: synthetic PNG → real `extract-chat-input` (10 messages; the in-image date header was not
  carried, so undated) → real Deep Read: 9 attributed items (2 counted, 7 model), 0 rejected/downgraded, all periods
  unknown, journey source `undated_count 10`. Confirmed p1 → build: 5 user_behavior (Jordan) / 4 other_behavior
  (Sam) / 3 context; corrected to p2 → build: every personal item flipped, narrative rebuilt.
- Forged `id:p7` refused (400); account B confirmation of A's source → false; B reads A's observations → [];
  B status on A's relationship → empty, non-Prime shell.
- Self-reported period saved as `user_supplied` with the self-reported note.
- Ambiguous 2024 export (all day/month ≤12) → real Deep Read: every claim and the source undated, with the
  "left unknown until you confirm" note. Historical export 14–16/03/2024 → claims dated 14/15/16 Mar 2024 from their
  own messages, source parsed 14–16 Mar 2024.

Remaining gaps:
- Attributed claims on an undated source do not inherit a later self-reported source period (they stay unknown per
  claim); legacy-extraction items do take the source period. Honest but uneven.
- Long-history (>400 messages) recent-window path verified by unit test only, not a live long export.
- 390px visual re-check not repeated this increment. Interactive copied-vs-sent still adapter-test only.

Status: person-specific attribution (#1) passes its acceptance list above.

Still pending: persistent evaluated improvement workflow (#2, next), test-only billing (blocked: no provider test
price), Group Roast humour/sharing, 10,000-message release matrix.

## BUILD #2 — persistent improvement workflow: CURRENT STATUS (2026-09-26 21:25 UTC)

This single section replaces the earlier #2 entries. Earlier results and packets are unchanged in the database.
Owner packet: **57e4fe36-0572-4e2b-bd84-04b032f83425** → supersedes 8df9c592 → 46789aa8 → 0e97aa05. Human quality review: **PENDING**.
Status: engineering gates below pass **except** the soft quality checks noted; the advice validator is still deterministic (see limits). Not an approval.

### 1 Advice recipient validation (advice-recipient-2)
- Participants: p1=Taylor (reader, person1), p2=Alex (person2). The earlier "person1=Alex" statement was wrong.
- Cause (traced in c4b22897/ac16108c): the first generation mixes recipients; the rewrite did not introduce it. Fix: fixed field-to-person binding in every Deep Read request; IDs + immutable recipient/counterpart through the rewrite; merge by ID; originals and rewrites both validated; failures withheld with a note, never name-swapped.
- v2 adds actor references around quotes: "you said/your ('x')" must be the recipient's words; "you accepted/heard 'x'", "they said 'x'", "<other>'s 'x'" must be the counterpart's. The escaped item "You accepted 'Whatever'…" in Alex's slot is now withheld; the c4b22897 fixture withholds all 4 swapped items.
- Fixtures (15 tests): escaped item, possessives, reversed order, same display names (roles, not names), joint advice, quoted third party, reorder/duplicate IDs.
- Live: style off 2ddfebaf and style on 10c56043 withhold the same single item (script pattern quoting Alex); style on rewrote 10/10 fields; quotes 9/9 and 7/7; raw deletion verified.
- Limits: deterministic pattern checks only. They do not prove meaning; advice with no quotes and no names that is meant for the other person can still pass. No metered semantic checker was added.

### 2 Evaluation data isolation (eval-isolation-1)
- `evaluation_artifacts` (server-written only; admins read) records run, candidate and variant for every test-run report, recorded by `prompt-improvement` when the run starts. Backfilled: 63 past artifacts (10 candidate).
- Candidate output is never staged; any existing source is quarantined (excluded, observations deleted, summaries marked stale). A DB trigger keeps quarantine and test provenance on any update, and observations can't be written for a quarantined source. Other test output is never auto-included and is only eligible for Relationship360 inside a server-issued test run. Feedback aggregates exclude test output.
- Verified: c9a550ad (blocked f8f27886 output) quarantined, 0 observations remain; the owner's re-include and identity confirmation leave it excluded; account B can't confirm A's source; users can't write artifacts (insert/update/delete revoked). All affected rows belong to synthetic accounts.
- Not separately built: "sandbox-approved candidate" is treated like any candidate (always excluded). The ordinary non-test Relationship360 exclusion was checked in the code and by counting rows (8 ordinary + 1 test source), not by reading the model input. User analytics events were not filtered.

### 3 10k → Relationship360 — verified
- Reused report 19b5a4e8 (run 59b99198: 10,000 supplied/analysed/read by AI in 9 slices; 300 quoted verbatim; attribution covers the recent window only, NOT all 10k).
- Identity confirmed as Taylor via the normal RPC as the synthetic user; relationship confirmed. Test-scope relationship synthesis 4503e025: 1 source, 12 observations (8 dated 2024-11-29..30, 4 undated digest-level), $0.078. Source dates 2024-01-01..2024-12-13, 10,000 dated.
- The whole-account synthesis would need more than the $0.60 per-call cap (it was refused, no spend), so a relationship-level build was used; the cap was not raised.
- Identity corrected during build (a577202c): cancelled, nothing saved; identity restored afterwards.

### 4 Long Group Read + controls — verified
- 9da8d061 (run 406000af): 3,000 messages, 3 digest slices + primary, full pipeline, $0.21. Unseen payload not adopted; the echoed warning was made generic. Failed soft check: concise.
- Attribution stage label fix confirmed in both new Deep Read runs.
- Atomic stage accounting: unchanged, as verified earlier with database fixtures; no new live race test.

### Budget and checks
- Rolling 24h $9.48 committed, **$5.52 left**; caps unchanged; 0 unknown-cost calls.
- 235 tests pass. `/admin/improvement` at 1280 and 390 px: no errors, no sideways scrolling, packet v4 visible. The review page labels every result "full-pipeline", even partial ones (display issue). The Relationship360 long-history screen was not checked in the browser.

### Open
Deterministic-only advice validation; the review page's parity label; Relationship360 long-history screen check; owner review. Separately queued: billing, 77 older security warnings, Group Roast expansion.
