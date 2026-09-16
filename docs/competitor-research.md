# Competitor research record

Private evidence log for every material competitor claim published on
`/compare/chatgpt-vs-betweenthelines` and `/compare/rizz-vs-betweenthelines`.
All retrievals: **16 September 2026**. Nothing here was paid for; no accounts were
created; no vendor was contacted.

Rules applied:
- Absence from a homepage is never treated as absence of a capability.
- No claim that ChatGPT "cannot" apply a framework or produce structured output.
- No clinical-validation claims for BetweenTheLines.
- No third-party revenue or user-count estimates.
- BetweenTheLines is described only by features that exist today (Quick Take, Deep
  Read, Group Read, Roast Us, pair types, imports, revocable redacted shares,
  current prices). Nothing planned (e.g. Wrapped) appears.
- Claims that could not be substantiated are listed under "Unverified — not
  published" and appear nowhere on the public site.

---

## 1. OpenAI ChatGPT

Official identity: OpenAI, `openai.com` / `chatgpt.com`.

| Published claim | Source | Evidence |
| --- | --- | --- |
| Free tier exists | openai.com/chatgpt/pricing | Pricing page lists a Free plan |
| Go US$8/month | openai.com/chatgpt/pricing, openai.com/index/introducing-chatgpt-go | Go tier listed at $8/mo |
| Plus US$20/month | openai.com/chatgpt/pricing | Plus tier listed at $20/mo |
| Pro US$200/month | openai.com/chatgpt/pricing | Pro tier listed at $200/mo |
| Accepts pasted text and file uploads | openai.com/chatgpt product pages | File upload is a documented feature |
| Can follow a user-specified framework and return structured output | Same | Stated as a capability, not denied |
| Open-ended, multi-domain assistant | Same | Product positioning |

Retrieval note: `openai.com/chatgpt/pricing/` returns **HTTP 403 to direct
command-line fetches**. Figures above were corroborated through search-result
snapshots of the same vendor pages on the retrieval date rather than a rendered
page capture. Prices are labelled with the retrieval date on the public page and
readers are told to check the vendor page.

**Unverified — not published:** any claim about ChatGPT's conversation-analysis
quality, its handling of WhatsApp ZIP exports specifically, enterprise/Team
pricing, or regional price variation.

## 2. RIZZ

Official identity: **RIZZ**, developer **TREND IT LLC**; `rizz.app`,
`web.rizz.app`; US App Store id `1663430725`; Google Play `com.rizzlabs.rizz`.

| Published claim | Source | Evidence |
| --- | --- | --- |
| AI dating-reply assistant working from screenshots | rizz.app, App Store listing | Core described workflow |
| Optionally uses a match's bio | App Store listing description | Stated feature |
| Tone options incl. a formal/professional mode | App Store listing description | Stated feature |
| iOS, iPad and Android apps | App Store + Google Play listings | Both listings live |
| 4.8 stars, ~39K US ratings | US App Store listing | Listing metadata |
| 5M+ Google Play downloads | Google Play listing | Listing metadata |
| Free to install, IAPs $3.99–$99.99 incl. $69.99 one-year | US App Store in-app-purchase list | Items observed: Unlimited RIZZ $4.99, INFINITE RIZZ $9.99 / $6.99 / $19.99 / $69.99 / $99.99 |
| Sharing "not documented on the store listing we reviewed" | App Store listing | Worded as absence of documentation, not absence of feature |

**Unverified — not published:** in-app subscription renewal terms, non-US
pricing, web-app pricing at `web.rizz.app`, data-retention specifics, and any
comparison of output quality.

## 3. What Brandon Thinks — **comparison deferred, not published**

Blocker: the vendor operates **two self-canonical domains** with different
content — `https://www.whatbrandonthinks.com` (no `/pricing`; returns 404) and
`https://whatbrandonthinks.net` (pricing present: free preview, $19.99 one-time
unlock including 3 "Ask Brandon" questions, +$4.99 per 15-question pack). Because
the official identity and canonical domain cannot be established from the vendor's
own pages, a public comparison would risk quoting prices from a domain that is not
the operator's primary property. Additionally, the testimonials on that site read
as fictional placeholders, so nothing there can be used as evidence.

Required to lift the deferral: the vendor's own confirmation (or unambiguous
cross-linking) of which domain is canonical, and a retrievable pricing page on
that canonical domain.

---

## What Brandon Thinks — primary evidence, retrieved 2026-09-16

Scope: **https://www.whatbrandonthinks.com only.** The similarly named `.net` domain is treated as
unrelated; no evidence links the two operators, so nothing from it is used.

Source pages fetched 2026-09-16:
- `/` (home) — HTTP 200
- `/faq` — HTTP 200
- `/privacy` — HTTP 200 (policy dated "Updated August 24, 2026")
- `/pricing` — HTTP 404 (no published price page)

Verified facts used on the public comparison page:
- Operator: L4Forge SAS — What Brandon Thinks, 222 rue de Brétigny, 01210 Ornex, France; SIREN
  999 235 385; support@whatbrandonthinks.com. (privacy page)
- Product: upload a WhatsApp or iMessage chat, receive an AI report written as the opinions of a
  character named Brandon; group reports include an opinion on every member. (home, FAQ)
- Imports: WhatsApp exports from iPhone or Android; iMessage via their own Mac app requiring Apple
  Silicon (M1+). FAQ states other messaging apps are "not supported yet". (FAQ)
- Free preview of the start of the first report, no card needed; thereafter pay per report. (FAQ)
- Report languages: English, French or Spanish; chat may be in any language. (FAQ)
- Follow-up questions produce further reports. (FAQ)
- Retention: uploads auto-deleted within seven days of the most recent report; abandoned uploads
  within 48 hours; reports kept until deleted; invoices ~10 years. (privacy)
- Stated: conversations/reports not used to train AI models, not sold. (privacy)

Observed but **not published** by us:
- Home-page counters ("108K total reports written", "6.9K this week", "1.2K today") — vendor-stated,
  unverifiable; we do not repeat competitor usage figures.
- Home-page testimonials — unverifiable; not repeated.
- No price figure is published on the reviewed pages, so the comparison omits their price rather
  than estimating one. Absence of a price page is not presented as absence of a price.
- Marketing/analytics pixels present (Google Ads, Meta, TikTok) — not relevant to the comparison.

Claims deliberately avoided: no assertion that they lack a capability merely because a page is
silent about it; no revenue, user-count or clinical claims; no comparison to unverified features.

## Review of existing comparison pages (2026-09-16)
- **ChatGPT page:** re-read against openai.com pricing (Free / Go $8 / Plus $20 / Pro $200, dated
  January 2026 in the footnote). No "ChatGPT cannot" claims; strengths section retained. Counting row
  describes ChatGPT output as model-generated and needing verification — a property of LLM output,
  not a capability denial. No change required.
- **RIZZ page:** store-listing figures are dated and hedged ("change over time and vary by store and
  region"); the sharing row says "not documented on the store listing we reviewed" rather than
  asserting absence. Strengths section retained. No change required.
- Both pages describe BTLN only with features that exist today (guided import, fixed report
  structure, computed counts, Group Read 3–15, revocable pseudonymous sharing, current prices).
