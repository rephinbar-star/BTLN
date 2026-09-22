# Database linter — object-by-object disposition

Date: 2026-09-16 (UTC). Backend only. **Frontend not published. No real charges.**

**Superseded count.** The counts in this section are the 2026-09-16 snapshot and are kept only as
history. The authoritative, current snapshot is in `docs/security-triage.md` (2026-09-22: **69** =
27 anon-executable + 42 authenticated-executable). The rise from 57 to 69 is not a regression: it is
the feedback, entitlement and Relationship360 functions added since, plus four objects that were
always anon-executable and were previously mis-recorded as authenticated-only (see the root-cause
section in the triage doc). Numbers moved for both reasons and neither count is a security claim.

Historical 2026-09-16 counts: **61 → 56** → **58** → **57**, split as:

- `0028_anon_security_definer_function_executable` (WARN) — 23 objects
- `0029_authenticated_security_definer_function_executable` (WARN) — 34 objects

There are **no RLS-disabled, no missing-policy, and no performance findings outstanding.** The four
`0008_rls_enabled_no_policy` findings (`messages_temp`, `events`, `analysis_share_links`, `roast_share_links`)
were fixed in the previous pass with deny-all policies plus `REVOKE ALL`; see `docs/audit-reconciliation.md`.

Every function below is `SECURITY DEFINER` with `search_path = public` (verified from `pg_proc.proconfig`);
execute roles were read from `has_function_privilege`. These functions **are** the application's API surface:
anonymous execution is required so signed-out visitors can start and read their own reports. Each one was read
in full and is listed with the authorization condition it enforces and the fields it can return or write.

## Fixed in this pass

| Object | Finding | Problem | Action |
|---|---|---|---|
| `submit_feedback(uuid,int,text,text,text)` | 0028/0029 | Anyone knowing a report UUID could write feedback on an **unclaimed** report — the unclaimed status alone was the check | Dropped; replaced by the 6-arg form below which requires the report's own `session_id` capability or the signed-in owner. Verified: no session → `not authorized`; wrong session → `not authorized`; correct session → success |
| `save_analysis_recipient_perspective(text,int,text)` | 0028 | `PUBLIC` execute grant had returned; the function rejects anonymous callers internally, but the grant was wider than intended | `REVOKE EXECUTE ... FROM PUBLIC, anon` |
| `compare-model` edge function (not a linter finding) | — | Shared `ADMIN_PASSWORD` sent from the browser | Now requires a verified JWT + `has_role(uid,'admin')`. Verified 401 for anon key, no header, and invalid token |
| `verify-admin-password` edge function | — | Shared-password endpoint with no callers | Deleted (deployment removed; HTTP 404 confirmed) |

## Accepted — anonymous read paths, scoped by an unguessable session id or token

All return only the caller's own rows; a report UUID alone is never sufficient.

| Object | anon / auth | Condition enforced | Returns |
|---|---|---|---|
| `get_analysis_for_session(uuid,uuid)` | yes / yes | `user_id = auth.uid()` **or** `session_id = p_session_id` | own analysis row |
| `get_decode_for_session(uuid,uuid)` | yes / yes | same | own decode |
| `get_group_read_for_session(uuid,uuid)` | yes / yes | same, anon branch also requires `user_id IS NULL` | own group read |
| `get_roast_for_session(uuid,uuid)` | yes / yes | same | own roast |
| `get_roast_for_source(text,uuid,uuid)` | yes / yes | same | id/status/tone only |
| `get_analysis_share_for_owner(uuid,uuid)` | yes / yes | owner or owning session | share settings, no token |
| `get_group_share_for_owner(uuid,uuid)` | yes / yes | owner or owning session | share settings, no token |
| `get_roast_share_for_owner(uuid,uuid)` | yes / yes | owner or owning session | share settings, no token |
| `list_roastable_sources(uuid)` | yes / yes | owner or owning session | labels + unlock flag |
| `count_completed_decodes(uuid,uuid)` | yes / yes | own session / own uid | integer |
| `count_group_reads_since_cutoff(uuid,uuid)` | yes / yes | own session / own uid | integer |

