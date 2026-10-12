-- Trackers Workspace: user profiles + secure role administration
-- Run after 001_user_state.sql in Supabase SQL Editor.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer' check (role in ('owner','admin','project_manager','regional_pic','viewer')),
  access_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Backfill existing Auth users. The earliest account becomes Owner only if there is no Owner yet.
insert into public.profiles (user_id,email,full_name,role,access_enabled,created_at,updated_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email,''),'@',1)),
  'viewer',
  true,
  coalesce(u.created_at,now()),
  now()
from auth.users u
on conflict (user_id) do update
set email=excluded.email,
    full_name=coalesce(public.profiles.full_name,excluded.full_name),
    updated_at=now();

do $$
begin
  if not exists (select 1 from public.profiles where role='owner') then
    update public.profiles
      set role='owner', updated_at=now()
    where user_id=(select user_id from public.profiles order by created_at asc limit 1);
  end if;
end $$;

-- New Auth users automatically receive a profile.
create or replace function public.trackers_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id,email,full_name,role,access_enabled)
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,''),'@',1)),
    'viewer',
    true
  )
  on conflict (user_id) do update
    set email=excluded.email,
        full_name=coalesce(public.profiles.full_name,excluded.full_name),
        updated_at=now();
  return new;
end;
$$;

drop trigger if exists trackers_on_auth_user_created on auth.users;
create trigger trackers_on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.trackers_handle_new_user();

-- A signed-in user can read only their own profile directly.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE policies are granted to clients.
-- Administrative changes go through the guarded RPC below.

create or replace function public.trackly_admin_list_profiles()
returns table(
  user_id uuid,
  email text,
  full_name text,
  role text,
  access_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_enabled boolean;
begin
  select p.role,p.access_enabled into caller_role,caller_enabled
  from public.profiles p where p.user_id=auth.uid();

  if caller_enabled is distinct from true or caller_role not in ('owner','admin') then
    raise exception 'not authorized';
  end if;

  return query
  select p.user_id,p.email,p.full_name,p.role,p.access_enabled
  from public.profiles p
  order by case p.role when 'owner' then 0 when 'admin' then 1 else 2 end,
           p.full_name nulls last,
           p.email;
end;
$$;

create or replace function public.trackly_admin_set_role(target_user uuid,new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_enabled boolean;
  target_role text;
begin
  if new_role not in ('admin','project_manager','regional_pic','viewer') then
    raise exception 'invalid role';
  end if;

  select p.role,p.access_enabled into caller_role,caller_enabled
  from public.profiles p where p.user_id=auth.uid();

  if caller_enabled is distinct from true or caller_role not in ('owner','admin') then
    raise exception 'not authorized';
  end if;

  if target_user = auth.uid() then
    raise exception 'cannot change your own role';
  end if;

  select p.role into target_role from public.profiles p where p.user_id=target_user;
  if target_role is null then
    raise exception 'target user not found';
  end if;

  if target_role='owner' then
    raise exception 'owner role cannot be changed from the app';
  end if;

  update public.profiles
  set role=new_role,updated_at=now()
  where user_id=target_user;
end;
$$;

revoke all on function public.trackly_admin_list_profiles() from public;
revoke all on function public.trackly_admin_set_role(uuid,text) from public;
grant execute on function public.trackly_admin_list_profiles() to authenticated;
grant execute on function public.trackly_admin_set_role(uuid,text) to authenticated;
