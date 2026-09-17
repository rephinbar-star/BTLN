# Mobile prototype v1 — design mapping

Reference received and saved at `docs/design/BTLN-Mobile-Prototype-v1.html`.
It is a standalone simulated concept. No fake auth, payment or sample data from it
is copied into production code. Logo and animal artwork are unchanged.

## Tokens extracted (additive, in `src/index.css` + `tailwind.config.ts`)

| Prototype | Token | Tailwind |
|---|---|---|
| `--paper` #F7F8F5 | `--btln-paper` | `bg-btln-paper` |
| `--ink` #183B35 | `--btln-ink` | `text-btln-ink` |
| `--muted` #576963 | `--btln-muted` | `text-btln-muted` |
| `--line` #DCE4DE | `--btln-line` | `border-btln-line` |
| `--mint` #E5F3EC | `--btln-mint` | `bg-btln-mint` |
| `--accent` #235B47 | `--btln-forest` | `text-btln-forest` |
| `--peach` #FCE8D7 | `--btln-peach` | `bg-btln-peach` |

No existing global token was changed, so current pages keep their approved look.

## Pattern rules adopted

- System typography, headings ~33px / -1.15px tracking on mobile, body 15px.
- Cards: white, 1px line border, 19–20px radius, 18px padding, generous spacing.
- Mode/selection rows: min-height 88px, 45px mint icon tile, chevron at the end.
- Every tap target >= 44px; primary buttons 52px, full width, single primary action.
- Sticky bottom dock for the step's one action, with a small clarifying caption;
  must respect the keyboard and safe area.
- Plan selection: one selected offer card (2px forest border, tinted fill), price
  on the right, one purchase action in the dock.
- Focused input steps: one job per screen, tabs for input method, just-in-time help.

## Precedence over the prototype (owner-approved build wins)

1. Standalone Group Roast requires no prior Group Read; homepage third card is
   "Our group / Group Roast"; serious Group Read stays discoverable.
2. Prime USD $19.99/month appears on every purchase entry, with its own `/prime`
   page and contextual return to the original task. No unlimited/allowance claims.
3. Relationship Journey is actually built (private, opt-in, provenance, reviews,
   corrections/deletion, coaching check-ins) — not just presented.
4. Homepage copy carries audience/situation/benefit; benefits before payment;
   context-aware repeat/upsell/cross-sell after results.
5. Prototype prices and flows are illustrative only. Existing subscriptions,
   products and prices are preserved.

## Applied so far

- Journey relationship cards and the privacy-controls panel use the prototype
  card radius, line border and mint feature surface.

## Remaining

- Extend the system to the home cards, input/confirm steps, plans, Prime and
  the post-result cross-sell as those stages land (Stages 2–5).
