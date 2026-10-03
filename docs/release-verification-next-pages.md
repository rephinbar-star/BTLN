# Release verification — existing four-page build (step 4 only)

Date: 2026-10-03 UTC. Base: API SHA `0878428f2bbea98803cdde00e7c1e95fa4c13558` (four-page build preserved; no redesign, prompt, provider, price, consent, entitlement or infrastructure change). Nothing published.

Model-pipeline calls were issued only through the existing operator `prompt-improvement` `pipeline_start` / `pipeline_finalize` workflow. That workflow creates a server-issued `x-btln-test-run` token that is bound to one synthetic `@btln-test.dev` account, then sends every model call through `meteredCall` (an atomic reservation before the provider call, reconciled afterwards). The operator was the owner's own admin session, created with `lovable auth-session --self`. No customer session was used, and no customer chats or consent were touched.

Synthetic target: `iso-a-1790053620725@btln-test.dev` (`bc457bd9…`).

## Results

| # | Test | Environment | Actual evidence / result | Blocker | Data isolation | Spend (USD) |
|---|---|---|---|---|---|---|
| 1 | Quick Take real generation (`qt-plan` fixture) | Deployed `decode-conversation`, metered run `0a16478f` | 202 accepted → finalized `full_pipeline`, stage `primary` exercised (openai/gpt-6-astra), result `1f314f72` persisted | — | `evaluation_artifacts` row (quick_take, baseline); 0 untagged Journey sources | actual 0.030105 / reserved 0.44002 / reconciled |
| 2 | Group Roast real generation (`roast-planning`) | `analyze-group-roast`, run `7455d286` | `full_pipeline`: digest + primary exercised, `fresh_result: verified` (no cached reuse); roast `42592e44` | — | artifact row tagged; 0 untagged Journey sources | actual 0.037656 / reserved 0.159768 / reconciled |
| 3 | Deep Read real generation (`dr-attribution`) | `analyze-conversation`, run `c86bd504` | `partial_pipeline` (honest: long-history digest is not exercised for short input): primary, attribution and advice_check exercised; quote integrity 5 checked / 5 supported / 0 removed; attributed evidence present; raw-message deletion verified (0 `messages_temp` rows left) | 10k digest not re-run (would exceed the $1 cap; last run ≈ $1.01) | artifact row tagged; 0 untagged Journey sources | actual 0.07782 / reserved 0.386916 / reconciled |
| 4 | Batch spend total | `prompt_spend_ledger` | 6 calls, all `reconciled`, outcome `ok`, 0 unknown-cost calls | — | — | **actual 0.145581 / reserved 0.986704**; ≤ $1 cap; 0 spend in prior 24h |
| 5 | Screenshot → real extraction | `extract-chat-input` is wrapped by `withTestRun` | NOT run | The operator workflow has no action that issues a test run for `extract-chat-input` with a fictional image. An anonymous browser upload would be an unmetered customer-path model call, so it is not allowed. Prerequisite: an operator action (or `pipeline_start` case) that issues an extraction run, which is new infrastructure and not implemented here | — | 0 |
| 6 | Screenshot preparation / order (UI) | Local preview | Covered by earlier focused checks and ingest tests. Not driven to extraction (see 5) | as 5 | — | 0 |
| 7 | Paste → 3-bubble review → explicit "Which one are you?" → context | Local Chromium, signed-out, 375×812 and 1280×900, fonts ready | Quick, Deep and Group Roast: 3 initial bubbles, identity fieldset present. Deep/Group: Continue disabled until self chosen, then enabled → context ("A little about you two" / "Meet your group"). Quick: primary "Get my Quick Take" shown after review. No horizontal overflow, no page errors | Final submit not pressed: anonymous generation is unmetered | No backend function request was made during intake/review/Back (request log empty) | 0 |
| 8 | Import TXT / CSV / WhatsApp ZIP | Local, `/deep`, 375×812, fictional files | All three parsed to 3 messages with senders. CSV: Continue enabled after self. TXT and ZIP (`03/10/2026` dates): Continue correctly stays disabled until "Day first / Month first" is chosen (ambiguous-date guard). ZIP transcript selection worked | — | no function calls | 0 |
| 9 | No duplicated runs from Back/re-review | Browser request log + earlier `reviewDraft` regression | 0 function calls across review/Back. Each pipeline run produced exactly one result row | — | — | 0 |
| 10 | Pending → result rendering in browser | — | Not observed in a browser. Results are persisted (rows 1–3) but belong to the synthetic account | Browser sign-in as a synthetic account needs per-user approval: `lovable auth-session --user 2acf9fe9…` returned "requires user approval, which is unavailable in this context". Also, the browser frontend sends no test-run header, so synthetic generation from the UI is blocked by design | — | 0 |
| 11 | Relationship360 live dashboard / note save / management (UI) | — | NOT run in a browser (same approval blocker as row 10). Data snapshot of r360-a (`2acf9fe9…`): 48 sources; quarantined test sources are also excluded; eval-run sources tagged `evaluation_run_id`; 2 existing reflections. No consent change or synthesis was run | Owner approval of a synthetic-account preview session | read-only query | 0 |
| 12 | Relationship360 component/adapter tests | vitest | Included in row 13 (relationship360 + journey identity suites) | — | — | 0 |
| 13 | Focused regression suites | `bunx vitest run src/lib/ingest src/lib/group src/lib/relationship360 src/lib/journey src/lib/improvement src/lib/examples` | **27 files, 240 tests passed** (covers TXT/CSV/ZIP parsing, dedup, review-draft survival, group edits, R360 adapters/coverage/dates, metering, budget, quote integrity, owner binding) | — | — | 0 |
| 14 | Stripe checkout / unlock / webhook / lifecycle | Inspected only, no key values printed | Not exercised. `create-checkout` returns 409 "This product is not available for checkout" for current products (Quick Take/Interactive/Prime are marked "In development — not available to buy"). Client publishable key in `.env.production` is `pk_test_…`. Server has `STRIPE_SECRET_KEY` plus sandbox/live webhook secrets; their mode was not inspected. Earlier test-mode evidence exists only for the retired Duo products (`docs/verification-annual-checkout.md`) | Current products have no verified test price IDs enabled for checkout. Prerequisites: owner-approved sandbox prices for the current products, re-enabled checkout for a synthetic account, and an approved synthetic browser session. No unit or handler test is claimed as Stripe E2E | — | 0 |

## Observations (described, not changed)

- On review, the "Show full conversation" and "Edit messages" buttons render with no visible gap between them ("Show full conversationEdit messages") at 375 and 1280.
- Imported messages show raw ISO timestamps (e.g. `2026-10-03T18:01:02.000Z`) before the ambiguous-date choice is made. The guard still blocks Continue. The "Day first (3 April)" example label is static and does not reflect the file's own date.

## Outstanding prerequisites

1. Owner approval of a synthetic-account preview session (e.g. r360-a) → unblocks browser result rendering, the R360 live dashboard, note save/read-back and management at 375/1280.
2. An operator-issued metered test-run path for `extract-chat-input` with a fictional screenshot → unblocks real screenshot extraction. This is new infrastructure: proposed only.
3. Stripe: sandbox price IDs for current products plus checkout enabled for test → unblocks checkout, report unlock, webhook fulfillment and lifecycle.
4. Optional: 10k Deep Read digest re-run (≈ $1 actual, $2.08 reserved) under a separate budget.
