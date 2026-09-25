# Roadmap

- [x] Add expandable fictional source conversations to every product example.
- [x] Reconcile source fixtures with evidence, participants, periods, counts, and statistics.
- [x] Verify direct-route/menu/dialog parity, accessibility, and 360/390/430 layouts.
- [x] Update sample coverage documentation.
- [x] Replace homepage modes with situation-led choices and an honest Prime preview.
- [x] Verify homepage actions, expansion controls, and responsive layouts.
- [ ] Interactive Mode add-on: entitlement, purchase prerequisite, lifecycle (step 6 then 3).
- [x] Relationship360 real adapters + synthesis engine (step 4) — built, deployed and verified live on 2026-09-22 with two synthetic accounts and two real model-backed Deep Reads (see docs/relationship360-build.md).
- [x] Automatic relationship grouping: reuse of a confirmed relationship by stable conversation key, suggestions with one-tap confirmation, assign/separate with rejection memory (2026-09-22).
- [x] Conversation dates preserved end to end (ingest metadata → staged source → observations) and a real Then/Now from two dated periods (2026-09-22).
- [x] Deep Read structured actor attribution (2026-09-25, verified live; legacy reports stay unattributed).
- [x] Participant confirmation and inclusion consent (step 2).
- [ ] Saved reflections and periodic reviews (step 5).
- [ ] Group Roast humour pass (step 7).
- [ ] Release validation matrix (step 8).
- [x] Shared ingestion foundation across Quick Take, Deep Read, Group Read, Group Roast, Interactive Mode, and Relationship360.
- [ ] Finish browser and real-pipeline verification for shared ingestion (parser/unit coverage and pair OCR verified; full mode matrix pending).
- [x] Feedback-to-improvement loop: shared rating control, owner-scoped storage, personal coaching adaptation in Quick Take/Interactive prompts, operator aggregate view, frozen-rubric evaluation prototype (in-memory, not a persistent operator-authorised workflow — see docs/relationship360-build.md).
- [ ] Verify the feedback loop end to end in a browser (two-account isolation, personalisation changing a real generation, operator view with real volume).


## 2026-09-22 verification run
- [x] Guest screenshot reading metered by a global hourly budget that forged network headers cannot split (hostile-header test: 70 spoofed addresses, cut off at the ceiling).
- [x] Screenshot overlap no longer deletes legitimate repeated messages; only demonstrated seam overlap or same-timestamp duplicates are merged, ambiguity is surfaced.
- [x] Two synthetic accounts: cross-account read/rate/undo/export/exclude/identity all refused; two real defects found and fixed (browser-id read of an owned report; deleted reports leaving Relationship360 state behind).
- [x] Interactive Mode proven live end to end on an entitled synthetic account, including same-thread continuation, retry idempotency and refusal without entitlement.
- [x] Priority B: real Relationship360 adapters, synthesis engine, grouping and dated Then/Now.
- [ ] Priority C: billing lifecycle (blocked on provider test credentials) and persistent operator-authorised evaluation store.
