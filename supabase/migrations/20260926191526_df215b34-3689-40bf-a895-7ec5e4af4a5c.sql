alter table public.prompt_test_runs add column state jsonb not null default '{}'::jsonb;

create or replace function public.claim_prompt_test_run(p_id uuid, p_secret_hash text, p_user uuid, p_function text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.prompt_test_runs; used int;
begin
  select * into r from public.prompt_test_runs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_run'); end if;
  if r.secret_hash <> p_secret_hash then return jsonb_build_object('ok', false, 'reason', 'bad_secret'); end if;
  if r.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if r.target_user_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'wrong_user'); end if;
  -- A run is bound to one pipeline function. Interactive runs also create their
  -- own source Quick Take; the screenshot reader may be used by any pipeline.
  if r.function_name <> p_function
     and not (p_function = 'extract-chat-input')
     and not (r.mode = 'interactive' and p_function = 'decode-conversation') then
    return jsonb_build_object('ok', false, 'reason', 'wrong_function');
  end if;
  -- Calls already reserved by this run in any request count against its call limit.
  select count(*) into used from public.prompt_spend_ledger where job_id = r.id;
  if used >= r.max_calls then return jsonb_build_object('ok', false, 'reason', 'run_call_limit'); end if;
  return jsonb_build_object('ok', true, 'id', r.id, 'mode', r.mode, 'variant', r.variant, 'candidate_id', r.candidate_id,
    'candidate_addendum', r.candidate_addendum, 'baseline_text_hash', r.baseline_text_hash, 'max_calls', r.max_calls - used);
end $$;
revoke all on function public.claim_prompt_test_run(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_prompt_test_run(uuid, text, uuid, text) to service_role;