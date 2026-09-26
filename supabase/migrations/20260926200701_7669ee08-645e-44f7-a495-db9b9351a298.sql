-- Per-run call limit enforced inside the serialised reservation (retries count).
create or replace function public.reserve_prompt_spend(p_scope text, p_job uuid, p_kind text, p_model text, p_in int, p_out int, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg public.prompt_budget_config; since timestamptz; committed numeric; job_committed numeric; new_id uuid; run public.prompt_test_runs; run_calls int;
begin
  select * into cfg from public.prompt_budget_config where scope = p_scope for update; -- serialises all reservations in a scope
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_budget_config'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'unknown_pricing'); end if;
  if p_amount > cfg.per_call_cap_usd then return jsonb_build_object('ok', false, 'reason', 'per_call_cap', 'requested', p_amount, 'cap', cfg.per_call_cap_usd); end if;
  if p_job is not null then
    select * into run from public.prompt_test_runs where id = p_job;
    if found then
      if run.status <> 'active' or run.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
      select count(*) into run_calls from public.prompt_spend_ledger where job_id = p_job;
      if run_calls >= run.max_calls then return jsonb_build_object('ok', false, 'reason', 'run_call_limit', 'calls', run_calls, 'cap', run.max_calls); end if;
    end if;
  end if;
  since := now() - make_interval(hours => cfg.window_hours);
  committed := public.prompt_committed_usd(p_scope, null, since);
  if committed + p_amount > cfg.global_cap_usd then
    return jsonb_build_object('ok', false, 'reason', 'global_cap', 'committed', committed, 'requested', p_amount, 'cap', cfg.global_cap_usd);
  end if;
  if p_job is not null then
    job_committed := public.prompt_committed_usd(p_scope, p_job, '-infinity');
    if job_committed + p_amount > cfg.per_job_cap_usd then
      return jsonb_build_object('ok', false, 'reason', 'per_job_cap', 'committed', job_committed, 'requested', p_amount, 'cap', cfg.per_job_cap_usd);
    end if;
  end if;
  insert into public.prompt_spend_ledger (scope, job_id, kind, model, max_input_tokens, max_output_tokens, reserved_usd, test_run_id)
  values (p_scope, p_job, p_kind, p_model, p_in, p_out, p_amount, case when run.id is not null then run.id else null end) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'committed', committed + p_amount, 'cap', cfg.global_cap_usd);
end $$;
revoke all on function public.reserve_prompt_spend(text, uuid, text, text, int, int, numeric) from public, anon, authenticated;
grant execute on function public.reserve_prompt_spend(text, uuid, text, text, int, int, numeric) to service_role;

-- One launch per (run, function) — replayed tokens are refused atomically.
create table public.prompt_test_run_claims (
  run_id uuid not null references public.prompt_test_runs(id) on delete cascade,
  function_name text not null,
  seq int not null,
  claimed_at timestamptz not null default now(),
  primary key (run_id, function_name, seq)
);
grant all on public.prompt_test_run_claims to service_role;
alter table public.prompt_test_run_claims enable row level security;
create policy "Operators read test run claims" on public.prompt_test_run_claims for select to authenticated using (public.has_role(auth.uid(), 'admin'));
grant select on public.prompt_test_run_claims to authenticated;

create or replace function public.claim_prompt_test_run(p_id uuid, p_secret_hash text, p_user uuid, p_function text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.prompt_test_runs; used int; launches int; allowed int;
begin
  select * into r from public.prompt_test_runs where id = p_id for update; -- serialises concurrent launches of one run
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_run'); end if;
  if r.secret_hash <> p_secret_hash then return jsonb_build_object('ok', false, 'reason', 'bad_secret'); end if;
  if r.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if r.target_user_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'wrong_user'); end if;
  if r.function_name <> p_function
     and not (p_function = 'extract-chat-input')
     and not (r.mode = 'interactive' and p_function = 'decode-conversation') then
    return jsonb_build_object('ok', false, 'reason', 'wrong_function');
  end if;
  -- Server-defined launch plan: Interactive sends a reply then an observed
  -- follow-up (2 launches); every other function launches once per run.
  allowed := case when r.mode = 'interactive' and p_function = 'interactive-mode' then 2 else 1 end;
  select count(*) into launches from public.prompt_test_run_claims where run_id = r.id and function_name = p_function;
  if launches >= allowed then return jsonb_build_object('ok', false, 'reason', 'replayed'); end if;
  select count(*) into used from public.prompt_spend_ledger where job_id = r.id;
  if used >= r.max_calls then return jsonb_build_object('ok', false, 'reason', 'run_call_limit'); end if;
  insert into public.prompt_test_run_claims (run_id, function_name, seq) values (r.id, p_function, launches + 1);
  return jsonb_build_object('ok', true, 'id', r.id, 'mode', r.mode, 'variant', r.variant, 'candidate_id', r.candidate_id,
    'candidate_addendum', r.candidate_addendum, 'baseline_text_hash', r.baseline_text_hash, 'max_calls', r.max_calls - used);
end $$;
revoke all on function public.claim_prompt_test_run(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_prompt_test_run(uuid, text, uuid, text) to service_role;