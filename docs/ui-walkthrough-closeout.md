# Frontend UI walkthrough closeout (private, no publication)

Scope: presentation and routing only. The ChatGPT assistant walked through the newly published public site (not the owner directly): home chooser; Quick intake and one synthetic anonymous completed Quick Take; Deep intake/example; Group Roast/Read intake; Explore; Pricing; Prime and fictional Relationship360 preview; Wrapped; Roast Us; pair types and representative detail; signed-out account/auth; About; Trust. This record does not claim a new customer run, real relationship data, or model execution. No need to inspect every pair type individually.

## Observed defects versus review judgments

- **Directly observed:** `/examples/quick-take` returned 404; the chooser also linked to nonexistent deep-read/group-read aliases. Canonical example routes now come from the catalog; compatibility redirects keep those aliases working.
- **Directly observed:** Friend context still offered romantic-only stages. Stage/goal choices now depend on relationship category; switching clears incompatible choices while preserving supplied chat, labels, duration, and context.
- **Source-confirmed and visually checked locally:** screenshot controls crowded narrow cards; 320px fixture exposed an additional identity-choice overflow. Screenshot cards now stack, preserve filename/order/controls, and identity choices wrap within viewport.
- **Source-confirmed:** Quick result contained duplicated Deep Read/another-text prompts and a NextSteps block outside completed state. It now has one completed-result What next section; safety results omit cross-sell. Recovery actions and access logic were not changed.
- **Source-confirmed:** example modal lacked a focus trap and report headings skipped numbers; Radix handles focus/inert background/Escape/restore, and headings are descriptive and unnumbered. Deep example is explicitly a fictional report excerpt, not a complete production output.
- **Source-confirmed:** opted-in Journey profile followed management content. With current consent, the existing profile precedes add/manage controls; off/loading/reconsent/privacy pathways remain in place.
- **Expert judgment:** planned Prime/Interactive prices were easy to mistake for active purchases; unavailability and proposed-price language now precede benefits. Payment test banner uses customer language; developer docs remain in dev preview only. No checkout status, price, entitlement, or environment was changed.
- **Expert judgment:** “Nothing is stored” understated retained report excerpts. Deep intake now distinguishes raw transcript handling from selected report excerpts, without modifying legal pages or backend retention.

## Verification boundaries

Local browser at 390 and 1280px: alias redirects, deep modal keyboard focus/More/Escape/focus restoration, ten Tab moves contained by the dialog, body scroll lock, Friend stage options, pricing/Prime unavailability and no horizontal overflow; at 320px: screenshot and identity controls visible without horizontal overflow after correction. Screenshots confirmed the phone overlay is full-screen and desktop reading width is bounded. Example and uploaded-image checks used synthetic UI-only data and did not request analysis. Focused tests: 5 files, 24 passed (including chooser branches/availability, category transitions, example source fixture grounding, Quick Take next-step/safety links and existing advice recovery notice); existing recovery tests emitted React `act` warnings. Typecheck exited 0; the managed harness reported a successful build; no manual deployment was run. Authenticated account/Relationship360 customer E2E and live checkout were **not** reviewed; no auth bypass or paid analysis was used. A real protected result was not opened for this local UI review, so result-state integration beyond component tests remains unverified. No human signoff is claimed. Frontend remains unpublished by this work.

## Source-review follow-up (UX candidates for next work, not verified failures)

Code review of `src/pages/Account.tsx`, not a browser-verified customer observation or a billing audit:

- Past reports queries only the `analyses` table; decode, group-read, and group-roast results are not listed. A unified "My reads" view is a UX candidate.
- The page surfaces customer-facing Webhook events and DB-change counts, which read as developer-facing rather than customer-facing.
- `MembershipStatus` handles only monthly/annual/single/none; the account plan display is a candidate for a simpler presentation.

Defer implementation until a proper signed-in review; preserve existing permissions and payment behavior when touching this page.