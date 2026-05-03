create table if not exists public.question_generation_cache (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_text text not null,
  source_kind text not null check (source_kind in ('url', 'youtube', 'topic')),
  summary text not null,
  questions jsonb not null default '[]'::jsonb,
  reflections jsonb not null default '[]'::jsonb,
  router_reason text,
  use_web_search boolean,
  fact_provider text,
  fact_grounding_status text,
  hit_count integer not null default 0 check (hit_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_generation_cache_source_text_check check (char_length(source_text) <= 2000),
  constraint question_generation_cache_source_key_check check (char_length(source_key) between 16 and 128),
  constraint question_generation_cache_questions_array_check check (jsonb_typeof(questions) = 'array'),
  constraint question_generation_cache_reflections_array_check check (jsonb_typeof(reflections) = 'array')
);

alter table public.question_generation_cache
  add column if not exists router_reason text;

alter table public.question_generation_cache
  add column if not exists use_web_search boolean;

alter table public.question_generation_cache
  add column if not exists fact_provider text;

alter table public.question_generation_cache
  add column if not exists fact_grounding_status text;

alter table public.question_generation_cache
  add column if not exists hit_count integer not null default 0;

alter table public.question_generation_cache
  add column if not exists expires_at timestamptz;

alter table public.question_generation_cache
  add column if not exists updated_at timestamptz not null default now();

create index if not exists question_generation_cache_expires_at_idx
  on public.question_generation_cache (expires_at);

create index if not exists question_generation_cache_source_kind_idx
  on public.question_generation_cache (source_kind, updated_at desc);

alter table public.question_generation_cache enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on table public.question_generation_cache from anon, authenticated;

create or replace function public.get_question_generation_cache(cache_source_key text)
returns table (
  summary text,
  questions jsonb,
  reflections jsonb,
  router_reason text,
  use_web_search boolean,
  fact_provider text,
  fact_grounding_status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.question_generation_cache as cache
    set hit_count = cache.hit_count + 1,
        updated_at = now()
    where cache.source_key = cache_source_key
      and cache.expires_at > now()
    returning
      cache.summary,
      cache.questions,
      cache.reflections,
      cache.router_reason,
      cache.use_web_search,
      cache.fact_provider,
      cache.fact_grounding_status,
      cache.expires_at;
end;
$$;

create or replace function public.upsert_question_generation_cache(
  cache_source_key text,
  cache_source_text text,
  cache_source_kind text,
  cache_summary text,
  cache_questions jsonb,
  cache_reflections jsonb,
  cache_expires_at timestamptz,
  cache_router_reason text default null,
  cache_use_web_search boolean default null,
  cache_fact_provider text default null,
  cache_fact_grounding_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if cache_source_kind not in ('url', 'youtube', 'topic') then
    raise exception 'Unsupported cache source kind: %', cache_source_kind;
  end if;

  if jsonb_typeof(cache_questions) <> 'array' or jsonb_typeof(cache_reflections) <> 'array' then
    raise exception 'Cached questions and reflections must be JSON arrays';
  end if;

  insert into public.question_generation_cache (
    source_key,
    source_text,
    source_kind,
    summary,
    questions,
    reflections,
    router_reason,
    use_web_search,
    fact_provider,
    fact_grounding_status,
    expires_at,
    updated_at
  )
  values (
    cache_source_key,
    left(cache_source_text, 2000),
    cache_source_kind,
    cache_summary,
    cache_questions,
    cache_reflections,
    cache_router_reason,
    cache_use_web_search,
    cache_fact_provider,
    cache_fact_grounding_status,
    cache_expires_at,
    now()
  )
  on conflict (source_key) do update
    set source_text = excluded.source_text,
        source_kind = excluded.source_kind,
        summary = excluded.summary,
        questions = excluded.questions,
        reflections = excluded.reflections,
        router_reason = excluded.router_reason,
        use_web_search = excluded.use_web_search,
        fact_provider = excluded.fact_provider,
        fact_grounding_status = excluded.fact_grounding_status,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;

revoke all on function public.get_question_generation_cache(text) from public;
revoke all on function public.upsert_question_generation_cache(
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  timestamptz,
  text,
  boolean,
  text,
  text
) from public;

grant execute on function public.get_question_generation_cache(text) to anon, authenticated;
grant execute on function public.upsert_question_generation_cache(
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  timestamptz,
  text,
  boolean,
  text,
  text
) to anon, authenticated;
