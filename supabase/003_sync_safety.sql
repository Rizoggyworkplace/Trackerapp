-- Trackers Workspace v6. Apply after 001 and 002. Existing snapshots are retained.
-- This migration makes each snapshot write conditional on the version it was read from.
begin;

grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke all on public.trackly_user_state from anon;
revoke insert, update, delete on public.trackly_user_state from authenticated;
grant select on public.trackly_user_state to authenticated;

drop policy if exists trackly_select_own_state on public.trackly_user_state;
create policy trackly_select_own_state on public.trackly_user_state
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.access_enabled)
);
drop policy if exists trackly_insert_own_state on public.trackly_user_state;
drop policy if exists trackly_update_own_state on public.trackly_user_state;

create or replace function public.trackers_save_state(new_snapshot jsonb, expected_updated_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  current_stamp timestamptz;
  next_stamp timestamptz;
  has_row boolean;
begin
  if caller is null or not exists (select 1 from public.profiles p where p.user_id=caller and p.access_enabled) then
    raise exception 'access denied' using errcode='42501';
  end if;
  if jsonb_typeof(new_snapshot) is distinct from 'object'
    or jsonb_typeof(new_snapshot->'trackly') is distinct from 'object'
    or jsonb_typeof(new_snapshot->'trackly'->'sites') is distinct from 'array' then
    raise exception 'invalid workspace snapshot' using errcode='22023';
  end if;
  -- Serialize this user's first insert and subsequent writes across devices.
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  select updated_at into current_stamp from public.trackly_user_state where user_id=caller for update;
  has_row := found;
  if (has_row and current_stamp is distinct from expected_updated_at)
    or (not has_row and expected_updated_at is not null) then
    return jsonb_build_object('ok',false,'updated_at',current_stamp);
  end if;
  next_stamp := greatest(clock_timestamp(), coalesce(current_stamp, '-infinity'::timestamptz) + interval '1 microsecond');
  insert into public.trackly_user_state(user_id,snapshot,updated_at)
  values(caller,new_snapshot,next_stamp)
  on conflict(user_id) do update set snapshot=excluded.snapshot,updated_at=excluded.updated_at;
  return jsonb_build_object('ok',true,'updated_at',next_stamp);
end;
$$;
revoke all on function public.trackers_save_state(jsonb,timestamptz) from public, anon;
grant execute on function public.trackers_save_state(jsonb,timestamptz) to authenticated;

create or replace function public.trackers_admin_set_access(target_user uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where user_id=auth.uid() and access_enabled and role in ('owner','admin')) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if enabled is null or target_user=auth.uid() or not exists(select 1 from public.profiles where user_id=target_user and role<>'owner') then
    raise exception 'cannot change this account' using errcode='22023';
  end if;
  update public.profiles set access_enabled=enabled,updated_at=clock_timestamp() where user_id=target_user;
end;
$$;
revoke all on function public.trackers_admin_set_access(uuid,boolean) from public, anon;
grant execute on function public.trackers_admin_set_access(uuid,boolean) to authenticated;
commit;
