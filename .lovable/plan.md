## Goal

Replace the single textarea inside the input card with a three-tab interface, and update the hero trust signals. No backend work, no OCR, no new dependencies.

## Files changed

1. **`src/components/chemistry/InputSection.tsx`** — main change
2. **`src/components/chemistry/Hero.tsx`** — one-line copy update

## InputSection.tsx changes

### State additions

```ts
type InputMode = "paste" | "file" | "screenshots";
type Screenshot = { id: string; name: string; size: number; dataUrl: string };

const [mode, setMode] = useState<InputMode>("paste");
const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
const [pendingMode, setPendingMode] = useState<InputMode | null>(null); // for confirm dialog
```

`form.conversation` continues to hold pasted text AND text parsed from .txt uploads (the .txt tab writes into the same textarea string — they share storage by design since both end up as text).

### Three tabs (custom, no Radix dependency needed)

A simple segmented control above the existing content area:

```text
[ Paste text ] [ Upload chat file ] [ Upload screenshots ]
```

Styled with the existing pastel tokens; active tab gets `bg-card` + border, inactive tabs are muted.

### Tab 1 — Paste text (default)

Existing textarea, unchanged.

### Tab 2 — Upload chat file (.txt)

- Drag-and-drop zone + "Choose file" button
- `<input type="file" accept=".txt,text/plain">`
- On file select: `FileReader.readAsText()` → `update("conversation", text)` → automatically switch back to "Paste text" tab so the user sees the parsed content in the textarea (with a small toast/inline confirmation: "Loaded X messages from filename.txt").
- Reject files >5MB with inline error message.
- Reject non-.txt files with inline error.

### Tab 3 — Upload screenshots

- Drag-and-drop zone accepting PNG/JPG, max 10 files, max 10MB per file
- `<input type="file" accept="image/png,image/jpeg" multiple>`
- For each accepted file: `FileReader.readAsDataURL()` → push `{id, name, size, dataUrl}` into `screenshots` state
- Thumbnail grid (3 cols mobile, 4 cols sm+): each thumbnail shows the image with a small "×" remove button overlay
- Below the grid: `"{n} of 10 images · {totalMB} MB total"`
- Disable the dropzone / file input when 10 images are selected
- Show inline errors for: wrong type, oversize, exceeding 10 images

### Tab switching with data-loss confirmation

`hasDataIn(mode)` helper:
- paste: `form.conversation.trim().length > 0`
- file: same as paste (shares storage)
- screenshots: `screenshots.length > 0`

When user clicks a different tab AND the current tab has data AND the destination uses different storage (paste/file ↔ screenshots is the only meaningful boundary, since paste and file share the textarea):

- Use the existing shadcn `AlertDialog` (already in `src/components/ui/alert-dialog.tsx`) with copy: "Switching tabs will clear your current input. Continue?"
- On confirm: clear the *source* data (`form.conversation = ""` or `screenshots = []`) and switch
- On cancel: stay on current tab

Switching between paste ↔ file does NOT prompt (they share the textarea — no data loss).

### handleSubmit

Update the console.log stub to include screenshots:

```ts
console.log("Chemistry form submitted:", {
  ...form,
  screenshots: screenshots.map(s => ({
    name: s.name,
    size: s.size,
    dataUrl: s.dataUrl, // base64 for the future Edge Function
  })),
});
```

Validation: at least one of `form.conversation.trim()` OR `screenshots.length > 0` must be present, otherwise show inline error and don't submit.

## Hero.tsx change

Line 32 — replace:
```tsx
<span>Messages deleted after analysis</span>
```
with:
```tsx
<span>Nothing stored. Analyzed in seconds, then discarded.</span>
```

Drop the surrounding "·" separators on small screens if the line gets too long; on `sm:` keep them. (The existing layout already wraps cleanly — verified the responsive flex setup handles it.)

## Out of scope (per your instructions)

- No Tesseract / client-side OCR
- No backend call — submit still just `console.log`s
- No new npm dependencies (using existing AlertDialog, native file inputs, FileReader, lucide icons)
- No edge function changes
