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
Observed behaviour, interpretation, generated advice and self-reported outcomes stay distinct.

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

### Stage 2 — Identity, automatic inclusion and user control — PENDING
- [ ] Activation consent that supersedes report-by-report opt-in; existing narrow consent is
      re-confirmed, never silently expanded.
- [ ] Mandatory "Which person are you?" per real conversation, with detected participants,
      highlighted messages, screenshot side choice, ambiguity confirmation, stable mapping.
- [ ] Users absent from a conversation cannot contribute it; never force false identification.
- [ ] Legacy reports without identity show "Identify yourself to include".
- [ ] Relationship scope (pair/group) separate from context (romantic/friend/family/work).
- [ ] Canonical source identity = source type + source id; duplicate/overlap detection; no
      auto person matching by display name.
- [ ] Source states Included / Excluded / Identify yourself to include / Updating / Failed.
- [ ] Privacy, deletion and export controls remain reachable after opt-out or Prime
      cancellation (current `Journey.tsx` hides them in the opted-in branch — fix).

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
