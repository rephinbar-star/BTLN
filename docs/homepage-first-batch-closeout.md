# Homepage first batch — UI closeout (unpublished)

## Scope

- `src/pages/Index.tsx`: added a Quick Take-first headline, qualified explanation, direct `/quick` action and the existing fictional Quick example dialog above the retained situation chooser. The chooser is secondary; its three cards and More situations remain directly accessible. Quick Take has restrained mint emphasis. Prime says it is in development, cannot be bought and has a *proposed* monthly price. Added three short reassurance items and a homepage-only information footer; comparison links remain understated and outside the primary menu.
- `src/components/chemistry/Header.tsx`: put Pricing and See a sample beside Explore, removed the duplicate pricing label, and used real router links for menu destinations while retaining auth, examples, contact and feedback.
- `src/components/pricing/HelpMeChoose.tsx`: kept the shared chooser's behavior, showing its supporting line beneath the compact trigger.
- No backend, authentication, entitlement, checkout, price, analysis, consent, input processing, or recovery behavior changed. No FAQ, schema, founder photo, testimonial, counter, comparison-page rewrite, or other audit batch was included.

## Wording and routes

The privacy summary uses the careful existing Trust wording: conversation content is processed for a read, not kept as a reusable raw transcript; reports can contain selected excerpts. This avoids extending the shorter Deep intake deletion statement into an absolute promise about providers or backups. Trust, Privacy, Sample and the three existing canonical comparison routes were opened from the footer locally without a not-found page. The sample is explicitly fictional, not customer evidence. The hero does not claim to know another person's intentions; the second item calls a read a reflection, not a verdict. Prime remains a preview and is not described as purchasable.

## Local visual and interaction check

Playwright Chromium against `http://localhost:8080`; screenshots under [`homepage-first-batch-screenshots/`](./homepage-first-batch-screenshots/). This is the local app, not a new customer or physical-phone run.

| View | Observed result | Capture |
| --- | --- | --- |
| Home, 375×812 | The existing test-payment banner and header stay visible; the entire 48px Read this text action is inside the initial screen, followed by the secondary chooser. No horizontal scroll or page errors. | [first screen](./homepage-first-batch-screenshots/home-375-first.png), [footer](./homepage-first-batch-screenshots/home-375-footer.png) |
| Home, 320×812 | The primary action remains wholly on the first screen; text wraps and links/footer fit without horizontal scrolling. | Checked locally; screenshot retained in temporary browser output. |
| Home, 1280×1800 | Hero, chooser and stacked cards remain readable without horizontal scrolling. | [desktop](./homepage-first-batch-screenshots/home-1280-first.png) |
| Menu, 375×812 | Items measure at least 44px, content scrolls to the bottom, Escape closes it and focus returns to Open menu after the closing animation. Pricing link navigates to `/pricing`; ordinary links expose `href`. | [open menu](./homepage-first-batch-screenshots/menu-375-stable.png) |
| Pricing, 375×812 | Hero, test banner, plan card, price and buttons fit the viewport with no horizontal scroll or clipped price. | [first screen](./homepage-first-batch-screenshots/pricing-375.png) |
| Quick/Deep intake, 375×812 | Existing visible file, select and text controls computed at 16px; the Paste tabs expose a 16px textarea. No analysis submitted. | DOM/interaction check only. |

The existing See Example dialog opened and closed with Escape; focus returned to its trigger. No automatic playback or unsolicited modal was introduced. Footer information/comparison targets each measured 44px high, with room above fixed mobile navigation. The pricing card inspection also found no horizontal scroll at 375px.

## Checks and limits

- App typecheck: passed (`bunx tsgo --noEmit -p tsconfig.app.json`). Shared chooser regression: 7 passed (`bunx vitest run src/components/pricing/HelpMeChoose.test.tsx`). Managed preview build: **OK** in the latest available build log. No model or evaluation calls, synthetic purchase, deployment or publication were performed.
- The browser emulator cannot establish behavior of a physical phone keyboard or native image picker. No customer traffic or conversion lift is measured; outcome metrics remain proposals. No authenticated account, paid checkout or customer report flow was used. This is not human signoff.
- Final source revision is assigned by the platform's managed commit process; this closeout is part of the unpublished frontend change set. **UNPUBLISHED.**