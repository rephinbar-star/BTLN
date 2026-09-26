# Technical decisions

- Every model call made by the operator improvement workflow goes through `meteredCall` in `supabase/functions/_shared/promptBudget.ts`, which reserves its maximum cost in the database before calling the provider — so no retry, judge, proposal or sandbox call can bypass the spend cap.
- Production prompts for Interactive Mode, Group Roast and Relationship360 live in `supabase/functions/_shared/modePrompts.ts` and are imported by both the live functions and the evaluator — so evaluation baselines match what is deployed.
- Model calls use the existing OpenRouter integration; it is not migrated to another gateway without an explicit owner request — to avoid silent provider or billing changes.
- Report owners come only from `_shared/requestOwner.ts` (validated bearer; invalid token = 401, never guest) — client data and the old bundled SDK lost ownership.
- Deep Read quotations are checked verbatim against canonical messages by `_shared/quoteIntegrity.ts` before temp messages are deleted; unquoted evidence is labelled paraphrase — so invented wording is never shown as a quote.

- Test-run output is tagged server-side in `evaluation_artifacts`; candidate output is quarantined and never staged into Journey, other test output is eligible only inside a server-issued test run — so evaluation data can never leak into real profiles or aggregates.
