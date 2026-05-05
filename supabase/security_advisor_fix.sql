-- Run this after the main schema SQL to clear Supabase Advisor function warnings.
-- The leaked password protection warning is an Auth dashboard setting, not a SQL setting.

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'alter function public.handle_new_user() set search_path = public';
    execute 'revoke execute on function public.handle_new_user() from public';
    execute 'revoke execute on function public.handle_new_user() from anon';
    execute 'revoke execute on function public.handle_new_user() from authenticated';
  end if;
end;
$$;

alter function public.get_question_generation_cache(text)
  set search_path = '';

alter function public.upsert_question_generation_cache(
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
)
  set search_path = '';

revoke execute on function public.get_question_generation_cache(text)
  from public, anon, authenticated;

revoke execute on function public.upsert_question_generation_cache(
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
)
  from public, anon, authenticated;

grant usage on schema public to service_role;

grant execute on function public.get_question_generation_cache(text)
  to service_role;

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
)
  to service_role;
