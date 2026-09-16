# Relationship Wrapped MVP — scope and limits (2026-09-16)

Route: `/wrapped` (public route, frontend unpublished). No new Stripe products or prices; the
recap is free and does not unlock Deep/Group reports.

## How it works
- Fresh import each time via `readChatFile` (TXT/CSV/ZIP, existing ZIP-bomb and size limits) and
  `parseTranscript`. Nothing is uploaded or persisted — no raw transcript, no stats row, no share
  record. Reloading the page discards everything.
- Period chosen from `availablePeriods` — only years, quarters and months the import actually
  covers. Messages outside the selected period are excluded before any counting.
- All figures come from `computeWrappedStats` (`src/lib/wrapped/stats.ts`): arithmetic only, no
  model. Totals, per-person share and words, initiation (session = 6-hour gap, stated on the page),
  reply gaps (median), busiest day/month/weekday/hour, top emojis.

## Privacy
- Pseudonyms ("Person A/B") are ON by default; real names only if the user turns them off.
- Quotes are DEFERRED: no message text appears on a card, in any form, in this MVP. A safe
  quote feature would need per-quote consent and redaction review; not built.
- No share links. Downloads only — the audited opt-in revocable snapshot mechanism is not wired to
  Wrapped, so public sharing is explicitly deferred.

## Exports
- `src/components/wrapped/WrappedCard.tsx` renders at exactly 1080x1920 and 1080x1080 off-screen;
  `html-to-image` `toPng` with `pixelRatio: 1`. Verified end-to-end in a headless browser: both PNGs
  are the full fixed size with no clipping.

## Stated limitations shown to the user
Untimed messages excluded from time figures; unattributed messages; local-naive times when the
export carries no timezone; ambiguous date interpretation; coverage limited to the selected period.
No trends, no predictions, no pair-type evolution (needs comparable dated evidence across periods —
not implemented).

## Verification
80/80 tests (9 Wrapped stats tests), typecheck, build. Browser E2E: 1,200-message synthetic export →
period list → stats → both PNG downloads at correct dimensions; mobile 390px with no horizontal
overflow and working keyboard focus.
