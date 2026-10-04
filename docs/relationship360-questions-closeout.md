# Relationship360 Questions — closeout (2026-10-04)

The approved "Ask about your patterns." design is implemented. Unpublished; no Stripe, pricing, logo or icon changes, and no gateway migration (the existing OpenRouter integration and `openai/gpt-6-astra` are reused).

## Behaviour
- **Entry:** the opted-in Relationship360 dashboard (`/journey`) shows "Ask about my patterns". It opens the protected `/journey/questions`, with the shared Header and Footer/BottomNav, and the Header back arrow works normally.
- **Live page:** heading, benefit line, question field (16px), three suggested questions, one Ask button, and an "included reads" disclosure with per-question checkboxes. Ticking boxes narrows the reads used for that one question and never changes profile inclusion. Desktop puts the question on the left and the answer on the right; mobile stacks them.
- **Answer:** a title, a short finding, optional note context labelled as the person's own reflection, a suggested next step, and expandable supporting moments. Conversation moments show the stored observation, labelled as a paraphrase. A Newsreader quote appears only when it matches a retained evidence excerpt exactly. Note moments are labelled "Your note — self-reported, not conversation evidence."
- **Explicit states:** loading, signed out (redirected to sign-in with return_to), not Prime, Relationship360 off, consent not current, no included reads, no stored observations (no model call), abstained ("We can’t answer that honestly…" with the reason), and error messages for service failure, unreadable output, the daily limit, or a scope change during answering.
- **Fictional demo:** `/examples/relationship360/questions` uses an isolated fixture with the banner "Fictional example · No live data or AI calls". It makes no network calls or writes.

## Server (`relationship360` function, new `ask` action)
- The existing bearer validation is used (no token, anon key or forged token → 401). The function then checks Prime, opt-in and current consent (version 2).
- Only owned sources with confirmed identity that are not excluded, quarantined or test-run output are eligible. Requested `source_ids` may only narrow that set; unknown, other-owner, deleted or ineligible ids reject the request (400). Client counts and content are never trusted.
- Notes come only from the selected, existing relationships. Excluded notes are never used.
- Limits: question 3–300 characters; up to 12 reads; 60 observations (fair share per read); 8 notes of 600 characters; observation statements 400 characters; 900 output tokens; a per-call cost bound of $0.58; one provider attempt with a 90-second timeout.
- Usage control: 10 questions per rolling 24 hours per account, counted with content-free `journey_jobs` rows (`kind = question_answer`). These rows are excluded from the dashboard's job state.
- Validation: model refs are mapped back server-side, and unknown refs are dropped. Notes alone, or no valid conversation ref, cause an abstain. Certainty, diagnosis and mind-reading wording causes an abstain. Change wording needs two distinct verified dates, and pattern wording needs two distinct reads.
- Commit-time recheck: if consent, opt-in or eligibility of any selected read changed during the call, the answer is withheld (409).
- Untrusted question, observation and note text is fenced, with angle brackets stripped so it cannot close a fence. The prompt is `RELATIONSHIP360_ASK_SYSTEM` in `_shared/modePrompts.ts`.
- Nothing about the question or answer is persisted or logged; only the content-free usage row is written.
- Client: any change in selection, eligible reads, consent, opt-in or notes cancels in-flight answers and clears the visible one. Status is re-checked whenever the tab becomes visible again.
- Metering: inside a server-issued test run, the call goes through `meteredOpenRouter`/`meteredCall` as stage `ask` (max 1 call per run).

## Migration
- `journey_jobs_kind_check` now also allows `question_answer`.
- Added a partial usage index.
- Added the `prompt_stage_plan` row `relationship360/ask` (1 call per run).

## Files
- `supabase/functions/_shared/r360AskCore.ts` (new, pure rules)
- `supabase/functions/_shared/modePrompts.ts` (`RELATIONSHIP360_ASK_SYSTEM`)
- `supabase/functions/relationship360/index.ts` (`ask` action; status sources now include relationship id and label; question rows excluded from job state)
- `src/lib/relationship360/ask.ts`, `src/lib/relationship360/ask.test.ts`
- `src/components/relationship360/QuestionsView.tsx`
- `src/pages/JourneyQuestions.tsx`, `src/pages/JourneyQuestionsExample.tsx`
- `src/App.tsx` (routes)
- `src/components/relationship360/Relationship360Live.tsx` (entry link)
- `src/lib/checkoutReadiness.test.ts` (type-narrowing fix only)
- `AGENTS.md`
- the migration

## Evidence
- **Tests:** `bunx vitest run src/lib/relationship360 src/lib/checkoutReadiness.test.ts` — 60 of 60 passed. They cover the eligibility gates (pending, no self, excluded, quarantined, test output), selection tampering, note separation, observation bounds, question limits, fence injection, citation and quote validity, notes-only and unknown-ref abstains, certainty/diagnosis/mind-reading abstains, change and pattern support rules, and the stale-scope key.
- **Typecheck:** `tsgo -p tsconfig.app.json` is clean.
- **Deployed function, signed-out requests:** no bearer → 401; anon key → 401; forged user token → 401.
- **Browser, fictional demo at 320, 375, 768 and 1280:** no horizontal overflow; Syne loaded with the heading computed in Syne; artwork loaded; textarea 16px; no main controls under 44px. A supporting moment opens with the keyboard (Enter). Switching suggested questions clears the fixture answer honestly. No page errors.
- **Browser, signed out:** `/journey/questions` redirects to `/auth?return_to=%2Fjourney%2Fquestions`.
- **Browser, signed in as the owner's own account (`--self`):** the "not Prime" state is shown with the example link, and "Back to Relationship360" goes to `/journey`.

## Costs
- No model calls were made in this verification: $0 spent and $0 reserved.

## Limitations (not observed)
- A real answer from the model, end to end, was not exercised. The owner account is not Prime or opted in. Synthetic test accounts need per-account session approval, which the tool requires and I did not bypass. No server-issued test run was started, because that would need the operator workflow with an eligible synthetic profile.
- As a result, server-side validation of real model citations, the 429/409 paths, and the populated live answer, loading and empty layouts on a real account are verified only by unit tests and the fictional demo.
- Prime is not purchasable, so in practice only accounts with existing Prime or Relationship360 entitlements can reach the live answer.
