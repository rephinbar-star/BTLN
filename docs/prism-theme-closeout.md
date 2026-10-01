# Prism theme — closeout (UNPUBLISHED)

Scope: visual presentation only. No backend, auth, entitlement, payment environment, price, analytics, model or data-handling changes. The frontend has not been published. No human signoff or customer E2E is claimed.

## Changed files
- `src/index.css` — dark Prism tokens; legacy `btln-*`/pastel tokens remapped to dark-tint background + light text pairs; `btln-wordmark`/`btln-wordmark-accent` unchanged; `.theme-light` (original light palette) for exports; print reset; `prism-card`, `prism-bloom`, `prism-chrome`, `prism-text-gradient`, `wordmark-plate` utilities; native inputs `color-scheme: dark`; autofill styling.
- `tailwind.config.ts` — Syne/Plus Jakarta/JetBrains Mono families, `prism.*` and `elevated` colours, glow shadows, opacity support on core tokens.
- `index.html` — Google Fonts link, `theme-color` #8B5CF6, `color-scheme`. SEO/meta/schema untouched.
- `public/manifest.webmanifest` — theme #8B5CF6, background #0B0D17, shortcuts /quick, /deep, /group-roast. Original icons kept; no service worker.
- `src/pages/Index.tsx` — centered hero, violet/emerald/amber/lavender channel cards with full-width actions; copy, routes, chooser, examples, footer unchanged.
- `src/components/chemistry/Header.tsx`, `src/components/nav/BottomNav.tsx` — glass chrome, violet active indicator; labels and routes unchanged.
- `src/components/ui/button.tsx`, `src/lib/pricing/button.ts` — 12px radius, violet styling.
- Logo on dark backgrounds: unchanged wordmark sits on a light backplate in Header, Processing, ErrorPage and Admin.
- Exports: Report PNG/PDF capture temporarily adds `theme-light`; Roast/Group/Group Roast share cards set `theme-light`, so they keep their original light design.
- Hard-coded light colours replaced in Report, Pricing, DecodeResult, FeedbackControl, Account, CheckoutReturn, Hero, HowToHelp, AdminCards and PaymentTestModeBanner.
- `docs/design/prism-reference.md (verbatim DESIGN.md; adoption notes in docs/design/prism-adoption-notes.md)` and `.html` — inert reference notes. The full HTML came in chat, not as a file, so the `.html` is a pointer. *(Historical — superseded in round 2: both files now hold the full supplied sources verbatim.)*

## Viewport checks (local Playwright, Chromium)
375×812: home, pricing, quick, deep, prime, auth, explore and sample show 0px horizontal overflow and no page errors. 320 and 1280 home: 0px overflow. At all three sizes, "Read this text" is fully visible in the first screen alongside the test-payment notice, header and bottom bar. The example dialog closes with Escape. Screenshots are in `docs/prism-theme-screenshots/`.

## Contrast (WCAG ratios)
foreground/bg 17.6 · muted text/card 9.0 · primary link/bg 7.2 · emerald text/card 11.0 · amber text/card 11.4 · lavender/card 10.6 · dark text on violet action 4.6 · on coral 5.4 · on amber 9.3 · test-payment notice 9.4 · wordmark on plate 11.3. The wordmark's "The" accent is 3.7: this is the original logo colour, left unchanged as instructed.

## Limits / open items (round 1 — historical)

> Superseded: round 2 tested PDF/PNG downloads and print, saved the full reference files, and confirmed menu focus; round 3 reviewed completed-result components via fictional fixtures. Current open items are listed at the end of this file.
- Signed-in screens (Account, Journey, Relationship360 live, completed reports, paywall) were checked only through tokens and source edits, not visually. I did not sign in or bypass auth.
- I did not test PDF or image downloads in a browser. The code path switches to the light palette.
- (Resolved in round 2: the earlier "focus lands on a container" note was a timing artefact — see below.)
- No physical-phone check was done. Icons are unchanged by owner request.
- Typecheck passes; the managed build reports OK.

## Round 2 (base 1a4659e) — evidence-based completion

Status: frontend UNPUBLISHED. No backend, auth, billing, model, data or analytics changes. Logo artwork, colours and icon PNGs unchanged.

### Fixes
- `src/index.css`: `@media print` now redefines the full light token set on `:root` (same values as `.theme-light`), so every `text-foreground`/card/muted token prints dark-on-white. Gradient headings (`.prism-text-gradient`) print as solid foreground; ambient blooms, glows and backdrop blur are removed on paper.
- `SubScoreScale.tsx`: selected rating chip prints as bold outlined text instead of white-on-fill (browsers drop backgrounds when printing by default, which left white text on white).
- `Report.tsx` feedback button and `InviteFriendsButton.tsx`: `print:hidden` (interactive-only controls; white-on-violet failed on paper).
- `BrandWordmark.tsx` + `tailwind.config.ts` (`font-wordmark`): restores the pre-theme font from 2def9db (`-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif`, features `"ss01","cv11"`). Size/weight/spacing/colours unchanged; light backplate retained.
- `src/lib/feedback/api.ts`: `supabase.rpc` was stored unbound, so every feedback read/write threw `Cannot read properties of undefined (reading 'rest')` (seen on report pages). Now `.bind(supabase)`. Client-side call fix only; same RPCs and arguments.
- `docs/design/prism-reference.html` and `prism-reference.md` now hold the supplied HTML and DESIGN.md verbatim (inert docs; not routed, imported or served). Their claims and CDN scripts are not used by the app.

