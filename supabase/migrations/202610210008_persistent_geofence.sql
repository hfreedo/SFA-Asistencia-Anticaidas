-- Evaluate new phone GPS samples and retain incidents until explicit attention.
begin;
create table sfa_private.geofence_state (
  device_id uuid primary key references public.sfa_devices(id),
  resident_id uuid not null references public.sfa_residents(id),
  zone_revision timestamptz not null,
  stable text not null default 'unknown',
  candidate text,
  candidate_since timestamptz,
  samples integer not null default 0,
  previous_at timestamptz,
  quality text not null default 'unknown'
);
alter table sfa_private.geofence_state enable row level security;
revoke all on sfa_private.geofence_state from public,anon,authenticated;
grant all on sfa_private.geofence_state to service_role;

create function sfa_private.evaluate_phone_zone() returns trigger
language plpgsql security definer set search_path='' as $$
declare zone public.sfa_geofences%rowtype; state sfa_private.geofence_state%rowtype;
  distance double precision; hav double precision; margin double precision; target text; incident uuid;
begin
  if new.simulated or new.observed_at<now()-interval '90 seconds' or new.observed_at>now()+interval '30 seconds' then return new; end if;
  if not exists(select 1 from public.sfa_devices d join sfa_private.phone_owners o on o.device_id=d.id
    where d.id=new.device_id and d.kind='phone' and d.revoked_at is null and o.user_id=auth.uid())
    or not sfa_private.can_configure_phone(new.resident_id) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.resident_id::text,13));
  select * into zone from public.sfa_geofences where resident_id=new.resident_id and not simulation;
  if not found then return new; end if;
  select * into state from sfa_private.geofence_state where device_id=new.device_id for update;
  if not found or state.zone_revision<>zone.updated_at then
    state.device_id:=new.device_id; state.resident_id:=new.resident_id; state.zone_revision:=zone.updated_at;
    state.stable:='unknown'; state.candidate:=null; state.candidate_since:=null; state.samples:=0; state.previous_at:=null;
  end if;
  if state.previous_at is not null and new.observed_at<=state.previous_at then return new; end if;
  -- Mean-earth great-circle distance. Accuracy and hysteresis dominate the metre-scale boundary.
  hav:=power(sin(radians(new.latitude-zone.latitude)/2),2)
    +cos(radians(zone.latitude))*cos(radians(new.latitude))*power(sin(radians(new.longitude-zone.longitude)/2),2);
  distance:=6371008.8*2*asin(sqrt(least(1.0,greatest(0.0,hav))));
  margin:=least(10.0,zone.radius_m*.1);
  target:=case when new.accuracy_m>50 then null
    when distance-new.accuracy_m>zone.radius_m+margin then 'outside'
    when distance+new.accuracy_m<zone.radius_m-margin then 'inside' else null end;
  if target is null then
    state.candidate:=null; state.samples:=0;
    state.quality:=case when new.accuracy_m>50 then 'imprecise' else 'uncertain' end;
  else
    if state.candidate is distinct from target or state.previous_at is null or new.observed_at-state.previous_at>interval '90 seconds' then
      state.candidate:=target; state.candidate_since:=new.observed_at; state.samples:=0;
    end if;
    state.samples:=state.samples+1; state.quality:='pending';
    if state.samples>=2 and new.observed_at-state.candidate_since>=interval '10 seconds' then
      state.quality:=target;
      if target<>state.stable then
        if target='outside' then
          select e.id into incident from public.sfa_events e left join public.sfa_event_attention a on a.event_id=e.id
            where e.resident_id=new.resident_id and e.event_type='GEOCERCA_SALIDA' and not e.simulated
              and (a.outcome is null or a.outcome='attending') limit 1;
          if incident is null then
            insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated,detail)
              values(gen_random_uuid(),new.resident_id,new.device_id,'GEOCERCA_SALIDA',new.observed_at,false,
                jsonb_build_object('source','phone_gps_server','text','Salida confirmada de la zona de referencia; requiere atención',
                  'zone_revision',zone.updated_at,'zone_name',zone.label,'radius_m',zone.radius_m,'accuracy_m',new.accuracy_m));
          end if;
        elsif state.stable='outside' then
          insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated,detail)
            values(gen_random_uuid(),new.resident_id,new.device_id,'GEOCERCA_REINGRESO',new.observed_at,false,
              jsonb_build_object('source','phone_gps_server','text','Reingreso confirmado; los incidentes pendientes no se cierran automáticamente'));
        end if;
        state.stable:=target;
      end if;
    end if;
  end if;
  state.previous_at:=new.observed_at;
  insert into sfa_private.geofence_state values(state.*)
    on conflict(device_id) do update set zone_revision=excluded.zone_revision,stable=excluded.stable,candidate=excluded.candidate,
      candidate_since=excluded.candidate_since,samples=excluded.samples,previous_at=excluded.previous_at,quality=excluded.quality;
  return new;
end $$;
revoke all on function sfa_private.evaluate_phone_zone() from public,anon,authenticated;
create trigger sfa_evaluate_phone_zone after insert on public.sfa_positions for each row execute function sfa_private.evaluate_phone_zone();

create or replace function public.sfa_incidents(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not sfa_private.can_read_resident(p_resident) then raise exception 'Resident unavailable' using errcode='42501'; end if;
  return jsonb_build_object('viewer_id',auth.uid(),'can_attend',sfa_private.can_attend(p_resident),'events',coalesce((
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
