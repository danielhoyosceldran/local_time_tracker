-- Time Tracker: schema version 4.
--
-- Run once in the Supabase SQL Editor after 0003_row_checks.sql. Idempotent.
--
-- Edit lock (mutex): only ONE app instance per account may write. The first
-- one to open the app takes the lock; every other instance is read-only until
-- the lock is released or goes stale.
--
-- * Each instance (browser tab) has a random id. It calls claim_lock() every
--   minute: the holder refreshes heartbeat_at, the others take the lock only
--   if it has not been refreshed for 2 minutes. Closing the app calls
--   release_lock() so the next instance does not wait those 2 minutes.
-- * claim_lock() is one atomic INSERT ... ON CONFLICT DO UPDATE ... WHERE: two
--   instances claiming at the same instant cannot both win (the row lock
--   serializes them and the loser's WHERE no longer matches). All times are
--   the server's now(), so device clocks do not matter.
-- * Fencing: every write to time_entries / user_settings must carry the
--   writer's instance id (writer_instance), and a trigger refuses it (SQLSTATE
--   TT409) unless that instance is the current holder. An instance that froze
--   (background tab, sleep, offline) and lost the lock meanwhile cannot
--   overwrite what the new holder wrote when it wakes up.
-- * Backups restored with session_replication_role = replica skip triggers,
--   so restoring is not blocked by the lock.

-- ---------------------------------------------------------------------------
-- app_lock: one row per user.
-- ---------------------------------------------------------------------------
create table if not exists public.app_lock (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  holder       text not null,          -- instance id of the holder
  device       jsonb,                  -- { deviceId, deviceName, browser } for "in use on …"
  heartbeat_at timestamptz not null default now(),
  constraint app_lock_holder_len check (char_length(holder) <= 100),
  constraint app_lock_device_shape check (
    device is null or (jsonb_typeof(device) = 'object' and pg_column_size(device) <= 2048)
  )
);

alter table public.app_lock enable row level security;

drop policy if exists "own lock" on public.app_lock;
create policy "own lock" on public.app_lock
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.app_lock from anon;
grant select, insert, update on public.app_lock to authenticated;

-- ---------------------------------------------------------------------------
-- claim_lock: take or refresh the lock. Returns who holds it afterwards.
-- p_force takes it even from a live holder ("take control").
-- ---------------------------------------------------------------------------
create or replace function public.claim_lock(
  p_instance text,
  p_device   jsonb default null,
  p_force    boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur public.app_lock;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.app_lock as l (user_id, holder, device, heartbeat_at)
  values (uid, p_instance, p_device, now())
  on conflict (user_id) do update
    set holder = excluded.holder,
        device = excluded.device,
        heartbeat_at = now()
    where l.holder = excluded.holder
       or l.heartbeat_at < now() - interval '2 minutes'
       or p_force;

  select * into cur from public.app_lock where user_id = uid;
  return jsonb_build_object(
    'acquired', cur.holder = p_instance,
    'holder', cur.holder,
    'device', cur.device,
    'heartbeat_at', cur.heartbeat_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- release_lock: the holder lets go (app closed / signed out). The row stays;
-- it just looks stale, so the next claim from any instance wins.
-- ---------------------------------------------------------------------------
create or replace function public.release_lock(p_instance text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.app_lock
     set heartbeat_at = '-infinity'
   where user_id = (select auth.uid()) and holder = p_instance;
$$;

revoke execute on function public.claim_lock(text, jsonb, boolean) from public, anon;
revoke execute on function public.release_lock(text) from public, anon;
grant execute on function public.claim_lock(text, jsonb, boolean) to authenticated;
grant execute on function public.release_lock(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fencing: refuse writes from an instance that does not hold the lock.
-- ---------------------------------------------------------------------------
alter table public.time_entries  add column if not exists writer_instance text;
alter table public.user_settings add column if not exists writer_instance text;

create or replace function public.tt_require_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_lock l
    where l.user_id = new.user_id and l.holder = new.writer_instance
  ) then
    raise exception 'This app instance does not hold the edit lock'
      using errcode = 'TT409';
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_require_lock on public.time_entries;
create trigger time_entries_require_lock
  before insert or update on public.time_entries
  for each row execute function public.tt_require_lock();

drop trigger if exists user_settings_require_lock on public.user_settings;
create trigger user_settings_require_lock
  before insert or update on public.user_settings
  for each row execute function public.tt_require_lock();

create or replace function public.schema_version()
returns integer
language sql
stable
as $$ select 4 $$;

grant execute on function public.schema_version() to anon, authenticated;
