alter table public.prompt_spend_ledger add column stage text, add column test_run_id uuid;
create index prompt_spend_ledger_run on public.prompt_spend_ledger (test_run_id);

create table public.prompt_test_runs (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  target_user_id uuid not null,
  operator_id uuid not null,
  function_name text not null check (function_name in ('analyze-conversation','decode-conversation','interactive-mode','analyze-group','relationship360','analyze-group-roast','extract-chat-input')),
  mode text not null,
  variant text not null check (variant in ('baseline','candidate','personalization')),
  candidate_id uuid,
  candidate_addendum text,
  baseline_text_hash text,
  case_id text,
  purpose text not null default '',
  max_calls int not null default 12 check (max_calls between 1 and 40),
  status text not null default 'active' check (status in ('active','finalized','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
grant select on public.prompt_test_runs to authenticated;
grant all on public.prompt_test_runs to service_role;
alter table public.prompt_test_runs enable row level security;
create policy "Operators read test runs" on public.prompt_test_runs for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.prompt_pipeline_results (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null unique references public.prompt_test_runs(id),
  mode text not null,
  case_id text,
  variant text not null,
  candidate_id uuid,
  binding jsonb not null,
  stage_coverage jsonb not null,
  pipeline_parity text not null check (pipeline_parity in ('full_pipeline','partial_pipeline','final_call_only')),
  output jsonb,
  checks jsonb,
  screen_passed boolean,
  spend jsonb not null,
  notes text,
  is_test_record boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.prompt_pipeline_results to authenticated;
grant all on public.prompt_pipeline_results to service_role;
alter table public.prompt_pipeline_results enable row level security;
create policy "Operators read pipeline results" on public.prompt_pipeline_results for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger prompt_pipeline_results_immutable before update on public.prompt_pipeline_results for each row execute function public.prompt_block_mutation();

create or replace function public.claim_prompt_test_run(p_id uuid, p_secret_hash text, p_user uuid, p_function text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.prompt_test_runs;
begin
  select * into r from public.prompt_test_runs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_run'); end if;
  if r.secret_hash <> p_secret_hash then return jsonb_build_object('ok', false, 'reason', 'bad_secret'); end if;
  if r.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'run_closed'); end if;
  if r.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if r.target_user_id <> p_user then return jsonb_build_object('ok', false, 'reason', 'wrong_user'); end if;
  if r.function_name <> p_function and not (p_function = 'extract-chat-input') then return jsonb_build_object('ok', false, 'reason', 'wrong_function'); end if;
  return jsonb_build_object('ok', true, 'id', r.id, 'mode', r.mode, 'variant', r.variant, 'candidate_id', r.candidate_id,
    'candidate_addendum', r.candidate_addendum, 'baseline_text_hash', r.baseline_text_hash, 'max_calls', r.max_calls);
end $$;
revoke all on function public.claim_prompt_test_run(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_prompt_test_run(uuid, text, uuid, text) to service_role;