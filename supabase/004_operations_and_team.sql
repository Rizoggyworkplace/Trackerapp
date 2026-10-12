-- Trackers v7. Run once AFTER 001, 002, 003. Existing personal snapshots are retained.
begin;
alter table public.profiles add column if not exists workspace_owner_id uuid references auth.users(id);
create index if not exists profiles_workspace_owner on public.profiles(workspace_owner_id);
create or replace function public.trackers_workspace_id() returns uuid
language sql stable security definer set search_path = '' as $$
 select coalesce(p.workspace_owner_id,p.user_id) from public.profiles p
 join public.profiles o on o.user_id=coalesce(p.workspace_owner_id,p.user_id)
 where p.user_id=auth.uid() and p.access_enabled and o.access_enabled;
$$;
revoke all on function public.trackers_workspace_id() from public,anon;
grant execute on function public.trackers_workspace_id() to authenticated;
drop policy if exists trackly_select_own_state on public.trackly_user_state;
create policy trackly_select_own_state on public.trackly_user_state for select to authenticated
 using(user_id=(select public.trackers_workspace_id()));

create table if not exists public.trackers_audit(
 id bigint generated always as identity primary key,
 workspace_owner_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 actor_email text,
 created_at timestamptz not null default clock_timestamp(),
 changes jsonb not null
);
create index if not exists trackers_audit_workspace on public.trackers_audit(workspace_owner_id,id desc);
alter table public.trackers_audit enable row level security;
revoke all on public.trackers_audit from anon,authenticated;
grant select on public.trackers_audit to authenticated;
drop policy if exists trackers_audit_read on public.trackers_audit;
create policy trackers_audit_read on public.trackers_audit for select to authenticated
 using(workspace_owner_id=(select public.trackers_workspace_id()));

