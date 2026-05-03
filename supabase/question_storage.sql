create table if not exists public.question_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  summary text not null,
  questions jsonb not null default '[]'::jsonb,
  reflections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint question_history_questions_array_check check (jsonb_typeof(questions) = 'array'),
  constraint question_history_reflections_array_check check (jsonb_typeof(reflections) = 'array')
);

create index if not exists question_history_user_created_at_idx
  on public.question_history (user_id, created_at desc);

alter table public.question_history enable row level security;

grant usage on schema public to authenticated;
grant select, insert, delete on table public.question_history to authenticated;

drop policy if exists "Users can read own question history" on public.question_history;
drop policy if exists "Users can insert own question history" on public.question_history;
drop policy if exists "Users can delete own question history" on public.question_history;

create policy "Users can read own question history"
  on public.question_history
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own question history"
  on public.question_history
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own question history"
  on public.question_history
  for delete
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.saved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  summary text,
  question text not null,
  question_index integer not null,
  created_at timestamptz not null default now(),
  constraint saved_questions_question_index_check check (question_index between 1 and 3)
);

create index if not exists saved_questions_user_created_at_idx
  on public.saved_questions (user_id, created_at desc);

alter table public.saved_questions enable row level security;

grant usage on schema public to authenticated;
grant select, insert, delete on table public.saved_questions to authenticated;

drop policy if exists "Users can read own saved questions" on public.saved_questions;
drop policy if exists "Users can insert own saved questions" on public.saved_questions;
drop policy if exists "Users can delete own saved questions" on public.saved_questions;

create policy "Users can read own saved questions"
  on public.saved_questions
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own saved questions"
  on public.saved_questions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own saved questions"
  on public.saved_questions
  for delete
  to authenticated
  using (user_id = auth.uid());
