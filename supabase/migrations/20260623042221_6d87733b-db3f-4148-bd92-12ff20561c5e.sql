create table public.general_feedback (
  id uuid primary key default gen_random_uuid(),
  score integer,
  text text,
  email text,
  source text,
  created_at timestamptz default now()
);

grant select, insert on public.general_feedback to anon, authenticated;
grant all on public.general_feedback to service_role;

alter table public.general_feedback enable row level security;

create policy "Anyone can submit general feedback"
  on public.general_feedback
  for insert
  to anon, authenticated
  with check (true);