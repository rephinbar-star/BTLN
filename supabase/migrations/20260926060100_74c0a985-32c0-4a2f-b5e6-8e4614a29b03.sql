create table public.prompt_budget_config (
  scope text primary key,
  window_hours int not null check (window_hours between 1 and 720),
  global_cap_usd numeric(10,4) not null check (global_cap_usd >= 0),
  per_job_cap_usd numeric(10,4) not null check (per_job_cap_usd >= 0),
  per_call_cap_usd numeric(10,4) not null check (per_call_cap_usd >= 0),
  note text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.prompt_budget_config to authenticated;
grant all on public.prompt_budget_config to service_role;
alter table public.prompt_budget_config enable row level security;
create policy "Operators read budget config" on public.prompt_budget_config for select to authenticated using (public.has_role(auth.uid(), 'admin'));

insert into public.prompt_budget_config (scope, window_hours, global_cap_usd, per_job_cap_usd, per_call_cap_usd, note) values
 ('improvement', 24, 15.00, 3.50, 0.60, 'Internal test limit for the operator improvement workflow. Not a customer allowance.'),
 ('selftest', 24, 1.00, 0.50, 0.30, 'Reservation-only self test. Never calls a model.');

create table public.prompt_spend_ledger (
  id uuid primary key default gen_random_uuid(),
  scope text not null references public.prompt_budget_config(scope),
  job_id uuid,
  kind text not null check (kind in ('generation','retry','judge','proposal','sandbox','selftest')),
  model text not null,
  max_input_tokens int not null,
  max_output_tokens int not null,
  reserved_usd numeric(10,6) not null check (reserved_usd > 0),
  actual_usd numeric(10,6),
  prompt_tokens int,
  completion_tokens int,
  status text not null default 'reserved' check (status in ('reserved','reconciled','unknown')),
  outcome text,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz
);
create index prompt_spend_ledger_scope_time on public.prompt_spend_ledger (scope, created_at);
create index prompt_spend_ledger_job on public.prompt_spend_ledger (job_id);
grant select on public.prompt_spend_ledger to authenticated;
grant all on public.prompt_spend_ledger to service_role;
alter table public.prompt_spend_ledger enable row level security;
create policy "Operators read spend ledger" on public.prompt_spend_ledger for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Committed spend: reconciled rows count their real cost; reserved and unknown rows count the full reservation.
create or replace function public.prompt_committed_usd(p_scope text, p_job uuid, p_since timestamptz)
returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(case when status = 'reconciled' then greatest(actual_usd, 0) else reserved_usd end), 0)
  from public.prompt_spend_ledger
  where scope = p_scope and created_at > p_since and (p_job is null or job_id = p_job)
$$;

create or replace function public.reserve_prompt_spend(p_scope text, p_job uuid, p_kind text, p_model text, p_in int, p_out int, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg public.prompt_budget_config; since timestamptz; committed numeric; job_committed numeric; new_id uuid;
begin
  select * into cfg from public.prompt_budget_config where scope = p_scope for update; -- serialises all reservations in a scope
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_budget_config'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'reason', 'unknown_pricing'); end if;
  if p_amount > cfg.per_call_cap_usd then return jsonb_build_object('ok', false, 'reason', 'per_call_cap', 'requested', p_amount, 'cap', cfg.per_call_cap_usd); end if;
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

-- Only a still-open reservation can be reconciled (idempotent). Null cost means unknown: the reservation stays counted.
create or replace function public.reconcile_prompt_spend(p_id uuid, p_actual numeric, p_pt int, p_ct int, p_outcome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.prompt_spend_ledger
     set actual_usd = p_actual, prompt_tokens = p_pt, completion_tokens = p_ct,
         status = case when p_actual is null or p_actual < 0 then 'unknown' else 'reconciled' end,
         outcome = left(p_outcome, 60), reconciled_at = now()
   where id = p_id and status = 'reserved';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1, 'already_closed', n = 0);
end $$;

create or replace function public.prompt_budget_status(p_scope text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg public.prompt_budget_config; since timestamptz; spent numeric; reserved numeric; unknown numeric;
begin
  select * into cfg from public.prompt_budget_config where scope = p_scope;
  if not found then return null; end if;
  since := now() - make_interval(hours => cfg.window_hours);
  select coalesce(sum(actual_usd) filter (where status = 'reconciled'), 0),
         coalesce(sum(reserved_usd) filter (where status = 'reserved'), 0),
         coalesce(sum(reserved_usd) filter (where status = 'unknown'), 0)
    into spent, reserved, unknown
    from public.prompt_spend_ledger where scope = p_scope and created_at > since;
  return jsonb_build_object('scope', p_scope, 'window_hours', cfg.window_hours, 'global_cap_usd', cfg.global_cap_usd,
    'per_job_cap_usd', cfg.per_job_cap_usd, 'per_call_cap_usd', cfg.per_call_cap_usd, 'spent_usd', spent,
    'reserved_usd', reserved, 'unknown_usd', unknown, 'remaining_usd', greatest(cfg.global_cap_usd - spent - reserved - unknown, 0), 'note', cfg.note);
end $$;

-- Reservations older than the abandon window that were never reconciled become unknown (still counted).
create or replace function public.expire_prompt_reservations(p_minutes int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.prompt_spend_ledger set status = 'unknown', outcome = 'abandoned_unreconciled', reconciled_at = now()
   where status = 'reserved' and created_at < now() - make_interval(mins => p_minutes);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.reserve_prompt_spend(text, uuid, text, text, int, int, numeric) from public, anon, authenticated;
revoke all on function public.reconcile_prompt_spend(uuid, numeric, int, int, text) from public, anon, authenticated;
revoke all on function public.prompt_budget_status(text) from public, anon, authenticated;
revoke all on function public.expire_prompt_reservations(int) from public, anon, authenticated;
revoke all on function public.prompt_committed_usd(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_prompt_spend(text, uuid, text, text, int, int, numeric) to service_role;
grant execute on function public.reconcile_prompt_spend(uuid, numeric, int, int, text) to service_role;
grant execute on function public.prompt_budget_status(text) to service_role;
grant execute on function public.expire_prompt_reservations(int) to service_role;
grant execute on function public.prompt_committed_usd(text, uuid, timestamptz) to service_role;

alter table public.prompt_eval_jobs drop constraint prompt_eval_jobs_status_check;
alter table public.prompt_eval_jobs add constraint prompt_eval_jobs_status_check check (status in ('running','complete','failed','cancelled','budget_stopped','abandoned'));
alter table public.prompt_eval_jobs add column heartbeat_at timestamptz default now(), add column stop_reason text, add column parity jsonb not null default '{}'::jsonb;
alter table public.prompt_eval_results add column judge_order text, add column input_case jsonb;

create table public.prompt_review_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.prompt_eval_jobs(id) on delete cascade,
  case_id text not null,
  binding_hash text not null,
  note text not null check (char_length(note) between 1 and 2000),
  author_id uuid not null,
  is_test_record boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.prompt_review_notes to authenticated;
grant all on public.prompt_review_notes to service_role;
alter table public.prompt_review_notes enable row level security;
create policy "Operators read review notes" on public.prompt_review_notes for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger prompt_review_notes_immutable before update on public.prompt_review_notes for each row execute function public.prompt_block_mutation();

create table public.prompt_review_packets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  items jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.prompt_review_packets to authenticated;
grant all on public.prompt_review_packets to service_role;
alter table public.prompt_review_packets enable row level security;
create policy "Operators read review packets" on public.prompt_review_packets for select to authenticated using (public.has_role(auth.uid(), 'admin'));