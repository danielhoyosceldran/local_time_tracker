-- Time Tracker: schema version 2.
--
-- Run once in the Supabase SQL Editor after 0001_init.sql. Idempotent.
--
-- 1. A completed entry never goes back to "running". Sync is last-writer-wins
--    per row, so a device that edited the running timer offline would
--    otherwise re-open (end_time = NULL) a timer another device already
--    stopped. The other fields of that write (title, description, …) still
--    apply; only the stop is preserved.
-- 2. Pin search_path on the updated_at trigger (Supabase linter 0011).

create or replace function public.tt_keep_closed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.end_time is not null and new.end_time is null and not new.deleted then
    new.end_time := old.end_time;
    new.duration := old.duration;
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_keep_closed on public.time_entries;
create trigger time_entries_keep_closed
  before update on public.time_entries
  for each row execute function public.tt_keep_closed();

alter function public.tt_touch_updated_at() set search_path = '';

create or replace function public.schema_version()
returns integer
language sql
stable
as $$ select 2 $$;

grant execute on function public.schema_version() to anon, authenticated;
