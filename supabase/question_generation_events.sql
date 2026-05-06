create table if not exists public.question_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('generate', 'regenerate')),
  source_text text,
  source_length integer not null default 0 check (source_length >= 0),
  source_kind text check (source_kind in ('url', 'youtube', 'topic', 'text', 'summary')),
  router_reason text,
  use_web_search boolean,
  semantic_score_factual numeric(6, 4),
  semantic_score_abstract numeric(6, 4),
  fact_provider text,
  fact_grounding_status text,
  cache_hit boolean not null default false,
  generation_success boolean not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  question_count smallint,
  reflection_count smallint,
  previous_question_count smallint not null default 0,
  token_provider text,
  token_model text,
  token_strategy_version text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cache_creation_input_tokens integer check (
    cache_creation_input_tokens is null or cache_creation_input_tokens >= 0
  ),
  cache_read_input_tokens integer check (cache_read_input_tokens is null or cache_read_input_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  token_usage_breakdown jsonb,
  page_path text,
  user_agent text,
  admin_label text check (admin_label is null or admin_label in ('factual', 'abstract', 'external_reference', 'ambiguous', 'spam', 'other')),
  admin_note text,
  created_at timestamptz not null default now(),
  constraint question_generation_events_source_text_check
    check (source_text is null or char_length(source_text) <= 2000),
  constraint question_generation_events_router_reason_check
    check (router_reason is null or char_length(router_reason) <= 120),
  constraint question_generation_events_error_code_check
    check (error_code is null or char_length(error_code) <= 120),
  constraint question_generation_events_admin_note_check
    check (admin_note is null or char_length(admin_note) <= 1000)
);

alter table public.question_generation_events
  add column if not exists semantic_score_factual numeric(6, 4);

alter table public.question_generation_events
  add column if not exists semantic_score_abstract numeric(6, 4);

alter table public.question_generation_events
  add column if not exists fact_provider text;

alter table public.question_generation_events
  add column if not exists fact_grounding_status text;

alter table public.question_generation_events
  add column if not exists cache_hit boolean not null default false;

alter table public.question_generation_events
  add column if not exists token_provider text;

alter table public.question_generation_events
  add column if not exists token_model text;

alter table public.question_generation_events
  add column if not exists token_strategy_version text;

alter table public.question_generation_events
  add column if not exists input_tokens integer;

alter table public.question_generation_events
  add column if not exists output_tokens integer;

alter table public.question_generation_events
  add column if not exists cache_creation_input_tokens integer;

alter table public.question_generation_events
  add column if not exists cache_read_input_tokens integer;

alter table public.question_generation_events
  add column if not exists total_tokens integer;

alter table public.question_generation_events
  add column if not exists token_usage_breakdown jsonb;

alter table public.question_generation_events
  add column if not exists admin_label text;

alter table public.question_generation_events
  add column if not exists admin_note text;

create index if not exists question_generation_events_created_at_idx
  on public.question_generation_events (created_at desc);

create index if not exists question_generation_events_router_created_at_idx
  on public.question_generation_events (router_reason, created_at desc);

create index if not exists question_generation_events_admin_label_idx
  on public.question_generation_events (admin_label, created_at desc);

alter table public.question_generation_events enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on table public.question_generation_events to anon, authenticated;

drop policy if exists "Anyone can record question generation events" on public.question_generation_events;

create policy "Anyone can record question generation events"
  on public.question_generation_events
  for insert
  to anon, authenticated
  with check (
    mode in ('generate', 'regenerate')
    and (user_id is null or user_id = auth.uid())
    and admin_label is null
    and admin_note is null
  );
