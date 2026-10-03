# Illustrated four-mode homepage — unpublished closeout

## Changed

- `src/pages/Index.tsx`: approved centered hero, four complete linked cards, one collapsed fictional Quick Take example, brief reassurance, compact footer; retained recent-read, referral and legacy redirect behavior.
- `src/components/chemistry/Header.tsx`: one Examples link, compact secondary information group, menu items at least 44px high; existing wordmark and back behavior retained.
- `src/assets/home-modes/*.asset.json`: four exact uploaded illustrations as hosted WebP pointers. No mockup artwork, generated images, icons or pair-type art were changed.
- `vite.config.ts`: development-only proxy for hosted asset URLs, so local previews display the same files as the managed preview. `AGENTS.md` records this decision. `roadmap.md` marks this request complete.

## Local checks

- Chromium at 320×812, 375×812, 768×1024 and 1280×900 after `document.fonts.ready` and image decode: all four images returned 560×560, all card text fit, document horizontal overflow was 0px, Quick Take card was wholly inside the first viewport, and Relationship360's “Prime preview · In development” was visible in the card. Syne 700 loaded for the hero. Phone layout had four rows; tablet had two columns; desktop had four columns.
- Each card was one internal link, with no nested link or button. Clicked all four: `/quick`, `/deep`, `/group-roast`, `/prime`; back returned home. Keyboard Enter opened Quick Take; keyboard Enter expanded the shared example. Example quote computed to Newsreader and Browse full examples opened `/examples`.
- Menu trigger measured 44px, menu entries 46px, and bottom-nav links 58px. Pricing, Examples, Explore, About, Privacy & trust, Privacy, Terms and Guides menu destinations opened; back from Pricing returned home. `?redo=` and `#input-section` still redirected to `/deep`. No browser page errors were observed.
- App TypeScript check passed. Latest managed preview build: **build OK**. No paid checkout, analysis, model call, publication or deployment was performed.

## Limits

This was a local Chromium check, not a physical phone or customer signoff. Saved-read resume requires an authenticated account and was retained in source, not exercised with a live saved report. Hosted image URLs loaded through the development proxy in localhost; they also returned WebP from the managed preview endpoint. The frontend remains **UNPUBLISHED**.