-- Server derives field changes from authoritative snapshots, never client audit entries.
create or replace function public.trackers_snapshot_changes(old_snapshot jsonb,new_snapshot jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb := '[]'; section text; old_rows jsonb; new_rows jsonb; row_change record; fields jsonb; key_name text; av jsonb; bv jsonb;
begin
 foreach section in array array['sites','notes','bastProcesses','clients','rules','pkbon_history'] loop
  if section='pkbon_history' then
   old_rows:=coalesce(old_snapshot->'pkbon'->section,'[]');new_rows:=coalesce(new_snapshot->'pkbon'->section,'[]');
  else
   old_rows:=coalesce(old_snapshot->'trackly'->section,'[]');new_rows:=coalesce(new_snapshot->'trackly'->section,'[]');
  end if;
  if jsonb_typeof(old_rows)<>'array' then old_rows:='[]';end if;
  if jsonb_typeof(new_rows)<>'array' then raise exception 'invalid data array: %',section;end if;
  for row_change in
   select a.value as before_value,b.value as after_value,coalesce(b.value->>'id',a.value->>'id') as entity_id
   from jsonb_array_elements(old_rows) a full join jsonb_array_elements(new_rows) b on a.value->>'id'=b.value->>'id'
   where a.value is distinct from b.value
  loop
   fields:='[]';
   for key_name in select jsonb_object_keys(coalesce(row_change.before_value,'{}')) union select jsonb_object_keys(coalesce(row_change.after_value,'{}')) loop
    av:=row_change.before_value->key_name;bv:=row_change.after_value->key_name;
    if av is distinct from bv then fields:=fields||jsonb_build_array(jsonb_build_object('field',key_name,'before',av,'after',bv));end if;
   end loop;
   result:=result||jsonb_build_array(jsonb_build_object('entity',section,'entityId',row_change.entity_id,
    'name',coalesce(row_change.after_value->>'siteName',row_change.before_value->>'siteName',row_change.after_value->>'pkbonNo',row_change.before_value->>'pkbonNo',row_change.after_value->>'title',row_change.before_value->>'title',row_change.entity_id),
    'action',case when row_change.before_value is null then 'Tambah' when row_change.after_value is null then 'Hapus' else 'Ubah' end,'fields',fields));
  end loop;
 end loop;
 foreach section in array array['pkbon_settings','pkbon_sites','pkbon_banks','pkbon_templates','pkbon_officers','tenants'] loop
  if section='tenants' then av:=old_snapshot->'trackly'->section;bv:=new_snapshot->'trackly'->section;
  else av:=old_snapshot->'pkbon'->section;bv:=new_snapshot->'pkbon'->section;end if;
  if av is distinct from bv then result:=result||jsonb_build_array(jsonb_build_object('entity',section,'name',section,'action','Ubah','fields',jsonb_build_array(jsonb_build_object('field',section,'before',av,'after',bv))));end if;
 end loop;
 return result;
end;$$;
revoke all on function public.trackers_snapshot_changes(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.trackers_save_state(new_snapshot jsonb, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid:=auth.uid(); member public.profiles%rowtype; owner_id uuid; old_row public.trackly_user_state%rowtype; next_stamp timestamptz; changes jsonb;has_row boolean;
begin
 select * into member from public.profiles where user_id=caller for share;
 owner_id:=public.trackers_workspace_id();
 if owner_id is null or member.role not in ('owner','admin','project_manager','regional_pic') then raise exception 'workspace is read-only or access denied' using errcode='42501';end if;
 if jsonb_typeof(new_snapshot) is distinct from 'object' or jsonb_typeof(new_snapshot->'trackly') is distinct from 'object' or jsonb_typeof(new_snapshot->'trackly'->'sites') is distinct from 'array' then raise exception 'invalid workspace snapshot' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 select * into old_row from public.trackly_user_state where user_id=owner_id for update;has_row:=found;
 if (has_row and old_row.updated_at is distinct from expected_updated_at) or (not has_row and expected_updated_at is not null) then return jsonb_build_object('ok',false,'updated_at',old_row.updated_at);end if;
 changes:=public.trackers_snapshot_changes(old_row.snapshot,new_snapshot);
 next_stamp:=greatest(clock_timestamp(),coalesce(old_row.updated_at,'-infinity'::timestamptz)+interval '1 microsecond');
 insert into public.trackly_user_state(user_id,snapshot,updated_at) values(owner_id,new_snapshot,next_stamp)
 on conflict(user_id) do update set snapshot=excluded.snapshot,updated_at=excluded.updated_at;
 if jsonb_array_length(changes)>0 then insert into public.trackers_audit(workspace_owner_id,actor_id,actor_email,changes) values(owner_id,caller,member.email,changes);end if;
 return jsonb_build_object('ok',true,'updated_at',next_stamp);
end;$$;
revoke all on function public.trackers_save_state(jsonb,timestamptz) from public,anon;
grant execute on function public.trackers_save_state(jsonb,timestamptz) to authenticated;

create or replace function public.trackly_admin_list_profiles()
returns table(user_id uuid,email text,full_name text,role text,access_enabled boolean)
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid:=public.trackers_workspace_id();
begin
 if owner_id is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('owner','admin')) then raise exception 'not authorized';end if;
 return query select p.user_id,p.email,p.full_name,p.role,p.access_enabled from public.profiles p where coalesce(p.workspace_owner_id,p.user_id)=owner_id order by p.created_at;
end;$$;
create or replace function public.trackly_admin_set_role(target_user uuid,new_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid:=public.trackers_workspace_id();target public.profiles%rowtype;
begin
 if owner_id is null or not exists(select 1 from public.profiles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'not authorized';end if;
 if new_role is null or new_role not in ('admin','project_manager','regional_pic','viewer') then raise exception 'invalid role';end if;
 select * into target from public.profiles where user_id=target_user for update;
 if target_user=auth.uid() or target.role='owner' or target.user_id is null or coalesce(target.workspace_owner_id,target.user_id)<>owner_id then raise exception 'cannot change this account';end if;
 update public.profiles set role=new_role,updated_at=clock_timestamp() where user_id=target_user;
 insert into public.trackers_audit(workspace_owner_id,actor_id,actor_email,changes) values(owner_id,auth.uid(),(select email from public.profiles where user_id=auth.uid()),jsonb_build_array(jsonb_build_object('entity','member','name',target.email,'action','Ubah role','fields',jsonb_build_array(jsonb_build_object('field','role','before',target.role,'after',new_role)))));
end;$$;
create or replace function public.trackers_admin_set_access(target_user uuid,enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid:=public.trackers_workspace_id();target public.profiles%rowtype;
begin
 if owner_id is null or not exists(select 1 from public.profiles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'not authorized';end if;
 select * into target from public.profiles where user_id=target_user for update;
 if enabled is null or target_user=auth.uid() or target.role='owner' or target.user_id is null or coalesce(target.workspace_owner_id,target.user_id)<>owner_id then raise exception 'cannot change this account';end if;
 update public.profiles set access_enabled=enabled,updated_at=clock_timestamp() where user_id=target_user;
 insert into public.trackers_audit(workspace_owner_id,actor_id,actor_email,changes) values(owner_id,auth.uid(),(select email from public.profiles where user_id=auth.uid()),jsonb_build_array(jsonb_build_object('entity','member','name',target.email,'action','Ubah akses','fields',jsonb_build_array(jsonb_build_object('field','access_enabled','before',target.access_enabled,'after',enabled)))));
end;$$;
create or replace function public.trackers_team_add(member_email text,member_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid:=public.trackers_workspace_id();target public.profiles%rowtype;
begin
 if owner_id is null or not exists(select 1 from public.profiles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'not authorized';end if;
 if member_role is null or member_role not in ('admin','project_manager','regional_pic','viewer') then raise exception 'invalid role';end if;
 select * into target from public.profiles where lower(email)=lower(trim(member_email)) for update;
 if not found then raise exception 'Akun belum ada. Buat akun di Supabase Authentication terlebih dahulu.';end if;
 if target.user_id=auth.uid() or target.role='owner' or (target.workspace_owner_id is not null and target.workspace_owner_id<>owner_id) or exists(select 1 from public.profiles where workspace_owner_id=target.user_id) then raise exception 'Akun sudah mengelola atau tergabung dalam workspace lain.';end if;
 update public.profiles set workspace_owner_id=owner_id,role=member_role,access_enabled=true,updated_at=clock_timestamp() where user_id=target.user_id;
 insert into public.trackers_audit(workspace_owner_id,actor_id,actor_email,changes) values(owner_id,auth.uid(),(select email from public.profiles where user_id=auth.uid()),jsonb_build_array(jsonb_build_object('entity','member','name',target.email,'action','Tambah anggota','fields',jsonb_build_array(jsonb_build_object('field','role','before',target.role,'after',member_role)))));
end;$$;
revoke all on function public.trackly_admin_list_profiles() from public,anon;
revoke all on function public.trackly_admin_set_role(uuid,text) from public,anon;
revoke all on function public.trackers_admin_set_access(uuid,boolean) from public,anon;
revoke all on function public.trackers_team_add(text,text) from public,anon;
grant execute on function public.trackly_admin_list_profiles() to authenticated;
grant execute on function public.trackly_admin_set_role(uuid,text) to authenticated;
grant execute on function public.trackers_admin_set_access(uuid,boolean) to authenticated;
grant execute on function public.trackers_team_add(text,text) to authenticated;
commit;
