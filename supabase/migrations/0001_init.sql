-- Time Tracker: initial cloud schema (schema version 1).
--
-- Run once in the Supabase SQL Editor (or `supabase db push`). Idempotent:
-- safe to re-run. The app embeds this file verbatim and offers it via the
-- "Copy install SQL" button, so keep it self-contained.

-- ---------------------------------------------------------------------------
-- Shared trigger: server-side updated_at (immune to device clock skew)
-- ---------------------------------------------------------------------------
create or replace function public.tt_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- time_entries: one row per interval. The running timer is the row with
-- end_time IS NULL. Deletions are soft (deleted = true) so other devices can
-- learn about them through the incremental pull.
-- ---------------------------------------------------------------------------
create table if not exists public.time_entries (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text,
  description text,
  start_time  bigint not null,          -- epoch ms
  end_time    bigint,                   -- epoch ms; NULL = running
  duration    bigint not null default 0, -- ms
  started_by  jsonb,                    -- { deviceId, deviceName, browser }
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- At most one running timer per user.
create unique index if not exists time_entries_one_running_per_user
  on public.time_entries (user_id)
  where end_time is null and not deleted;

-- Incremental pull: "rows changed since <cursor>".
create index if not exists time_entries_user_updated
  on public.time_entries (user_id, updated_at);

drop trigger if exists time_entries_touch on public.time_entries;
create trigger time_entries_touch
  before insert or update on public.time_entries
  for each row execute function public.tt_touch_updated_at();

-- ---------------------------------------------------------------------------
-- user_settings: key/value preferences (same keys as the JSON backup).
-- Last-writer-wins per key, never per snapshot.
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null,
  value      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_settings_user_updated
  on public.user_settings (user_id, updated_at);

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch
  before insert or update on public.user_settings
  for each row execute function public.tt_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: every user only ever sees and writes their own rows.
-- ---------------------------------------------------------------------------
alter table public.time_entries  enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "own entries" on public.time_entries;
create policy "own entries" on public.time_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.time_entries, public.user_settings from anon;
grant select, insert, update, delete on public.time_entries, public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: push row changes to the user's other devices.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_entries'
  ) then
    alter publication supabase_realtime add table public.time_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table public.user_settings;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Maintenance: drop tombstones older than 90 days (run manually or via pg_cron).
-- ---------------------------------------------------------------------------
create or replace function public.purge_tombstones()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.time_entries
    where deleted and updated_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.purge_tombstones() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schema version: the app checks this after login. Bump it in every new
-- migration (0002_*.sql → 2, …) and in CLOUD_SCHEMA_VERSION in the app.
-- ---------------------------------------------------------------------------
create or replace function public.schema_version()
returns integer
language sql
stable
as $$ select 1 $$;

grant execute on function public.schema_version() to anon, authenticated;
