-- Prepared offline. Apply only after approval; no public access to FCM tokens.
begin;
create table sfa_private.push_devices (
  installation_id uuid primary key,
  user_id uuid not null references auth.users(id),
  token text not null unique check (length(token) between 20 and 4096),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table sfa_private.push_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sfa_events(id),
  installation_id uuid not null references sfa_private.push_devices(installation_id),
  state text not null default 'pending' check (state in ('pending','sent','expired','invalid')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease uuid,
  worker uuid,
  claimed_token text,
  unique(event_id,installation_id)
);
alter table sfa_private.push_devices enable row level security;
alter table sfa_private.push_jobs enable row level security;
revoke all on sfa_private.push_devices,sfa_private.push_jobs from public,anon,authenticated;
grant all on sfa_private.push_devices,sfa_private.push_jobs to service_role;

create function public.sfa_register_push(p_installation uuid,p_token text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.sfa_memberships
    where user_id=auth.uid() and revoked_at is null and role in ('admin','caregiver')) then
    raise exception 'Caregiver required' using errcode='42501';
  end if;
  if p_installation is null or p_enabled is null then
    raise exception 'Invalid registration' using errcode='22023';
  end if;
  if not p_enabled then
    update sfa_private.push_devices set enabled=false,updated_at=now()
      where installation_id=p_installation and user_id=auth.uid();
    return jsonb_build_object('enabled',false);
  end if;
  if p_token is null or length(p_token) not between 20 and 4096 or p_token !~ '^[A-Za-z0-9_:.%~-]+$' then
    raise exception 'Invalid token' using errcode='22023';
  end if;
  -- Serialize rotations; never let another account claim an existing installation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_installation::text,3));
  if exists(select 1 from sfa_private.push_devices where installation_id=p_installation and user_id<>auth.uid()) then
    raise exception 'Installation belongs to another account' using errcode='42501';
  end if;
  if (select count(*) from sfa_private.push_devices where user_id=auth.uid() and enabled and installation_id<>p_installation)>=5 then
    raise exception 'Device limit reached' using errcode='22023';
  end if;
  insert into sfa_private.push_devices values(p_installation,auth.uid(),p_token,true,now())
    on conflict(installation_id) do update set token=excluded.token,enabled=true,updated_at=now();
  return jsonb_build_object('enabled',true);
end $$;

create function sfa_private.enqueue_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.simulated or new.event_type not in ('CAIDA_CONFIRMADA','SOS','GEOCERCA_SALIDA')
    or new.observed_at<now()-interval '5 minutes' or new.observed_at>now()+interval '30 seconds' then return new; end if;
  insert into sfa_private.push_jobs(event_id,installation_id)
    select new.id,d.installation_id from sfa_private.push_devices d
    join public.sfa_residents r on r.id=new.resident_id and r.archived_at is null
    join public.sfa_memberships m on m.user_id=d.user_id and m.space_id=r.space_id
      and m.revoked_at is null and m.role in ('admin','caregiver')
    where d.enabled and (m.role='admin' or exists(select 1 from public.sfa_resident_access a
      where a.resident_id=r.id and a.user_id=d.user_id and a.revoked_at is null))
    on conflict(event_id,installation_id) do nothing;
  return new;
end $$;
create trigger sfa_enqueue_push after insert on public.sfa_events
  for each row execute function sfa_private.enqueue_push();

create function public.sfa_claim_push() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  with candidates as (
    select j.id from sfa_private.push_jobs j
    join public.sfa_events e on e.id=j.event_id
    join public.sfa_residents r on r.id=e.resident_id and r.archived_at is null
    join sfa_private.push_devices d on d.installation_id=j.installation_id and d.enabled
    join public.sfa_memberships m on m.user_id=d.user_id and m.space_id=r.space_id
      and m.revoked_at is null and m.role in ('admin','caregiver')
    where j.state='pending' and j.attempts<5 and j.available_at<=now()
      and e.observed_at>=now()-interval '5 minutes' and e.observed_at<=now()+interval '30 seconds'
      and sfa_private.is_admin(r.space_id)
      and (m.role='admin' or exists(select 1 from public.sfa_resident_access a
        where a.resident_id=r.id and a.user_id=d.user_id and a.revoked_at is null))
    order by j.available_at limit 3 for update of j skip locked
  ), claimed as (
    update sfa_private.push_jobs j set attempts=j.attempts+1,available_at=now()+interval '2 minutes',
      lease=gen_random_uuid(),worker=auth.uid(),claimed_token=d.token
    from candidates c,sfa_private.push_devices d where j.id=c.id and d.installation_id=j.installation_id
    returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_id',c.event_id,'lease',c.lease,
    'token',c.claimed_token,'observed_at',e.observed_at)),'[]'::jsonb) into result
    from claimed c join public.sfa_events e on e.id=c.event_id;
  return result;
end $$;

create function public.sfa_ack_push(p_id uuid,p_lease uuid,p_outcome text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job sfa_private.push_jobs%rowtype;
begin
  if auth.uid() is null or p_outcome is null or p_outcome not in ('sent','retry','invalid','expired') then
    raise exception 'Invalid acknowledgement' using errcode='42501'; end if;
  select j.* into job from sfa_private.push_jobs j join public.sfa_events e on e.id=j.event_id
    join public.sfa_residents r on r.id=e.resident_id where j.id=p_id and j.lease=p_lease
    and j.worker=auth.uid() and sfa_private.is_admin(r.space_id) for update of j;
  if not found then raise exception 'Lease unavailable' using errcode='42501'; end if;
  update sfa_private.push_jobs set state=case when p_outcome='retry' then 'pending' else p_outcome end,
    available_at=now()+interval '30 seconds',lease=null,worker=null,claimed_token=null where id=p_id;
  if p_outcome='invalid' then update sfa_private.push_devices set enabled=false
    where installation_id=job.installation_id and token=job.claimed_token; end if;
  return jsonb_build_object('acknowledged',true);
end $$;
revoke all on function sfa_private.enqueue_push() from public,anon,authenticated;
revoke all on function public.sfa_register_push(uuid,text,boolean),public.sfa_claim_push(),public.sfa_ack_push(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sfa_register_push(uuid,text,boolean),public.sfa_claim_push(),public.sfa_ack_push(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
