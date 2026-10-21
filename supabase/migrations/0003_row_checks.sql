-- Time Tracker: schema version 3.
--
-- Run once in the Supabase SQL Editor after 0002_keep_closed_entries.sql.
-- Idempotent.
--
-- Server-side validation, so an inconsistent row (from a hand-edited backup or
-- a buggy client) is refused instead of stored. A refused row fails with
-- 23514 (check_violation): the app moves it to its "rejected rows" list and
-- keeps syncing the rest.
--
-- Tombstones (deleted = true) are exempt: a delete must always go through,
-- whatever the old row looked like.
--
-- The constraints are added NOT VALID (they apply to every new insert/update)
-- and then validated against the existing rows. If old rows break a rule, the
-- validation is skipped with a NOTICE and the constraint still protects new
-- writes; fix those rows and run this file again to validate it.

alter table public.time_entries
  drop constraint if exists time_entries_times_ok,
  drop constraint if exists time_entries_text_len,
  drop constraint if exists time_entries_started_by_shape;

alter table public.time_entries
  add constraint time_entries_times_ok check (
    deleted or (
      start_time >= 0
      and duration >= 0
      and (end_time is null or end_time >= start_time)
    )
  ) not valid,
  add constraint time_entries_text_len check (
    deleted or (
      coalesce(char_length(title), 0) <= 1000
      and coalesce(char_length(description), 0) <= 10000
    )
  ) not valid,
  add constraint time_entries_started_by_shape check (
    deleted or started_by is null or (
      jsonb_typeof(started_by) = 'object'
      and pg_column_size(started_by) <= 2048
    )
  ) not valid;

alter table public.user_settings
  drop constraint if exists user_settings_len;

alter table public.user_settings
  add constraint user_settings_len check (
    char_length(key) <= 100
    and coalesce(char_length(value), 0) <= 200000
  ) not valid;

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('public.time_entries'::regclass,  'time_entries_times_ok'),
      ('public.time_entries'::regclass,  'time_entries_text_len'),
      ('public.time_entries'::regclass,  'time_entries_started_by_shape'),
      ('public.user_settings'::regclass, 'user_settings_len')
    ) as t(tbl, name)
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.name);
    exception when check_violation then
      raise notice 'Existing rows break %; it only applies to new writes until they are fixed.', c.name;
    end;
  end loop;
end;
$$;

create or replace function public.schema_version()
returns integer
language sql
stable
as $$ select 3 $$;

grant execute on function public.schema_version() to anon, authenticated;
