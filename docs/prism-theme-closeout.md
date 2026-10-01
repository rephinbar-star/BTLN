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
- `docs/design/prism-reference.md` and `.html` — inert reference notes. The full HTML came in chat, not as a file, so the `.html` is a pointer.

## Viewport checks (local Playwright, Chromium)
375×812: home, pricing, quick, deep, prime, auth, explore and sample show 0px horizontal overflow and no page errors. 320 and 1280 home: 0px overflow. At all three sizes, "Read this text" is fully visible in the first screen alongside the test-payment notice, header and bottom bar. The example dialog closes with Escape. Screenshots are in `docs/prism-theme-screenshots/`.

## Contrast (WCAG ratios)
foreground/bg 17.6 · muted text/card 9.0 · primary link/bg 7.2 · emerald text/card 11.0 · amber text/card 11.4 · lavender/card 10.6 · dark text on violet action 4.6 · on coral 5.4 · on amber 9.3 · test-payment notice 9.4 · wordmark on plate 11.3. The wordmark's "The" accent is 3.7: this is the original logo colour, left unchanged as instructed.

## Limits / open items
- Signed-in screens (Account, Journey, Relationship360 live, completed reports, paywall) were checked only through tokens and source edits, not visually. I did not sign in or bypass auth.
- I did not test PDF or image downloads in a browser. The code path switches to the light palette.
- When the menu closes with Escape, focus lands on a container rather than the menu button. This needs follow-up.
- No physical-phone check was done. Icons are unchanged by owner request.
- Typecheck passes; the managed build reports OK.
