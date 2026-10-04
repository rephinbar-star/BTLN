# Relationship360 Questions — final closeout (2026-10-04)

This covers the approved "Ask about your patterns." design, with the review gaps closed. The app is unpublished. Stripe, pricing, logo, icons and the model provider are unchanged: it still uses the existing OpenRouter integration with `openai/gpt-6-astra`.

## Behaviour
- **Entry:** the opted-in Relationship360 dashboard (`/journey`) links to the protected page `/journey/questions`.
- **Header back arrow:** on `/journey/questions` it goes to `/journey`. On the fictional `/examples/relationship360/questions` it goes to `/examples/relationship360`. Every other route keeps its previous back target.
- **Controls:** one question field, three suggested questions and one Ask button. An "included reads" disclosure holds:
  - one checkbox per eligible read;
  - one checkbox per eligible private note, labelled "self-report, not conversation evidence".
- **Note checkboxes:**
  - Eligible notes are the owner's current, non-excluded notes from the selected reads' relationships, newest 8.
  - They start ticked, and any or all of them can be unticked.
  - The summary line shows the actual numbers sent, for example "Based on 2 reads and 0 notes".
  - Ticking or unticking never changes the profile.
- **Stale answers:** the visible answer, or one still in flight, is cleared and its request cancelled when any of these change:
  - the question text (this matches the demo);
  - the read or note selection;
  - a status refresh that changes consent, opt-in, or a source's server content version (identity, dates, observation versions or exclusions);
  - the text, edit time or existence of any note.
- **How cancelling works:** an `AbortController` cancels the request, and a sequence counter also ignores any late result. The scope key keeps only a short digest of note text. It is never logged or saved.
- **Quotes and dates:** a quote is shown in Newsreader only under the rule described in the Server section. Otherwise the moment is shown as a labelled paraphrase. A date is shown only when it is verified; otherwise the moment says "Date not recorded".
- **States:** loading, signed out, not Prime, off, consent not current, no included reads, no stored observations, abstained, and errors (service, unreadable output, daily limit, scope changed).

## Server (`relationship360`, `ask` action)
- **Access:** the bearer token must be valid (no token, anon key or forged token → 401). The account must then have Prime, be opted in and have consent version 2.
- **Scope read:** `loadScope` reads the profile, sources, observations and notes once.
  - Eligible reads are owned, have confirmed identity, belong to an owned relationship, and are not excluded, quarantined or test output.
  - `source_ids` may only narrow that set.
  - `note_ids` may only narrow the eligible notes, and an empty list means no notes. An id that is unknown, belongs to someone else, is excluded, or comes from an unselected relationship rejects the request (400).
- **Fingerprint:** a server fingerprint (`askScopeParts`, SHA-256) covers:
  - consent and opt-in;
  - each selected source's identity (participant and participant id), exclusion, quarantine, update time, date provenance and period;
  - each selected observation's id, version, update and correction times, actor, date, statement and evidence;
  - each selected note's id, update time, relationship and text.
- **Release check:** after the model call the scope is read again with the same ids. If anything differs, or the scope is no longer valid, the answer is withheld (409) and the usage row is marked cancelled.
- **Atomic daily limit:** the server-only function `reserve_question_usage` takes a per-account transaction lock (separate for each test-run scope), counts the last 24 hours and inserts a content-free `journey_jobs` row in one step. It returns nothing when the limit of 10 is reached.
  - Execute rights are granted to `service_role` only and revoked from public, anon and authenticated users.
  - No evidence means no reservation and no model call.
- **Dates:** a date is verified only when the source's stored `date_provenance` is `parsed` or `ocr_confirmed` (the shared intake rule) and the observation's day is valid and inside the source period.
  - Unknown, `user_supplied`, missing or out-of-range dates are sent and shown as undated.
  - A change claim needs at least two different reads whose verified days differ. Two dated observations from one read always abstain.
