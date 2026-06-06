## Plan: Add rotating GIFs above subtitle on Processing screen

**Goal:** Show one GIF per rotating message, swapping in sync every 5 seconds, on the Processing screen.

### Changes

1. **Upload the 6 GIFs to Lovable Assets CDN** and write pointer files under `src/assets/processing/`:
   - `reading.gif.asset.json`
   - `patterns.gif.asset.json`
   - `attachment.gif.asset.json`
   - `horsemen.gif.asset.json`
   - `hidden.gif.asset.json`
   - `almost.gif.asset.json`

2. **Edit `src/pages/Processing.tsx`:**
   - Convert `ROTATING_MESSAGES` from `string[]` to `{ text, gif }[]`, pairing each message with its imported asset URL.
   - Change rotation interval from `3500ms` → `5000ms`.
   - Render an **80×80px** `<img>` above the H1 ("Reading the conversation…"), keyed by index so it fades in with the subtitle.
   - Preload all 6 GIFs (hidden offscreen `<img>` set) so swaps are instant with no flash.
   - `alt=""` + `aria-hidden="true"` (decorative).

### Layout (top → bottom)
```
[betweenthelines.app logo]
[80×80 GIF]         ← new, swaps every 5s
[H1: Reading the conversation…]
[rotating subtitle] ← swaps every 5s, in sync with GIF
[loading dots]
[footer note]
```

### Decisions locked
- **Size:** 80×80px
- **Position:** Above the H1
- **Sync:** One GIF per message, cycling together every 5s
- **Hosting:** Lovable Assets CDN
