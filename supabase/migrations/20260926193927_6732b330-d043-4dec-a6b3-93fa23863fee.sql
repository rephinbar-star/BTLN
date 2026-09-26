create table public.prompt_pipeline_rescreens (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.prompt_pipeline_results(id),
  rubric_version text not null,
  checks jsonb not null,
  screen_passed boolean not null,
  reason text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (result_id, rubric_version)
);
grant select on public.prompt_pipeline_rescreens to authenticated;
grant all on public.prompt_pipeline_rescreens to service_role;
alter table public.prompt_pipeline_rescreens enable row level security;
create policy "Operators read pipeline rescreens" on public.prompt_pipeline_rescreens for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger prompt_pipeline_rescreens_immutable before update on public.prompt_pipeline_rescreens for each row execute function public.prompt_block_mutation();