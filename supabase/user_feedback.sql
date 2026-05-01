create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null check (char_length(btrim(message)) between 2 and 1200),
  page_path text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on table public.user_feedback to anon, authenticated;

drop policy if exists "Anyone can submit feedback" on public.user_feedback;

create policy "Anyone can submit feedback"
  on public.user_feedback
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
