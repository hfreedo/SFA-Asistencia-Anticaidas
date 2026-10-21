-- Authenticated GPS-only sharing. No anonymous ingestion or FCM token exposure.
begin;
create table sfa_private.phone_owners (
  device_id uuid primary key references public.sfa_devices(id),
  user_id uuid not null references auth.users(id)
);
alter table sfa_private.phone_owners enable row level security;
revoke all on sfa_private.phone_owners from public,anon,authenticated;
grant all on sfa_private.phone_owners to service_role;

create function sfa_private.can_configure_phone(p_resident uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sfa_residents r where r.id=p_resident and r.archived_at is null
    and (sfa_private.is_admin(r.space_id) or exists(select 1 from public.sfa_resident_access a
      join public.sfa_memberships m using(space_id,user_id)
      where a.resident_id=r.id and a.user_id=auth.uid() and a.revoked_at is null
      and a.can_configure and m.revoked_at is null)));
$$;
revoke all on function sfa_private.can_configure_phone(uuid) from public,anon,authenticated;

create function public.sfa_register_phone(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare phone uuid;
begin
  if auth.uid() is null or not sfa_private.can_configure_phone(p_resident) then
    raise exception 'Configuration permission required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_resident::text,4));
  select d.id into phone from public.sfa_devices d join sfa_private.phone_owners o on o.device_id=d.id
    where d.resident_id=p_resident and d.kind='phone' and d.revoked_at is null and o.user_id=auth.uid();
  if phone is null then
    insert into public.sfa_devices(resident_id,kind,label) values(p_resident,'phone','GPS Android') returning id into phone;
    insert into sfa_private.phone_owners values(phone,auth.uid());
  end if;
  return jsonb_build_object('device_id',phone,'resident_id',p_resident);
end $$;

create function public.sfa_phone_context(p_device uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resident uuid; zone jsonb;
begin
  select d.resident_id into resident from public.sfa_devices d join sfa_private.phone_owners o on o.device_id=d.id
    where d.id=p_device and d.kind='phone' and d.revoked_at is null and o.user_id=auth.uid();
  if resident is null or not sfa_private.can_configure_phone(resident) then
    raise exception 'Phone unavailable' using errcode='42501'; end if;
  select jsonb_build_object('home_lat',latitude,'home_lng',longitude,'radius_m',radius_m) into zone
    from public.sfa_geofences where resident_id=resident and not simulation;
  return jsonb_build_object('geofence',zone);
end $$;

create function public.sfa_ingest_phone(p_device uuid,p_id uuid,p_sample jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resident uuid; stamp timestamptz; lat double precision; lng double precision; accuracy double precision;
begin
  select d.resident_id into resident from public.sfa_devices d join sfa_private.phone_owners o on o.device_id=d.id
    where d.id=p_device and d.kind='phone' and d.revoked_at is null and o.user_id=auth.uid() for update of d;
  if resident is null or not sfa_private.can_configure_phone(resident) then
    raise exception 'Phone unavailable' using errcode='42501'; end if;
  if p_id is null or p_sample is null or jsonb_typeof(p_sample)<>'object' then
    raise exception 'Invalid sample' using errcode='22023'; end if;
  if exists(select 1 from public.sfa_positions where id=p_id and device_id<>p_device) then
    raise exception 'Sample conflict' using errcode='22023'; end if;
  if exists(select 1 from public.sfa_positions where id=p_id and device_id=p_device) then
    return jsonb_build_object('accepted',p_id); end if;
  stamp=(p_sample->>'observed_at')::timestamptz;
  lat=(p_sample->>'latitude')::double precision; lng=(p_sample->>'longitude')::double precision;
  accuracy=(p_sample->>'accuracy_m')::double precision;
  if stamp is null or stamp<now()-interval '90 seconds' or stamp>now()+interval '30 seconds'
    or lat is null or not(lat between -90 and 90) or lng is null or not(lng between -180 and 180)
    or accuracy is null or not(accuracy>0 and accuracy<=10000) then
    raise exception 'Invalid or stale sample' using errcode='22023'; end if;
  if exists(select 1 from public.sfa_positions where device_id=p_device and observed_at>stamp-interval '8 seconds') then
    raise exception 'Sample too frequent or out of order' using errcode='22023'; end if;
  insert into public.sfa_positions(id,resident_id,device_id,latitude,longitude,accuracy_m,observed_at)
    values(p_id,resident,p_device,lat,lng,accuracy,stamp);
  update public.sfa_devices set last_seen_at=now() where id=p_device;
  return jsonb_build_object('accepted',p_id);
end $$;

create function public.sfa_request_push_test(p_resident uuid,p_installation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare phone uuid; event uuid=gen_random_uuid();
begin
  if auth.uid() is null or not sfa_private.can_read_resident(p_resident) or not exists(
    select 1 from sfa_private.push_devices where installation_id=p_installation and user_id=auth.uid() and enabled) then
    raise exception 'Registered phone and resident access required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,5));
  if exists(select 1 from public.sfa_audit where actor_id=auth.uid() and action='push_test'
    and created_at>now()-interval '1 minute') then
    raise exception 'Wait one minute between tests' using errcode='22023'; end if;
  insert into public.sfa_devices(resident_id,kind,label) values(p_resident,'phone','Prueba de avisos') returning id into phone;
  insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated,detail)
    values(event,p_resident,phone,'PRUEBA_NOTIFICACION',now(),true,'{"text":"Prueba solicitada; no es una emergencia"}');
  insert into sfa_private.push_jobs(event_id,installation_id) values(event,p_installation);
  insert into public.sfa_audit(space_id,actor_id,action,target_id)
    select space_id,auth.uid(),'push_test',event from public.sfa_residents where id=p_resident;
  return jsonb_build_object('queued',true,'event_id',event);
end $$;

-- Older PC senders must never pick a test and present it as a real emergency.
create function sfa_private.claim_push(p_tests boolean) returns jsonb
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
      and (p_tests or e.event_type<>'PRUEBA_NOTIFICACION')
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
    'token',c.claimed_token,'observed_at',e.observed_at,
    'is_test',e.simulated and e.event_type='PRUEBA_NOTIFICACION')),'[]'::jsonb) into result
    from claimed c join public.sfa_events e on e.id=c.event_id;
  return result;
end $$;
revoke all on function sfa_private.claim_push(boolean) from public,anon,authenticated;
create or replace function public.sfa_claim_push() returns jsonb
language sql security definer set search_path='' as $$
  select sfa_private.claim_push(false);
$$;
create function public.sfa_claim_push_v2() returns jsonb
language sql security definer set search_path='' as $$
  select sfa_private.claim_push(true);
$$;
revoke all on function public.sfa_register_phone(uuid),public.sfa_phone_context(uuid),
  public.sfa_ingest_phone(uuid,uuid,jsonb),public.sfa_request_push_test(uuid,uuid),public.sfa_claim_push(),public.sfa_claim_push_v2() from public,anon,authenticated;
grant execute on function public.sfa_register_phone(uuid),public.sfa_phone_context(uuid),
  public.sfa_ingest_phone(uuid,uuid,jsonb),public.sfa_request_push_test(uuid,uuid),public.sfa_claim_push(),public.sfa_claim_push_v2() to authenticated;
notify pgrst,'reload schema';
commit;
