# Security triage — SECURITY DEFINER surface, object by object

Date: 2026-09-22 (UTC). Backend only. **Not published. No live charges.**

Supersedes the summary tables in `docs/linter-disposition.md` for the execute-grant findings.
That file remains valid for the RLS/deny-all history.

## Counts

Single dated snapshot, all figures re-read from the advisor on 2026-09-22 UTC.

| Pass (2026-09-22) | 0028 anon-executable | 0029 authenticated-executable | Total |
|---|---|---|---|
| Before this pass | 31 | 42 | 73 |
| After this pass | 27 | 42 | 69 |

Reconciliation with the older **57** in `docs/linter-disposition.md` (2026-09-16) and the same
number quoted in `docs/relationship360-build.md`: 57 → 73 is **not** a regression and 73 → 69 is
**not** "fixed". The increase is (a) functions added since that date for feedback, entitlements and
Relationship360, and (b) four objects that had always been anon-executable but were recorded as
authenticated-only, corrected below. Both older documents now point here. Counts are a bookkeeping
figure only: an elevated-privilege function is not an exploit, and a low count is not safety.

Residual risk accepted after this pass: every remaining object is reachable by its stated role, so
the authorization predicate inside the function body is the only boundary. A bug in any one of those
predicates is a direct data-exposure path; they are listed individually below precisely so each can
be re-read. Write-capable public functions are bounded by an owner/session predicate, which caps
*who* a row can be attributed to but does not by itself cap *volume*; only `submit_ai_feedback`
(300/hour/owner) and `claim_extraction_budget` carry an explicit rate limit today. Unmetered public
write volume on `log_event`, `record_share_click`, `capture_email`, `record_paywall_intent`,
`submit_feedback` and `submit_survey` is an open item, not a closed one.

A lower count is not a security claim. The number that matters is that every remaining
object below was read in full and has a named authorization predicate.

## Root cause found and fixed

The project carries `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role` (confirmed in
`pg_default_acl`: `postgres:f:postgres=X/postgres|anon=X/postgres|...`).

Consequence: **every new function was granted to `anon` at creation time.** The
pattern used by earlier migrations —

```sql
REVOKE ALL ON FUNCTION f() FROM public;
GRANT EXECUTE ON FUNCTION f() TO authenticated, service_role;
```

did **not** exclude `anon`, because `REVOKE ... FROM public` does not remove a
role-specific grant, and the intended-narrow `GRANT` is additive. Four functions that
were documented as authenticated-only were in fact anon-executable.

Fix applied (migration `claim_extraction_budget` pass): explicit
`REVOKE EXECUTE ... FROM anon` on every function whose body requires `auth.uid()`.

The default ACL itself was **not** changed. Changing it would silently break future
migrations that rely on the default to expose an anonymous flow. Recommended follow-up:
require every new migration to state its grants explicitly and add
`REVOKE EXECUTE ... FROM anon` for authenticated-only functions. Tracked as a standing
convention, not a code change.

## Fixed in this pass

| Object | Was | Risk before fix | Now | Evidence |
|---|---|---|---|---|
| `get_coaching_feedback_context(int)` | anon+auth | Returns a signed-in person's private coaching preference summary. Body returns `{available:false}` when `auth.uid()` is null, so no data leaked, but an unauthenticated caller could reach it and probe behaviour | authenticated, service_role | anon key → `401 42501 permission denied for function get_coaching_feedback_context` |
| `reset_coaching_personalization()` | anon+auth | Write function reachable signed-out; body returns 0 without a uid | authenticated, service_role | anon key → `401 42501 permission denied` |
| `delete_my_ai_feedback()` | anon+auth | Destructive function reachable signed-out; body returns 0 without a uid | authenticated, service_role | anon key → `401 42501 permission denied` |
| `admin_ai_feedback_aggregate(int)` | anon+auth | Operator aggregate reachable signed-out; body raises `admin only` via `has_role(auth.uid(),'admin')`, so no data leaked | authenticated, service_role | anon key → `401 42501 permission denied` |
| `journey_activate`, `journey_opt_out`, `journey_export`, `journey_delete_all`, `journey_confirm_identity`, `journey_mark_absent`, `journey_set_source_excluded`, `journey_auto_include`, `journey_write_summary`, `has_entitlement` | anon+auth | Private Relationship360 controls reachable signed-out. All are `auth.uid()`-scoped and RLS-backed, so no data leaked | authenticated, service_role | `journey_export`, `journey_delete_all` with anon key → `401 42501 permission denied` |
| `extraction_budget` table | new | — | `REVOKE ALL FROM anon, authenticated` + RLS deny-all policy | Not exposed through the Data API |
| `claim_extraction_budget(text,int,int,int)` | new | Would let a client mint its own budget | service_role only | anon key → `404 PGRST202` (not in the exposed schema for that role) |

