# Group Read — end-to-end MVP

## What I found in the current app (inspection results)

Reusable and working:
- Quick Take lane (`decodes` table + `decode-conversation` function) is a clean template: guest session ownership, background processing, status polling, security-definer read function.
- Text parsing helper (`_shared/extractMessages.ts`) plus robust JSON extraction, and the AI call wrapper with retry.
- Guest-then-claim ownership model (session id in local storage, claim on sign-in).
- Privacy-safe analytics with a strict event allow-list, and a consent banner.
- Share card image export (1:1 and 9:16) with native share and download.

Missing dependencies (honest report — these must be built here, not reused):
- **No recipient-claim foundation exists.** The only "claim" today converts a guest's *own* analysis to their account. There is nothing that lets a named participant claim a position in someone else's report. So this task delivers the safe alternative the brief allows: a redacted public share plus a "start your own read" call to action. No fake claim flow.
- **No share-token system exists.** Today's public sharing exposes a report by its id. Group Read gets its own unguessable, revocable token.
- **No group-aware ingestion.** Current parsers collapse everyone into "you" and "them".
- **No group entitlement.** Existing paid plans are dyadic/Quick Take. Group Read ships free-to-run with a server-side rate limit; no price, plan or Stripe object is touched. If the owner later wants it paid, that is a separate decision — this plan surfaces it rather than silently offering unlimited expensive generation.

## Scope

Friends, family and work group chats, 3–15 confirmed participants, pasted attributed text and the text export formats that already work (WhatsApp `.txt`, and `.zip` containing one). Anything else is rejected with a clear message.

## Flow

```text
home "Group Read"  ->  /group  (paste or upload)
                        |  parse locally, no upload yet
                        v
                   participant confirmation
                   - merge duplicate aliases
                   - exclude bots / system entries
                   - "which one is you?" (skippable)
                   - confirm friends / family / work
                   - enforce 3-15 after exclusions
                        v
                   /group/:id  processing -> result
                        v
                   owner enables share -> /g/:token (redacted) -> visitor CTA
```

## Parsing and participant confirmation

A new browser-side parser turns pasted or uploaded text into `{ participants, messages }` with stable ids, order, and timestamps only where actually present. Lines it cannot attribute are kept as "unattributed" and shown for correction — never guessed from writing style. The confirmation screen is required before anything is sent to the server.

## Report

Deterministic counts are computed on the server from the parsed messages (message share, words, questions asked, questions left unanswered, who starts threads, reply-to patterns when timestamps exist, quiet members). The model receives only the parsed messages plus those computed stats and must ground every claim in them.

Output sections:
- Role cards per participant: Organizer, Ghost, Therapist, Chaos Agent, Instigator, Emoji Diplomat, Lore Keeper, Peacekeeper, or a neutral description when the evidence is thin. Each carries a reason and an evidence reference.
- Serious layer: balance, initiation/response (only when timestamps support it), unanswered bids, repair attempts, strengths, cautious subgroup notes, practical suggestions.
- Coverage and confidence block; metrics without data are labelled "not available", never invented.

Guardrails in the prompt and in code: uploaded text is data, never instructions; no fabricated quotes; no diagnoses; work groups get no performance ranking or employment advice; abuse, threats or crisis content switch the report to a serious, non-playful mode.

## Sharing

Owner opts in explicitly. Default pseudonyms ("Participant A"); real names or quotes only when the owner ticks them. The public page reads a minimal redacted snapshot built at share time — never the private result. Tokens are long and random, revocable, and never appear in analytics. Overall 9:16 card plus optional per-role cards, using the existing export and native-share code.

## Backend changes (technical)

Migration:
- `group_reads` — owner (`user_id` nullable) + `session_id`, category, participant count, status, `result_json`, `stats_json`, error, timestamps. RLS: owner/session read via a security-definer function; no direct client writes.
- `group_share_links` — group id, token hash, redacted `snapshot_json`, flags for names/quotes, `revoked_at`. Public resolution only through a security-definer function that returns the snapshot, and only when not revoked.
- Security-definer functions: `get_group_read_for_session`, `resolve_group_share`, `count_recent_group_reads` (rate limiting).
- GRANTs for every new table, per the usual rules.

Edge function `analyze-group` (service role, `verify_jwt = false`, auth validated in code):
- Validates payload with Zod: 3–15 participants, message and character caps, category enum.
- Verifies caller owns the row (session id or bearer token) before doing any paid work.
- Server-side rate limit on generation; duplicate-safe (a row already processing is not re-run).
- Computes deterministic stats, calls the model with a bounded prompt and bounded output, saves report + stats.
- Raw message text is never persisted and never logged — it lives only in the request and in memory, including on the failure path.

Edge function `group-share` for create / update / revoke, owner-checked server-side.

New prompt row `kind = 'group'` in `prompt_versions`.

## Frontend

- `src/lib/group/parse.ts`, `stats.ts`, types, with unit tests.
- `/group` input + confirmation, `/group/:id` result with loading, bounded errors and retry, `/g/:token` public redacted page (noindex, no chat text in metadata).
- Enable the homepage Group Read entry.
- New analytics events (ids only, no names/text/tokens): started, participants confirmed, completed, failed, share created, share visited, role card engaged, share conversion.

## Validation I will run

Synthetic 3/5/10/15-person chats, duplicate aliases, bot entries, quiet members, no timestamps, ambiguous lines, malformed input, prompt-injection text, and a safety case. Full click-through of home → input → confirm → result → share → visitor CTA. Authorization probes: an unrelated user reading or mutating the private report, creating a share, and using a revoked token. Regression pass over Quick Take, dyadic reports and the pair-type cards. Unit tests, typecheck, build. I will state clearly which checks ran live against the backend versus which are unit-level.

Nothing will be published.
