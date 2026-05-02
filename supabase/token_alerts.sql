create table if not exists public.token_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null default 'qraft_token_exhausted',
  mode text not null check (mode in ('generate', 'regenerate')),
  source_kind text,
  page_path text,
  user_agent text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.token_alerts enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on table public.token_alerts to anon, authenticated;

drop policy if exists "Anyone can record token alerts" on public.token_alerts;

create policy "Anyone can record token alerts"
  on public.token_alerts
  for insert
  to anon, authenticated
  with check (
    event = 'qraft_token_exhausted'
    and mode in ('generate', 'regenerate')
    and (user_id is null or user_id = auth.uid())
  );