## Remaining 27 anon-executable objects — individually justified

All are `SECURITY DEFINER`, owner `postgres`, `SET search_path = public` (verified from
`pg_proc.proconfig`). Elevated privilege is genuinely required: each reads or writes
rows that RLS deliberately hides from `anon`, and the function itself is the
authorization boundary. The product supports signed-out use — a visitor can run a read
and see their own result before creating an account — so revoking `anon` would remove
functionality with no security gain.

**Group 1 — owner-scoped reads (capability = the report's unguessable `session_id`, or `auth.uid()`).**
A report UUID alone is never sufficient.

`get_analysis_for_session`, `get_decode_for_session`, `get_group_read_for_session`,
`get_roast_for_session`, `get_roast_for_source`, `get_analysis_share_for_owner`,
`get_group_share_for_owner`, `get_roast_share_for_owner`, `list_roastable_sources`,
`count_completed_decodes`, `count_group_reads_since_cutoff`.

Predicate: `user_id = auth.uid() OR session_id = p_session_id`.
Exposed: the caller's own row only; share functions never return the share token.
Evidence: wrong session id → `200 []` (verified this pass against
`get_decode_for_session`). Cross-user read → `[]`.
Risk if removed: signed-out visitors cannot read the report they just generated.

**Group 2 — token-resolved public snapshots.** `resolve_analysis_share`,
`resolve_group_share`, `resolve_roast_share`, `get_shared_analysis`.
Predicate: `token_hash` match and `revoked_at IS NULL`, token ≥ 32 chars;
`get_shared_analysis` additionally requires a completed, typed analysis and strips
`user_id`, `session_id`, `error_message` and raw context.
Exposed: the redacted snapshot the owner chose to share. No raw transcript.
Bogus and revoked tokens resolve to `null`.

**Group 3 — append-only writers with ownership validation.** `submit_feedback(6-arg)`,
`submit_survey`, `capture_email`, `record_paywall_intent`, `record_share_click`,
`log_event`, `mark_analysis_failed`.
Predicate: owner uid or the owning session id; allow-lists on enumerated arguments;
`log_event` is insert-only and takes no report reference.
Exposed: nothing readable. Abuse ceiling is row creation, bounded by the same
ownership predicate.

**Group 4 — feedback surface (new).** `ai_feedback_owns_source`, `submit_ai_feedback`,
`clear_ai_feedback`, `list_ai_feedback_for_source`.
Predicate: all three public entry points call `ai_feedback_owns_source`, which resolves
ownership per source kind — `decodes`/`analyses`/`group_reads` by `user_id = auth.uid()`
**or** `session_id = p_session_id`; `group_roasts`, `interactive_threads` and
`journey_summaries` by `user_id` only (never by session). `submit_ai_feedback` upserts on
`(owner_key, source, target)` so re-rating updates in place and never inflates counts, and
refuses more than 300 writes per owner per hour.
Exposed: the caller's own ratings only.
Note: `ai_feedback_owns_source` is a boolean oracle. It answers "does the caller own this
report", which the caller already knows — it cannot enumerate ids and returns nothing
about content. Kept anon-executable because the three public entry points depend on it
and because it is `STABLE` with no write path.

**Group 5 — deliberate public read.** `list_approved_testimonials()` returns only rows
with `publication_consent = true`, `moderation_status = 'approved'`, `is_test = false`.

## Not client-executable at all (no linter finding, listed for completeness)

`claim_webhook_event`, `handle_new_user` (auth trigger), `submit_testimonial_candidate`,
`update_updated_at_column`, `journey_bump_version`, `journey_stage_completed_source`,
`journey_validate_source`, `get_group_roast_for_owner`,
`get_group_roast_share_for_owner`, `has_group_roast_unlock`, `resolve_group_roast_share`,
`claim_extraction_budget`. Direct calls from `anon`/`authenticated` are refused with
`permission denied`.

## The 15 authenticated-only objects

`claim_analysis`, `claim_analyses_for_session`, `claim_anonymous_analyses` (require
`auth.uid()`, only claim rows with `user_id IS NULL`); `save_recipient_perspective`,
`save_analysis_recipient_perspective` (require `auth.uid()` plus a live unrevoked share
token); `has_group_read_unlock`, `user_has_active_subscription`, `user_has_full_plan`,
`user_has_paid_access` (return false unless `auth.uid()` matches the requested user);
`has_role` (read-only lookup required by RLS policies — must stay executable or every
role-based policy fails); `set_couple_type_image_url` (requires
`has_role(auth.uid(),'admin')`); plus the four fixed above and the Relationship360
control functions.

Finding 0029 is expected for all of them: these *are* the signed-in API. Switching them
to `SECURITY INVOKER` would break the RLS model they implement.

## Screenshot reading (`extract-chat-input`) — cost control

Previously documented gap: the endpoint was fully public with no metering. Any caller
could POST 10 images and trigger a vision-model call.

### Correction: network-address metering is NOT bypass-resistant here

The first fix metered signed-out callers per network address, read from
`x-forwarded-for`. **Hostile-header test, 2026-09-22:** 16 consecutive anonymous requests,
each sending a different `X-Forwarded-For: 203.0.113.N`, all returned `422` (reached the
model) against a 12/hour per-address limit. The runtime passes the caller's header through
rather than overwriting it, and reading the last chain element does not help because the
whole chain is caller-supplied. A rate-limit test that only shows "the 13th request is
rejected" proves nothing about bypass resistance. No non-spoofable per-guest network
identity is available to this function.

### What is enforced now

- **Signed in:** metered per account id resolved by verifying the bearer token
  server-side (`user:<uuid>`, 30 requests / 120 images per hour). Not forgeable.
- **Signed out:** charged first against a single global guest budget
  (`anon:global`, 60 requests / 240 images per hour) that no header can split, then
  against a best-effort per-address bucket (12 / 60) kept only as a nuisance limit and
  explicitly documented as spoofable. Guests are not blocked from the intended flow;
  total guest model spend per hour is bounded.
- Budgets are charged **before** the model call from `public.extraction_budget`, which is
  unreachable through the Data API; `claim_extraction_budget` is `service_role` only.
- Per-image cap 3 MB, per-request cap 10 images, total-payload cap 12 MB.

**Runtime evidence (2026-09-22, anonymous, 70 requests with 70 distinct spoofed
addresses):** requests proceeded until the global hourly budget was exhausted, after which
every further request returned `429` regardless of the spoofed address. Spoofing shards the
best-effort bucket and does not raise the ceiling that matters.

Residual: the global bucket means one abusive guest can exhaust the hourly guest allowance
for all guests (availability, not cost). Signing in uses a separate per-account budget and
is unaffected. Raising guest capacity safely needs a server-verifiable guest token
(proof-of-work or an issued, signed guest credential) — open item.

## Screenshot overlap — silent deletion fixed

The extractor previously de-duplicated on `sender|timestamp-or-empty|content` across the
whole batch, so a legitimately repeated untimestamped "OK" was deleted as an "overlap".
Replaced by `supabase/functions/_shared/dedupTranscript.ts`:

1. exact duplicates that carry a **non-empty** timestamp are removed;
2. a contiguous run of two or more messages that immediately repeats the run before it is
   a demonstrated seam overlap and is removed;
3. everything else is kept; identical untimestamped single messages are surfaced as an
   ambiguity warning ("kept as separate messages — remove any you did not send twice")
   instead of being deleted.

Fixtures: `src/lib/ingest/dedup.test.ts` — legitimate repeated "OK" preserved, real
two-message seam overlap removed, same-timestamp duplicate removed, empty content dropped.
4 tests, passing.

## Pending in Priority A (not yet evidenced)

- Two synthetic authenticated accounts: owner isolation across source read / link /
  correction / exclude / export / delete, and `ai_feedback` target ownership with
  update / undo / reset / delete.
- Forged canonical participant mapping rejection, replayed under two accounts.
- Mapping correction and source deletion invalidating derived state.
- Interactive Mode: confirmed sent reply → subsequent exchange → real contextual model
  response in one owned thread, with no second OCR pass and no duplicated observations.
**Resolved this pass — consent policy.** `supabase/functions/_shared/coachingPreferences.ts`
previously treated `personalization_consent !== false` as consent, which would have
included `NULL`. It now requires `=== true`, matching the SQL side
(`WHERE f.personalization_consent`) exactly. The column is `NOT NULL DEFAULT true`, so no
`NULL` rows exist today and the change is behaviour-preserving for real data, but an
unknown value can no longer be silently read as consent. `reset_coaching_personalization`
sets the flag to `false`, and a reset therefore now removes those rows from
personalization on both the SQL and the edge-function path. Redeployed:
`interactive-mode`, `decode-conversation`.
