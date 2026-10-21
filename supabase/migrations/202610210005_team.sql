-- Team commands. No direct client writes and no privileged Auth key in clients.
begin;
alter table public.sfa_resident_access add column can_share_location boolean not null default false;
-- Preserve the previous explicit configuration permission as a separate GPS capability.
update public.sfa_resident_access a set can_share_location=true where a.can_configure and a.revoked_at is null
  and exists(select 1 from public.sfa_memberships m where m.space_id=a.space_id and m.user_id=a.user_id
    and m.role='caregiver' and m.revoked_at is null);
create table sfa_private.team_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.sfa_spaces(id),
  email text not null,
  role text not null check(role in ('admin','caregiver','resident')),
  resident_ids uuid[] not null,
  can_configure boolean not null,
  can_share_location boolean not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique(space_id,email)
);
alter table sfa_private.team_invites enable row level security;
revoke all on sfa_private.team_invites from public,anon,authenticated;
grant all on sfa_private.team_invites to service_role;

create function sfa_private.validate_team_access(p_space uuid,p_role text,p_residents uuid[],p_configure boolean,p_share boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_role is null or p_role not in ('admin','caregiver','resident') or p_residents is null
    or p_configure is null or p_share is null or cardinality(p_residents)>60
    or (p_role='resident' and (cardinality(p_residents)<>1 or p_configure))
    or (p_role='admin' and (cardinality(p_residents)<>0 or p_configure or p_share)) then
    raise exception 'Invalid access' using errcode='22023'; end if;
  if cardinality(p_residents)<>(select count(distinct r.id) from public.sfa_residents r
    where r.id=any(p_residents) and r.space_id=p_space and r.archived_at is null) then
    raise exception 'Resident outside space' using errcode='42501'; end if;
end $$;
revoke all on function sfa_private.validate_team_access(uuid,text,uuid[],boolean,boolean) from public,anon,authenticated;

create function public.sfa_team(p_space uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not sfa_private.is_admin(p_space) then raise exception 'Administrator required' using errcode='42501'; end if;
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,
      'access',coalesce((select jsonb_agg(jsonb_build_object('resident_id',a.resident_id,
        'can_configure',a.can_configure,'can_share_location',a.can_share_location))
        from public.sfa_resident_access a where a.space_id=p_space and a.user_id=m.user_id and a.revoked_at is null),'[]'::jsonb)) order by u.email)
      from public.sfa_memberships m join auth.users u on u.id=m.user_id where m.space_id=p_space and m.revoked_at is null),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'expires_at',i.expires_at)
      order by i.created_at desc) from sfa_private.team_invites i where i.space_id=p_space and i.accepted_at is null
      and i.revoked_at is null and i.expires_at>now()),'[]'::jsonb));
end $$;

create function public.sfa_prepare_team_invite(p_space uuid,p_email text,p_role text,p_residents uuid[],p_configure boolean,p_share boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mail text:=lower(trim(p_email)); invitation uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_space::text,8));
  if not sfa_private.is_admin(p_space) then raise exception 'Administrator required' using errcode='42501'; end if;
  if mail is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode='22023'; end if;
  perform sfa_private.validate_team_access(p_space,p_role,p_residents,p_configure,p_share);
  if exists(select 1 from sfa_private.team_invites where space_id=p_space and email=mail and created_at>now()-interval '1 minute')
    or (select count(*) from public.sfa_audit where space_id=p_space and action='team_invited' and created_at>now()-interval '1 hour')>=20 then
    raise exception 'Invitation rate limit' using errcode='22023'; end if;
  if p_role<>'admin' and cardinality(p_residents)=0 then raise exception 'Assign a resident' using errcode='22023'; end if;
  if exists(select 1 from public.sfa_memberships m join auth.users u on u.id=m.user_id
    where m.space_id=p_space and lower(u.email)=mail and m.revoked_at is null) then
    raise exception 'Member already active' using errcode='22023'; end if;
  if (select count(*) from sfa_private.team_invites where space_id=p_space and accepted_at is null
    and revoked_at is null and expires_at>now())>=30 then raise exception 'Invitation limit' using errcode='22023'; end if;
  insert into sfa_private.team_invites(space_id,email,role,resident_ids,can_configure,can_share_location,invited_by)
    values(p_space,mail,p_role,p_residents,p_configure,p_share,auth.uid())
    on conflict(space_id,email) do update set id=gen_random_uuid(),role=excluded.role,resident_ids=excluded.resident_ids,
      can_configure=excluded.can_configure,can_share_location=excluded.can_share_location,invited_by=excluded.invited_by,
      created_at=now(),expires_at=now()+interval '7 days',accepted_at=null,revoked_at=null
    returning id into invitation;
  insert into public.sfa_audit(space_id,actor_id,action,target_id) values(p_space,auth.uid(),'team_invited',invitation);
  return jsonb_build_object('id',invitation,'expires_at',now()+interval '7 days');
end $$;