### Browser checks (local Playwright, Chromium headless)
Protected screens used disposable, uncommitted fixtures: every request to the backend host was intercepted in the test script and answered with the repo's fictional example data (`src/lib/examples/fixtures.ts`). No real network/model calls, no sign-in, no tokens, no committed demo route.
- Menu: after Escape and an 800ms wait, `document.activeElement` = `BUTTON aria-label="Open menu"`, for both mouse and keyboard (Enter) opening. The round-1 note was a timing artefact; no code change needed.
- See Example dialog: Escape returns focus to the "See Example" trigger. "More situations" sets `aria-expanded=true`, reveals its list, label becomes "Fewer situations".
- Report (Deep Read fixture) at 375/320/1280: 0px horizontal overflow; locked (paywall) and unlocked states captured.
- Downloads via the real export handlers: report PNG (169 KB) and report PDF (3.7 MB) from `Download Highlights`/`Download PDF`; Group Read share cards `group-read.png` (161 KB) and `group-role-1.png` (69 KB). All render in the original light palette with dark text (inspected).
- Print (`emulateMedia print`): body `rgb(255,255,255)` / text `rgb(18,18,18)`; 76 visible text elements in the report measured, 0 below 4.5:1. Rendered PDF page inspected.
- Screen contrast on the report: only "Give feedback" was flagged, a checker false positive (gradient background not read); measured earlier at 4.6:1.
- Inputs on /deep: all six visible fields 16px. /quick shows no text field until a mode is chosen (upload first).
- Quick Take result (DecodeResult fixture), Group Read result, Prime preview and Deep intake captured at 375.
- Page errors after the feedback fix: none.

Screenshots: `docs/prism-theme-screenshots/round2/` (home 375/320/1280, menu, example dialog, report locked/unlocked 375/320/1280, decode, group, prime, deep, print PDF page, exported PNG/PDF page, share cards).

### Still not verified
- Real signed-in screens (My reads, Journey, Relationship360 live charts, Group Roast owner result — needs sign-in, so its share card was not exercised; Group Read share cards were).
- Physical phones: real keyboard, file picker, safe-area insets.
- Stripe-hosted checkout internals.
- The managed project screenshot may still show the old published light site; the round-2 images above are the dark-theme evidence.
- Logo "The" accent remains 3.7:1 (original colour, intentionally kept).

## Round 3 (base 191bfe2) — final bounded checks

### Source changes
- `src/components/ui/button.tsx`: default and `sm` sizes now 44px high, `icon` 44×44; `lg` and explicit larger heights unchanged.
- `src/components/relationship360/Relationship360Live.tsx`: reflection textarea `text-base sm:text-[15px]` (16px on phones).
- `src/pages/DecodeResult.tsx`: safety notice uses `border-prism-cyan/50 bg-prism-cyan/10 text-foreground`; content/logic unchanged.
- `src/components/chemistry/ShareableCard.tsx`: the existing `assets/logo.png` is wrapped in the existing `wordmark-plate` light backing; image itself unchanged.
- `src/lib/feedback/api.binding.test.ts`: mocked client whose `rpc` reads `this.rest` like the real one. Bound version passes (`submit_ai_feedback`, `clear_ai_feedback`, same arguments); reverting to the unbound call reproduces "Cannot read properties of undefined (reading 'rest')". Fix kept.

### Browser checks (temporary local page, fictional data, removed afterwards; all non-local requests blocked, 0 attempted)
- Relationship360Live via its existing `recorded` prop (pattern + evidence, Then & Now, What's working, suggestion, relationship selectors, pending-identity note) and RelationshipMap at 375 and 1280: 0px horizontal overflow, 94 text elements measured, 0 below 4.5:1, no buttons under 44px, no page errors. Reflection textarea 16px at 375 (15px at 1280 by design).
- ShareableCard on the dark card: logo now sits on a light plate and is readable.
- GroupRoastShareCard downloads with the same html-to-image call as GroupRoastResult: square 1080×1080 and story 1080×1920 PNGs saved and inspected — original light design, dark text.
- Home with 44px buttons: "Read this text" bottom at 490/812 (375), 526/640 (320), 477/900 (1280); 0 overflow.

Screenshots: `docs/prism-theme-screenshots/round3/`.

## Current open limitations
- Real signed-in account: My reads, Journey management, live Relationship360 data loading/build/save, and the Group Roast result page with real data were not viewed — only their presentational components with fictional data.
- Physical phone: keyboard, photo picker, safe areas and iOS zoom behaviour not checked on a device.
- Payment provider's hosted checkout screens not reviewed (checkout remains disabled for unavailable plans).
- Logo "The" accent remains at its original 3.7:1 colour by owner instruction.
- Frontend remains UNPUBLISHED.
