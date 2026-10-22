-- Read the current zone situation independently of incident resolution.
-- No locations replayed, events created, or recipient permissions expanded.
begin;
create function sfa_private.resident_zone_status(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare zone public.sfa_geofences%rowtype; state sfa_private.geofence_state%rowtype; current_state text;
begin
  if not sfa_private.can_read_resident(p_resident) then raise exception 'Resident unavailable' using errcode='42501'; end if;
  select * into zone from public.sfa_geofences where resident_id=p_resident and not simulation;
  if not found then return jsonb_build_object('state','unconfigured','last_confirmed','unknown','observed_at',null); end if;
  select s.* into state from sfa_private.geofence_state s
    join public.sfa_devices d on d.id=s.device_id and d.revoked_at is null
    join sfa_private.phone_owners o on o.device_id=d.id
    join public.sfa_residents r on r.id=d.resident_id
    join public.sfa_memberships m on m.space_id=r.space_id and m.user_id=o.user_id and m.revoked_at is null
    where s.resident_id=p_resident and s.zone_revision=zone.updated_at
      and (m.role='admin' or exists(select 1 from public.sfa_resident_access a
        where a.resident_id=p_resident and a.user_id=o.user_id and a.revoked_at is null and a.can_share_location))
    order by (s.previous_at>=now()-interval '90 seconds' and s.stable='outside') desc,s.previous_at desc limit 1;
  if not found then return jsonb_build_object('state','unknown','last_confirmed','unknown','observed_at',null); end if;
  current_state:=case when state.previous_at<now()-interval '90 seconds' then 'stale'
    when state.quality in ('inside','outside','imprecise','uncertain') then state.quality else 'uncertain' end;
  return jsonb_build_object('state',current_state,'last_confirmed',state.stable,'observed_at',state.previous_at);
end $$;
revoke all on function sfa_private.resident_zone_status(uuid) from public,anon,authenticated;

create or replace function public.sfa_incidents(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not sfa_private.can_read_resident(p_resident) then raise exception 'Resident unavailable' using errcode='42501'; end if;
  return jsonb_build_object('viewer_id',auth.uid(),'can_attend',sfa_private.can_attend(p_resident),
    'zone_status',sfa_private.resident_zone_status(p_resident),'events',coalesce((
    with eligible as (
      select e.id,e.event_type,e.observed_at,e.simulated,e.detail,a.actor_id,a.outcome,a.updated_at
      from public.sfa_events e left join public.sfa_event_attention a on a.event_id=e.id
      where e.resident_id=p_resident and e.event_type in ('SOS','CAIDA_CONFIRMADA','GEOCERCA_SALIDA','PRUEBA_SOS','PRUEBA_NOTIFICACION')
    ), chosen as (
      select * from eligible where outcome is null or outcome='attending'
      union all select * from (select * from eligible where outcome in ('attended','false_alarm') order by observed_at desc,id limit 50) history
    ) select jsonb_agg(row_to_json(item) order by observed_at desc,id) from chosen item
  ),'[]'::jsonb));
end $$;
notify pgrst,'reload schema';
commit;
