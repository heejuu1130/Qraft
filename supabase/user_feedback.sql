create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text,
  rating smallint,
  page_path text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint user_feedback_message_check check (message is null or char_length(btrim(message)) between 2 and 1200),
  constraint user_feedback_rating_check check (rating is null or rating between 1 and 5),
  constraint user_feedback_content_check check (message is not null or rating is not null)
);

alter table public.user_feedback
  add column if not exists rating smallint;

alter table public.user_feedback
  alter column message drop not null;

alter table public.user_feedback
  drop constraint if exists user_feedback_message_check;

alter table public.user_feedback
  drop constraint if exists user_feedback_rating_check;

alter table public.user_feedback
  drop constraint if exists user_feedback_content_check;

alter table public.user_feedback
  add constraint user_feedback_message_check
  check (message is null or char_length(btrim(message)) between 2 and 1200);

alter table public.user_feedback
  add constraint user_feedback_rating_check
  check (rating is null or rating between 1 and 5);

alter table public.user_feedback
  add constraint user_feedback_content_check
  check (message is not null or rating is not null);

alter table public.user_feedback enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on table public.user_feedback to anon, authenticated;

drop policy if exists "Anyone can submit feedback" on public.user_feedback;

create policy "Anyone can submit feedback"
  on public.user_feedback
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
