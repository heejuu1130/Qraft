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

grant usage on schema public to anon, authenticated;
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

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

grant select on table public.app_admins to authenticated;

drop policy if exists "Users can read own admin flag" on public.app_admins;

create policy "Users can read own admin flag"
  on public.app_admins
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_app_admin() to authenticated;

create table if not exists public.saved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  summary text,
  question text not null,
  question_index integer not null,
  reflection text,
  personal_note text not null default '',
  visibility text not null default 'private',
  shared_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint saved_questions_question_index_check check (question_index between 1 and 3),
  constraint saved_questions_personal_note_check check (char_length(personal_note) <= 4000),
  constraint saved_questions_reflection_check check (reflection is null or char_length(reflection) <= 4000),
  constraint saved_questions_visibility_check check (visibility in ('private', 'link', 'community'))
);

alter table public.saved_questions
  add column if not exists reflection text;

alter table public.saved_questions
  add column if not exists personal_note text not null default '';

alter table public.saved_questions
  add column if not exists visibility text not null default 'private';

alter table public.saved_questions
  add column if not exists shared_at timestamptz;

alter table public.saved_questions
  add column if not exists updated_at timestamptz not null default now();

alter table public.saved_questions
  drop constraint if exists saved_questions_personal_note_check;

alter table public.saved_questions
  add constraint saved_questions_personal_note_check check (char_length(personal_note) <= 4000);

alter table public.saved_questions
  drop constraint if exists saved_questions_reflection_check;

alter table public.saved_questions
  add constraint saved_questions_reflection_check check (reflection is null or char_length(reflection) <= 4000);

alter table public.saved_questions
  drop constraint if exists saved_questions_visibility_check;

alter table public.saved_questions
  add constraint saved_questions_visibility_check check (visibility in ('private', 'link', 'community'));

create index if not exists saved_questions_user_created_at_idx
  on public.saved_questions (user_id, created_at desc);

create index if not exists saved_questions_visibility_shared_at_idx
  on public.saved_questions (visibility, shared_at desc)
  where visibility = 'community';

with ranked_saved_questions as (
  select
    id,
    row_number() over (
      partition by user_id, md5(source), md5(question)
      order by
        case when coalesce(personal_note, '') <> '' then 1 else 0 end desc,
        case when coalesce(reflection, '') <> '' then 1 else 0 end desc,
        case when visibility = 'community' then 1 else 0 end desc,
        created_at desc,
        id desc
    ) as duplicate_rank
  from public.saved_questions
)
delete from public.saved_questions
using ranked_saved_questions
where public.saved_questions.id = ranked_saved_questions.id
  and ranked_saved_questions.duplicate_rank > 1;

create unique index if not exists saved_questions_user_source_question_hash_idx
  on public.saved_questions (user_id, md5(source), md5(question));

alter table public.saved_questions enable row level security;

grant usage on schema public to authenticated;
grant select on table public.saved_questions to anon;
grant select, insert, update, delete on table public.saved_questions to authenticated;

drop policy if exists "Users can read own saved questions" on public.saved_questions;
drop policy if exists "Anyone can read community saved questions" on public.saved_questions;
drop policy if exists "Users can insert own saved questions" on public.saved_questions;
drop policy if exists "Users can update own saved questions" on public.saved_questions;
drop policy if exists "Users can delete own saved questions" on public.saved_questions;

create policy "Users can read own saved questions"
  on public.saved_questions
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Anyone can read community saved questions"
  on public.saved_questions
  for select
  to anon, authenticated
  using (visibility = 'community');

create policy "Users can insert own saved questions"
  on public.saved_questions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own saved questions"
  on public.saved_questions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own saved questions"
  on public.saved_questions
  for delete
  to authenticated
  using (user_id = auth.uid() or (visibility = 'community' and public.is_app_admin()));

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  source text not null default '',
  summary text not null default '',
  question text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_questions_source_check check (char_length(source) <= 1000),
  constraint community_questions_summary_check check (char_length(summary) <= 4000),
  constraint community_questions_question_check check (char_length(question) between 1 and 800)
);

alter table public.community_questions
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.community_questions
  add column if not exists source text not null default '';

alter table public.community_questions
  add column if not exists summary text not null default '';

alter table public.community_questions
  add column if not exists question text not null default '';

alter table public.community_questions
  add column if not exists updated_at timestamptz not null default now();

create index if not exists community_questions_updated_at_idx
  on public.community_questions (updated_at desc);

alter table public.community_questions enable row level security;

grant select on table public.community_questions to anon, authenticated;
grant insert, update, delete on table public.community_questions to authenticated;

drop policy if exists "Anyone can read community questions" on public.community_questions;
drop policy if exists "Users can insert community questions" on public.community_questions;
drop policy if exists "Users can update own community questions" on public.community_questions;
drop policy if exists "Users can delete own community questions" on public.community_questions;

create policy "Anyone can read community questions"
  on public.community_questions
  for select
  to anon, authenticated
  using (true);

create policy "Users can insert community questions"
  on public.community_questions
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Users can update own community questions"
  on public.community_questions
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Users can delete own community questions"
  on public.community_questions
  for delete
  to authenticated
  using (created_by = auth.uid() or public.is_app_admin());

create table if not exists public.community_reflections (
  id uuid primary key default gen_random_uuid(),
  community_question_id uuid not null references public.community_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reflections_body_check check (char_length(body) between 1 and 1200)
);

create index if not exists community_reflections_question_created_at_idx
  on public.community_reflections (community_question_id, created_at asc);

create index if not exists community_reflections_user_created_at_idx
  on public.community_reflections (user_id, created_at desc);

create or replace function public.touch_community_question_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_questions
  set updated_at = coalesce(new.updated_at, now())
  where id = new.community_question_id;

  return new;
end;
$$;

drop trigger if exists community_reflections_touch_question on public.community_reflections;

create trigger community_reflections_touch_question
  after insert or update on public.community_reflections
  for each row
  execute function public.touch_community_question_updated_at();

alter table public.community_reflections enable row level security;

grant select on table public.community_reflections to anon, authenticated;
grant insert, update, delete on table public.community_reflections to authenticated;

drop policy if exists "Anyone can read community reflections" on public.community_reflections;
drop policy if exists "Users can insert own community reflections" on public.community_reflections;
drop policy if exists "Users can update own community reflections" on public.community_reflections;
drop policy if exists "Users can delete own community reflections" on public.community_reflections;

create policy "Anyone can read community reflections"
  on public.community_reflections
  for select
  to anon, authenticated
  using (true);

create policy "Users can insert own community reflections"
  on public.community_reflections
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own community reflections"
  on public.community_reflections
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own community reflections"
  on public.community_reflections
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

create table if not exists public.community_question_likes (
  community_question_id uuid not null references public.community_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_question_id, user_id)
);

create index if not exists community_question_likes_user_created_at_idx
  on public.community_question_likes (user_id, created_at desc);

alter table public.community_question_likes enable row level security;

grant select on table public.community_question_likes to anon, authenticated;
grant insert, delete on table public.community_question_likes to authenticated;

drop policy if exists "Anyone can read community question likes" on public.community_question_likes;
drop policy if exists "Users can like community questions" on public.community_question_likes;
drop policy if exists "Users can unlike own community question likes" on public.community_question_likes;

create policy "Anyone can read community question likes"
  on public.community_question_likes
  for select
  to anon, authenticated
  using (true);

create policy "Users can like community questions"
  on public.community_question_likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can unlike own community question likes"
  on public.community_question_likes
  for delete
  to authenticated
  using (user_id = auth.uid());
