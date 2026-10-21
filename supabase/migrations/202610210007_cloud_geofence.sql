-- Configure the phone's remote zone; does not emit caregiver notifications.
begin;
create function sfa_private.can_configure_geofence(p_resident uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sfa_residents r join public.sfa_memberships m on m.space_id=r.space_id
    where r.id=p_resident and r.archived_at is null and m.user_id=auth.uid() and m.revoked_at is null
    and (m.role='admin' or (m.role='caregiver' and exists(select 1 from public.sfa_resident_access a
      where a.resident_id=r.id and a.user_id=auth.uid() and a.revoked_at is null and a.can_configure))));
$$;
revoke all on function sfa_private.can_configure_geofence(uuid) from public,anon,authenticated;

create function public.sfa_get_geofence(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare zone jsonb;
begin
  if not sfa_private.can_read_resident(p_resident) then raise exception 'Resident unavailable' using errcode='42501'; end if;
  select jsonb_build_object('home_lat',latitude,'home_lng',longitude,'radius_m',radius_m,
    'address_name',label,'updated_at',updated_at) into zone from public.sfa_geofences
    where resident_id=p_resident and not simulation;
  return jsonb_build_object('geofence',zone,'can_configure',sfa_private.can_configure_geofence(p_resident));
end $$;

create function public.sfa_save_geofence(p_resident uuid,p_lat double precision,p_lng double precision,
  p_radius integer,p_label text,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.sfa_geofences%rowtype;
begin
  if not sfa_private.can_configure_geofence(p_resident) then raise exception 'Configuration permission required' using errcode='42501'; end if;
  if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180)
    or p_radius is null or p_radius not between 5 and 100000 or p_label is null or length(trim(p_label)) not between 1 and 100 then
    raise exception 'Invalid zone' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_resident::text,13));
  select * into previous from public.sfa_geofences where resident_id=p_resident for update;
  if p_expected is distinct from previous.updated_at then raise exception 'Zone changed; reload first' using errcode='40001'; end if;
  insert into public.sfa_geofences(resident_id,latitude,longitude,radius_m,label,simulation,updated_at)
    values(p_resident,p_lat,p_lng,p_radius,trim(p_label),false,clock_timestamp())
    on conflict(resident_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,
      radius_m=excluded.radius_m,label=excluded.label,simulation=false,updated_at=excluded.updated_at;
  insert into public.sfa_audit(space_id,actor_id,action,target_id)
    select space_id,auth.uid(),'geofence_configured',p_resident from public.sfa_residents where id=p_resident;
  return public.sfa_get_geofence(p_resident);
end $$;

create or replace function public.sfa_phone_context(p_device uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resident uuid; zone jsonb;
begin
  select d.resident_id into resident from public.sfa_devices d join sfa_private.phone_owners o on o.device_id=d.id
    where d.id=p_device and d.kind='phone' and d.revoked_at is null and o.user_id=auth.uid();
  if resident is null or not sfa_private.can_configure_phone(resident) then raise exception 'Phone unavailable' using errcode='42501'; end if;
  select jsonb_build_object('home_lat',latitude,'home_lng',longitude,'radius_m',radius_m,
    'address_name',label,'updated_at',updated_at) into zone from public.sfa_geofences where resident_id=resident and not simulation;
  return jsonb_build_object('geofence',zone);
end $$;
revoke all on function public.sfa_get_geofence(uuid), public.sfa_save_geofence(uuid,double precision,double precision,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.sfa_get_geofence(uuid), public.sfa_save_geofence(uuid,double precision,double precision,integer,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
