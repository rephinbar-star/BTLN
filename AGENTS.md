# Technical decisions

- Every model call made by the operator improvement workflow goes through `meteredCall` in `supabase/functions/_shared/promptBudget.ts`, which reserves its maximum cost in the database before calling the provider — so no retry, judge, proposal or sandbox call can bypass the spend cap.
- Production prompts for Interactive Mode, Group Roast and Relationship360 live in `supabase/functions/_shared/modePrompts.ts` and are imported by both the live functions and the evaluator — so evaluation baselines match what is deployed.
- Model calls use the existing OpenRouter integration; it is not migrated to another gateway without an explicit owner request — to avoid silent provider or billing changes.
- Report owners come only from `_shared/requestOwner.ts` (validated bearer; invalid token = 401, never guest) — client data and the old bundled SDK lost ownership.
- Deep Read quotations are checked verbatim against canonical messages by `_shared/quoteIntegrity.ts` before temp messages are deleted; unquoted evidence is labelled paraphrase — so invented wording is never shown as a quote.

- Test-run output is tagged server-side in `evaluation_artifacts`; candidate output is quarantined and never staged into Journey, other test output is eligible only inside a server-issued test run — so evaluation data can never leak into real profiles or aggregates.
- Literal source-message and verified quoted-evidence displays use the shared Newsreader `font-quote` family, while paraphrases and generated prose retain the UI font — so typography never implies that interpretation is a verbatim quote.
- Development requests for hosted asset pointers proxy through the project's preview origin — so the local Vite preview renders the same CDN artwork without bundling binaries or affecting production asset URLs.
- Shared conversation intake owns the raw-input/review/identity progression; modes supply only their subsequent context or submission action — so corrections reset identity consistently without changing analysis payloads.
- Relationship360 dashboard presentation shares scope, evidence-linked patterns and coaching primitives across fictional and live views; fictional counts never populate the real profile — so source coverage remains honest.
- Relationship360 questions are answered ephemerally by the `ask` action of the existing `relationship360` function using pure rules in `_shared/r360AskCore.ts`; only content-free `journey_jobs` usage rows persist — so questions never widen inclusion, store answers, or render unverified citations.