create function public.sfa_accept_team_invites() returns jsonb
language plpgsql security definer set search_path='' as $$
declare mail text; item record; accepted integer:=0; existing text;
begin
  select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if mail is null then raise exception 'Verified email required' using errcode='42501'; end if;
  for item in select * from sfa_private.team_invites where email=mail and accepted_at is null
    and revoked_at is null and expires_at>now() order by space_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(item.space_id::text,8));
    select i.* into item from sfa_private.team_invites i where i.id=item.id and i.accepted_at is null
      and i.revoked_at is null and i.expires_at>now() for update;
    if not found then continue; end if;
    if not exists(select 1 from public.sfa_memberships where space_id=item.space_id and user_id=item.invited_by
      and role='admin' and revoked_at is null) then continue; end if;
    perform sfa_private.validate_team_access(item.space_id,item.role,item.resident_ids,item.can_configure,item.can_share_location);
    select role into existing from public.sfa_memberships where space_id=item.space_id and user_id=auth.uid() and revoked_at is null;
    if found then continue; end if;
    insert into public.sfa_memberships values(item.space_id,auth.uid(),item.role,null)
      on conflict(space_id,user_id) do update set role=excluded.role,revoked_at=null;
    update public.sfa_resident_access set revoked_at=now() where space_id=item.space_id and user_id=auth.uid();
    insert into public.sfa_resident_access(space_id,resident_id,user_id,can_configure,can_share_location)
      select item.space_id,r,auth.uid(),item.can_configure,item.can_share_location from unnest(item.resident_ids) r
      on conflict(resident_id,user_id) do update set can_configure=excluded.can_configure,
        can_share_location=excluded.can_share_location,revoked_at=null;
    update sfa_private.team_invites set accepted_at=now() where id=item.id;
    insert into public.sfa_audit(space_id,actor_id,action,target_id) values(item.space_id,auth.uid(),'team_joined',item.id);
    accepted:=accepted+1;
  end loop;
  return jsonb_build_object('accepted',accepted);
end $$;

create function public.sfa_set_team_access(p_space uuid,p_user uuid,p_residents uuid[],p_configure boolean,p_share boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member_role text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_space::text,8));
  if not sfa_private.is_admin(p_space) then raise exception 'Administrator required' using errcode='42501'; end if;
  select role into member_role from public.sfa_memberships where space_id=p_space and user_id=p_user and revoked_at is null;
  if not found or member_role='admin' then raise exception 'Active limited member required' using errcode='22023'; end if;
  perform sfa_private.validate_team_access(p_space,member_role,p_residents,p_configure,p_share);
  update public.sfa_resident_access set revoked_at=now() where space_id=p_space and user_id=p_user;
  insert into public.sfa_resident_access(space_id,resident_id,user_id,can_configure,can_share_location)
    select p_space,r,p_user,p_configure,p_share from unnest(p_residents) r
    on conflict(resident_id,user_id) do update set can_configure=excluded.can_configure,
      can_share_location=excluded.can_share_location,revoked_at=null;
  insert into public.sfa_audit(space_id,actor_id,action,target_id) values(p_space,auth.uid(),'team_access_updated',p_user);
  return jsonb_build_object('updated',true);
end $$;

create function public.sfa_revoke_team_member(p_space uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target_role text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_space::text,8));
  if not sfa_private.is_admin(p_space) then raise exception 'Administrator required' using errcode='42501'; end if;
  select role into target_role from public.sfa_memberships where space_id=p_space and user_id=p_user and revoked_at is null;
  if not found then raise exception 'Member unavailable' using errcode='22023'; end if;
  if target_role='admin' and (select count(*) from public.sfa_memberships where space_id=p_space and role='admin' and revoked_at is null)<=1 then
    raise exception 'Last administrator' using errcode='22023'; end if;
  update public.sfa_memberships set revoked_at=now() where space_id=p_space and user_id=p_user;
  update public.sfa_resident_access set revoked_at=now() where space_id=p_space and user_id=p_user;
  update sfa_private.team_invites set revoked_at=now() where space_id=p_space and invited_by=p_user and accepted_at is null;
  insert into public.sfa_audit(space_id,actor_id,action,target_id) values(p_space,auth.uid(),'team_revoked',p_user);
  return jsonb_build_object('revoked',true);
end $$;

create function public.sfa_cancel_team_invite(p_space uuid,p_invitation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_space::text,8));
  if not sfa_private.is_admin(p_space) then raise exception 'Administrator required' using errcode='42501'; end if;
  update sfa_private.team_invites set revoked_at=now() where id=p_invitation and space_id=p_space and accepted_at is null;
  insert into public.sfa_audit(space_id,actor_id,action,target_id) values(p_space,auth.uid(),'team_invite_cancelled',p_invitation);
  return jsonb_build_object('cancelled',true);
end $$;

create or replace function sfa_private.can_configure_phone(p_resident uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sfa_residents r where r.id=p_resident and r.archived_at is null
    and (sfa_private.is_admin(r.space_id) or exists(select 1 from public.sfa_resident_access a
      join public.sfa_memberships m using(space_id,user_id)
      where a.resident_id=r.id and a.user_id=auth.uid() and a.revoked_at is null and m.revoked_at is null
      and a.can_share_location)));
$$;
revoke all on function public.sfa_team(uuid),public.sfa_prepare_team_invite(uuid,text,text,uuid[],boolean,boolean),
  public.sfa_accept_team_invites(),public.sfa_set_team_access(uuid,uuid,uuid[],boolean,boolean),
  public.sfa_revoke_team_member(uuid,uuid),public.sfa_cancel_team_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sfa_team(uuid),public.sfa_prepare_team_invite(uuid,text,text,uuid[],boolean,boolean),
  public.sfa_accept_team_invites(),public.sfa_set_team_access(uuid,uuid,uuid[],boolean,boolean),
  public.sfa_revoke_team_member(uuid,uuid),public.sfa_cancel_team_invite(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
