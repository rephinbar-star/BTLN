create table public.prompt_stage_plan (
  function_name text not null,
  stage text not null,
  primary key (function_name, stage)
);
grant select on public.prompt_stage_plan to authenticated;
grant all on public.prompt_stage_plan to service_role;
alter table public.prompt_stage_plan enable row level security;
create policy "Operators read stage plan" on public.prompt_stage_plan for select to authenticated using (public.has_role(auth.uid(), 'admin'));

insert into public.prompt_stage_plan (function_name, stage) values
 ('analyze-conversation','extraction'),('analyze-conversation','digest'),('analyze-conversation','primary'),('analyze-conversation','primary_fill'),
 ('analyze-conversation','primary_regenerate'),('analyze-conversation','style_rewrite'),('analyze-conversation','attribution'),
 ('analyze-group','extraction'),('analyze-group','digest'),('analyze-group','primary'),
 ('analyze-group-roast','extraction'),('analyze-group-roast','digest'),('analyze-group-roast','primary'),
 ('decode-conversation','extraction'),('decode-conversation','primary'),
 ('interactive-mode','extraction'),('interactive-mode','primary'),
 ('relationship360','synthesis'),
 ('extract-chat-input','extraction');

alter table public.prompt_spend_ledger add column if not exists function_name text;
alter table public.prompt_spend_ledger add column if not exists retry_of uuid references public.prompt_spend_ledger(id);

-- Test-run reservations: stage, run/account/function identity, call count and
-- dollar reservation are validated and written in ONE transaction, under the
-- scope lock plus the run row lock. No later "annotate" step exists.
create or replace function public.reserve_prompt_spend(p_scope text, p_job uuid, p_kind text, p_model text, p_in integer, p_out integer, p_amount numeric, p_stage text, p_function text, p_retry_of uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare cfg public.prompt_budget_config; since timestamptz; committed numeric; job_committed numeric; new_id uuid; run public.prompt_test_runs; run_calls int; prev public.prompt_spend_ledger;
begin
  select * into cfg from public.prompt_budget_config where scope = p_scope for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_budget_config'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'unknown_pricing'); end if;
  if p_amount > cfg.per_call_cap_usd then return jsonb_build_object('ok', false, 'reason', 'per_call_cap', 'requested', p_amount, 'cap', cfg.per_call_cap_usd); end if;
  if p_job is null then return jsonb_build_object('ok', false, 'reason', 'run_required'); end if;
  select * into run from public.prompt_test_runs where id = p_job for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_run'); end if;
  if run.status <> 'active' or run.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  if p_function is null or not exists (select 1 from public.prompt_test_run_claims c where c.run_id = run.id and c.function_name = p_function) then
    return jsonb_build_object('ok', false, 'reason', 'function_not_claimed');
  end if;
  if p_stage is null or not exists (select 1 from public.prompt_stage_plan s where s.function_name = p_function and s.stage = p_stage) then
    return jsonb_build_object('ok', false, 'reason', 'unplanned_stage', 'stage', p_stage, 'function', p_function);
  end if;
  if p_kind not in ('generation','retry') then return jsonb_build_object('ok', false, 'reason', 'bad_kind'); end if;
  if p_kind = 'retry' then
    select * into prev from public.prompt_spend_ledger where id = p_retry_of;
    if not found or prev.job_id <> run.id or prev.stage <> p_stage or prev.function_name <> p_function then
      return jsonb_build_object('ok', false, 'reason', 'retry_link_invalid');
    end if;
  elsif p_retry_of is not null then
    return jsonb_build_object('ok', false, 'reason', 'retry_link_invalid');
  end if;
  select count(*) into run_calls from public.prompt_spend_ledger where job_id = p_job;
  if run_calls >= run.max_calls then return jsonb_build_object('ok', false, 'reason', 'run_call_limit', 'calls', run_calls, 'cap', run.max_calls); end if;
  since := now() - make_interval(hours => cfg.window_hours);
  committed := public.prompt_committed_usd(p_scope, null, since);
  if committed + p_amount > cfg.global_cap_usd then
    return jsonb_build_object('ok', false, 'reason', 'global_cap', 'committed', committed, 'requested', p_amount, 'cap', cfg.global_cap_usd);
  end if;
  job_committed := public.prompt_committed_usd(p_scope, p_job, '-infinity');
  if job_committed + p_amount > cfg.per_job_cap_usd then
    return jsonb_build_object('ok', false, 'reason', 'per_job_cap', 'committed', job_committed, 'requested', p_amount, 'cap', cfg.per_job_cap_usd);
  end if;
  insert into public.prompt_spend_ledger (scope, job_id, kind, model, max_input_tokens, max_output_tokens, reserved_usd, test_run_id, stage, function_name, retry_of)
  values (p_scope, p_job, p_kind, p_model, p_in, p_out, p_amount, run.id, p_stage, p_function, p_retry_of) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'committed', committed + p_amount, 'cap', cfg.global_cap_usd, 'run_calls', run_calls + 1);
end $$;
revoke all on function public.reserve_prompt_spend(text, uuid, text, text, integer, integer, numeric, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_prompt_spend(text, uuid, text, text, integer, integer, numeric, text, text, uuid) to service_role;

-- The older 7-argument entry point stays for evaluator jobs, but can no longer
-- reserve for a synthetic test run (that would create an unlabelled call).
create or replace function public.reserve_prompt_spend(p_scope text, p_job uuid, p_kind text, p_model text, p_in integer, p_out integer, p_amount numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare cfg public.prompt_budget_config; since timestamptz; committed numeric; job_committed numeric; new_id uuid;
begin
  select * into cfg from public.prompt_budget_config where scope = p_scope for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_budget_config'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'unknown_pricing'); end if;
  if p_amount > cfg.per_call_cap_usd then return jsonb_build_object('ok', false, 'reason', 'per_call_cap', 'requested', p_amount, 'cap', cfg.per_call_cap_usd); end if;
  if p_job is not null and exists (select 1 from public.prompt_test_runs where id = p_job) then
    return jsonb_build_object('ok', false, 'reason', 'stage_required');
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
  insert into public.prompt_spend_ledger (scope, job_id, kind, model, max_input_tokens, max_output_tokens, reserved_usd)
  values (p_scope, p_job, p_kind, p_model, p_in, p_out, p_amount) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'committed', committed + p_amount, 'cap', cfg.global_cap_usd);
end $$;
revoke all on function public.reserve_prompt_spend(text, uuid, text, text, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.reserve_prompt_spend(text, uuid, text, text, integer, integer, numeric) to service_role;