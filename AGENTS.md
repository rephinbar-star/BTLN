# Technical decisions

- Every model call made by the operator improvement workflow goes through `meteredCall` in `supabase/functions/_shared/promptBudget.ts`, which reserves its maximum cost in the database before calling the provider — so no retry, judge, proposal or sandbox call can bypass the spend cap.
- Production prompts for Interactive Mode, Group Roast and Relationship360 live in `supabase/functions/_shared/modePrompts.ts` and are imported by both the live functions and the evaluator — so evaluation baselines match what is deployed.
- Model calls use the existing OpenRouter integration; it is not migrated to another gateway without an explicit owner request — to avoid silent provider or billing changes.
