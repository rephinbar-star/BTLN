# Prism typography closeout — local, unpublished

## Scope and changes

- `index.html` loads Newsreader 400 normal and italic alongside the existing Syne 700/800, Plus Jakarta Sans 400–700 and JetBrains Mono 500/600 faces. `tailwind.config.ts` exposes Newsreader as `font-quote`, with a serif fallback; the existing `font-wordmark` stack is unchanged.
- Literal message text and quoted evidence use italic Newsreader at approximately 15px/22px in `SourceConversation`, `ExampleExperience`, `SharedConversationInput`, Relationship360 evidence, `WhatYouGet`, and the Deep/Group/Group Roast/Roast result and shared result views. Existing 16px receipt quotes retain their larger size. Sender names and labels stay sans; message timestamps and the displayed confidence/source metadata use the existing mono font where edited.
- Deep Read's `evidence_kind: "paraphrase"` paths remain sans and explicitly labeled “In summary (not a quote).” Suggested replies, report conclusions, conversation prompts (suggested, not quoted source), the shareable summary card, and export-only brand artwork were not restyled as source quotes.
- `docs/design/typography-reference.md` is an inert verbatim copy of the previously supplied full Prism DESIGN reference, retained for font reference only. Its layout, security, performance and product claims were not adopted.

## Local checks

- At 375px and 1280px, `/examples/deep` and `/examples/group` rendered after `document.fonts.ready` with the **italic Newsreader**, Syne, Plus Jakarta Sans and JetBrains Mono faces loaded, no page errors, no horizontal overflow and no clipped `.font-quote` blocks. Normal Newsreader loaded on explicit request; it remains unused by the italic quotation blocks.
- The fictional Deep Read example's **More** control revealed all 12 source messages with readable sender attribution, dates and labels; the Group Read example kept its role labels separate from evidence quotations. The original wordmark computed font stack remained `-apple-system, BlinkMacSystemFont, Inter, Segoe UI, system-ui, sans-serif`.
- The homepage retained “What does this text actually mean?” and its “Read this text” button fully visible at both widths (bottom at approximately 490px/478px in a 1800px-high viewport), without horizontal overflow.
- The fictional Deep Read report was rendered to a local print PDF; text extraction confirmed the source quote remained present. A 335px-wide copied `data-pdf-section` containing fictional quoted evidence was rendered through the report's existing `html-to-image` image-export dependency on the light export palette: image 335×660, no quote-element clipping, quotation legible. This was a local disposable fixture, not a customer report or full download workflow.

## Limits

No customer analysis, signed-in report, production download, real phone or live provider flow was exercised. The frontend remains unpublished; no product facts, backend, model calls, billing, auth, data handling or artwork changed.