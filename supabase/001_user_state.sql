-- Trackers Workspace — per-user cloud snapshot
-- Run this first in Supabase SQL Editor.

create table if not exists public.trackly_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Compatibility with an older build that used a `payload` column.
alter table public.trackly_user_state
  add column if not exists snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trackly_user_state' and column_name='payload'
  ) then
    execute $q$
      update public.trackly_user_state
      set snapshot = payload
      where (snapshot is null or snapshot = '{}'::jsonb)
        and payload is not null
    $q$;
  end if;
end $$;

alter table public.trackly_user_state enable row level security;

drop policy if exists "trackly_select_own_state" on public.trackly_user_state;
create policy "trackly_select_own_state" on public.trackly_user_state
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "trackly_insert_own_state" on public.trackly_user_state;
create policy "trackly_insert_own_state" on public.trackly_user_state
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "trackly_update_own_state" on public.trackly_user_state;
create policy "trackly_update_own_state" on public.trackly_user_state
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.trackly_user_state to authenticated;
