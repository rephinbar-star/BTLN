# Security triage — SECURITY DEFINER surface, object by object

Date: 2026-09-22 (UTC). Backend only. **Not published. No live charges.**

Supersedes the summary tables in `docs/linter-disposition.md` for the execute-grant findings.
That file remains valid for the RLS/deny-all history.

## Counts

| Pass | 0028 anon-executable | 0029 authenticated-executable | Total |
|---|---|---|---|
| Before this pass | 31 | 42 | 73 |
| After this pass | 27 | 42 | 69 |

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

Implemented:

- Budgets are charged **before** the model call, from a server-side table, not a
  client counter. Signed-in callers are metered per account (`user:<uuid>`, 30
  requests / 120 images per rolling hour); signed-out callers are metered per network
  address (`ip:<addr>`, 12 requests / 60 images per hour). A client-supplied session id
  is never used as a budget key, so minting new sessions buys nothing.
- Per-image cap 3 MB, per-request cap 10 images, new total-payload cap 12 MB.
- Counters live in `public.extraction_budget`, unreachable through the Data API;
  `claim_extraction_budget` is `service_role` only.

Runtime evidence (2026-09-22, anonymous, single source address):
requests 1–12 → `422` (reached the model, no readable text in the 1×1 test pixel);
requests 13, 14, 15 → `429 "You have reached the screenshot reading limit for this
hour."` Budget is therefore enforced ahead of model spend.

Residual: the per-address bucket is shared by callers behind one NAT. Accepted for a
signed-out free path; signing in raises the ceiling.

## Pending in Priority A (not yet evidenced)

- Two synthetic authenticated accounts: owner isolation across source read / link /
  correction / exclude / export / delete, and `ai_feedback` target ownership with
  update / undo / reset / delete.
- Forged canonical participant mapping rejection, replayed under two accounts.
- Mapping correction and source deletion invalidating derived state.
- Interactive Mode: confirmed sent reply → subsequent exchange → real contextual model
  response in one owned thread, with no second OCR pass and no duplicated observations.
- `coachingPreferences` consent policy: the loader currently treats
  `personalization_consent !== false` as consent, which includes `NULL`. Legacy rows
  must not be silently included — to be resolved before personalization is relied on.