- **Quotes:** excerpts count as verbatim only for observations from the attributed Deep Read schema (`deep_read.*`), where ingestion copies the excerpt from the supplied message itself. Only those excerpts go to the model, in a `verbatim_excerpt` column. A returned quote is kept only if it is contained in such an excerpt. Older generated evidence strings are never shown as quotes.
- **Abstaining:** answers abstain on certainty, diagnosis or mind-reading wording, on notes-only support, and when no valid conversation reference remains. Untrusted text is fenced.
- **Storage:** nothing about the question or answer is saved or logged. Only the content-free usage row is written.

## Operator tooling (prompt-improvement, owner/operator only)
- `question_quota_probe`: runs N reservations at once for a synthetic `@btln-test.dev` account under a fresh isolated scope tag, reports the result, and deletes its rows. No model is called.
- `pipeline_start` with `r360_action: "ask"`: sends a fixed question through the existing metered test run (stage `ask`, at most 1 call) for a synthetic account.

## Migrations
- Earlier: added the `question_answer` job kind, a usage index, and stage plan `relationship360/ask` = 1.
- New: `reserve_question_usage` (security definer, service-role-only execute).

## Evidence
- **Tests:** `bunx vitest run src/lib/relationship360 src/lib/checkoutReadiness.test.ts` — 79 of 79 passed. New tests cover:
  - explicit note narrowing, an empty note list, and tampered, excluded, foreign or out-of-scope notes;
  - the trusted-date rule (unknown, user_supplied, missing, invalid, out of range);
  - a change claim from a single read with two dates abstaining;
  - two reads on the same day abstaining;
  - non-verbatim evidence never becoming a quote;
  - fingerprint sensitivity to consent, identity, statement, version, evidence and note text, and its stability across ordering;
  - the client key's sensitivity to versions, note text and note choice, and that it holds no note text.
- **Typecheck:** `tsgo -p tsconfig.app.json` is clean, and the app build is OK.
- **Atomic limit on the deployed database:**
  - 20 simultaneous reservations with a limit of 10: exactly 10 granted, 10 refused, 0 errors, 10 rows written.
  - 25 simultaneous with a limit of 3: exactly 3 granted, 22 refused. Probe rows were deleted afterwards.
  - Direct REST calls to the function with the owner's token and with the anon key: `42501 permission denied`.
- **Metered smoke test (one real model call):** run `ab1702ae-3f21-405a-bd26-2c485119aa97`, synthetic account A, baseline, eval scope.
  - Result `answered`, using 9 reads, 60 observations and 0 notes. Synthetic A's notes are not linked to the selected relationships.
  - All 4 returned refs exist, belong to synthetic A, are not excluded, and map to their stated source.
  - The two dated moments come from sources with `parsed` provenance and days inside the source period.
  - One moment from a `user_supplied` source was correctly shown as undated.
  - No quotes were returned, so none were shown.
  - The usage row was tagged with the run id and marked complete.
- **Browser at 320, 375, 768 and 1280:**
  - Signed in as the owner's own account against the real server: the "not Prime" state, and back goes to `/journey`.
  - The fictional demo, where back goes to `/examples/relationship360`.
  - Layouts for reads and notes, answered (quote in Newsreader), abstained, no evidence, error and loading, shown with fictional data served by the browser test, not by the server.
  - With every note unticked the request carried `note_ids: []` and the summary read "0 notes".
  - Editing the question cleared the answer. Changing a note while loading cancelled the request and the late answer was never shown.
  - No horizontal overflow at any width.

## Costs
- One metered call: $0.0671 actual, $0.1856 reserved, reconciled. The quota probes made no model calls.

## Limitations
- A valid citation id only proves the moment exists in the person's included, verified scope. It does not prove the finding's interpretation is true. Answers stay framed as reflections.
- The owner account is not Prime, and no entitlement was granted. No synthetic browser session was created. A populated live page on a real Prime account was therefore not seen in the browser; the populated layouts were checked with fictional data served by the browser test.
- The smoke test covered one question with no notes in scope and no quote returned. Server handling of notes and quotes on real model output is covered by unit tests only.
- The 409 release-check path was not triggered against the deployed function. It is covered by fingerprint tests and code review.