Evidence: `get_analysis_for_session` with a wrong session id returns `[]`; cross-user reads return `[]`.

## Accepted — token-resolved public snapshots

| Object | anon / auth | Condition | Returns |
|---|---|---|---|
| `resolve_analysis_share(text)` | yes / yes | `token_hash` match **and** `revoked_at IS NULL`; token length ≥ 32 | redacted snapshot only |
| `resolve_group_share(text)` | yes / yes | same | redacted snapshot only |
| `resolve_roast_share(text)` | yes / yes | same | redacted snapshot only |
| `get_shared_analysis(uuid)` | yes / yes | complete + typed analysis; strips `user_id`, `session_id`, `error_message`, raw context | pair-type card fields only |

Evidence: bogus and revoked tokens resolve to `null`. No raw transcript is reachable through any of these.

## Accepted — append-only writers with validation

| Object | anon / auth | Guard |
|---|---|---|
| `submit_feedback(uuid,int,text,text,text,uuid)` | yes / yes | **owner uid or owning session id** (new) |
| `submit_survey(...)` | yes / yes | rating range, variant allow-list, owner uid or owning session |
| `capture_email(text,uuid,text,uuid)` | yes / yes | owner uid or owning session; `ON CONFLICT DO NOTHING` |
| `record_paywall_intent(uuid,uuid,text)` | yes / yes | option allow-list, owner uid or owning session |
| `record_share_click(uuid,text,uuid)` | yes / yes | owner uid or owning session |
| `log_event(uuid,text,jsonb)` | yes / yes | requires session id + event name; insert-only |
| `mark_analysis_failed(uuid,uuid,text)` | yes / yes | owner uid or owning session; sets failure state only |

## Accepted — authenticated-only

| Object | Guard |
|---|---|
| `claim_analysis`, `claim_analyses_for_session`, `claim_anonymous_analyses` | require `auth.uid()`; only claim rows with `user_id IS NULL` |
| `save_recipient_perspective`, `save_analysis_recipient_perspective` | require `auth.uid()` + a live, unrevoked share token |
| `has_group_read_unlock`, `user_has_active_subscription`, `user_has_full_plan`, `user_has_paid_access` | return false unless `auth.uid()` matches the requested user |
| `set_couple_type_image_url` | requires `has_role(auth.uid(),'admin')` |
| `has_role(uuid, app_role)` | read-only role lookup, needed by RLS policies |

## Accepted — not client-executable at all

`claim_webhook_event` (service_role only; direct call from another role is refused with `permission denied`),
`handle_new_user` (auth trigger), `submit_testimonial_candidate` (service_role; reached only through the
`submit-testimonial` edge function which re-checks ownership), `update_updated_at_column` (trigger).

`list_approved_testimonials()` is intentionally anon/authenticated-executable: it returns only rows that are
`publication_consent = true`, `moderation_status = 'approved'` and `is_test = false`. It returns nothing today.

## Launch-blocker status

None of the 57 remaining findings is a launch blocker. They are the deliberate, individually reviewed public API
surface. Revoking anonymous execution would break the anonymous product flow with no security gain.

## Rollback notes

- `submit_feedback`: restore the previous 5-arg body and grants; the 6-arg version can be dropped.
- `save_analysis_recipient_perspective`: `GRANT EXECUTE ... TO anon` (not recommended).
- `compare-model`: revert `supabase/functions/compare-model/index.ts` to the `ADMIN_PASSWORD` body and redeploy;
  `verify-admin-password` would need to be re-created from git history.
- Front-end admin gate: `src/hooks/useAdminRole.ts` is additive; the removed `sessionStorage` flags were
  `chemistry_admin_authed` / `chemistry_admin_pwd`.
