begin;
alter table sfa_private.push_devices add column accept_tests boolean not null default false;

create function public.sfa_push_test_consent(p_installation uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_enabled is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update sfa_private.push_devices set accept_tests=p_enabled where installation_id=p_installation and user_id=auth.uid() and enabled;
  if not found then raise exception 'Register receiver first' using errcode='42501'; end if;
  return jsonb_build_object('accept_tests',p_enabled);
end $$;

create function public.sfa_phone_sos(p_device uuid,p_event uuid,p_observed timestamptz,p_simulated boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resident uuid; existing public.sfa_events%rowtype; kind text;
begin
  select d.resident_id into resident from public.sfa_devices d join sfa_private.phone_owners o on o.device_id=d.id
    where d.id=p_device and d.kind='phone' and d.revoked_at is null and o.user_id=auth.uid();
  if resident is null or not sfa_private.can_configure_phone(resident) then raise exception 'Phone unavailable' using errcode='42501'; end if;
  if p_event is null or p_observed is null or p_simulated is null then raise exception 'Invalid SOS' using errcode='22023'; end if;
  kind:=case when p_simulated then 'PRUEBA_SOS' else 'SOS' end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event::text,10));
  select * into existing from public.sfa_events where id=p_event;
  if found then
    if existing.device_id<>p_device or existing.resident_id<>resident or existing.observed_at<>p_observed
      or existing.event_type<>kind or existing.simulated<>p_simulated then raise exception 'Identifier collision' using errcode='23505'; end if;
    return jsonb_build_object('accepted',p_event);
  end if;
  if p_observed<now()-interval '5 minutes' or p_observed>now()+interval '30 seconds' then raise exception 'Stale SOS' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_device::text,11));
  if exists(select 1 from public.sfa_events where device_id=p_device and event_type=kind and received_at>now()-interval '30 seconds') then
    raise exception 'SOS rate limit' using errcode='22023'; end if;
  insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated,detail)
    values(p_event,resident,p_device,kind,p_observed,p_simulated,jsonb_build_object('source','phone','text',
      case when p_simulated then 'Prueba SOS; no es una emergencia' else 'Solicitud de ayuda desde el celular' end));
  insert into public.sfa_audit(space_id,actor_id,action,target_id)
    select space_id,auth.uid(),'phone_sos',p_event from public.sfa_residents where id=resident;
  return jsonb_build_object('accepted',p_event);
end $$;

create or replace function sfa_private.enqueue_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.simulated and new.event_type<>'PRUEBA_SOS')
    or (not new.simulated and new.event_type not in ('CAIDA_CONFIRMADA','SOS','GEOCERCA_SALIDA'))
    or new.observed_at<now()-interval '5 minutes' or new.observed_at>now()+interval '30 seconds' then return new; end if;
  insert into sfa_private.push_jobs(event_id,installation_id)
    select new.id,d.installation_id from sfa_private.push_devices d
    join public.sfa_residents r on r.id=new.resident_id and r.archived_at is null
    join public.sfa_memberships m on m.user_id=d.user_id and m.space_id=r.space_id
      and m.revoked_at is null and m.role in ('admin','caregiver')
    where d.enabled and (not new.simulated or d.accept_tests)
      and (m.role='admin' or exists(select 1 from public.sfa_resident_access a where a.resident_id=r.id and a.user_id=d.user_id and a.revoked_at is null))
    on conflict(event_id,installation_id) do nothing;
  return new;
end $$;

create or replace function sfa_private.claim_push(p_tests boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  with candidates as (
    select j.id from sfa_private.push_jobs j join public.sfa_events e on e.id=j.event_id
    join public.sfa_residents r on r.id=e.resident_id and r.archived_at is null
    join sfa_private.push_devices d on d.installation_id=j.installation_id and d.enabled
    join public.sfa_memberships m on m.user_id=d.user_id and m.space_id=r.space_id and m.revoked_at is null and m.role in ('admin','caregiver')
    where j.state='pending' and j.attempts<5 and j.available_at<=now()
      and (p_tests or not e.simulated)
      and (not e.simulated or e.event_type='PRUEBA_NOTIFICACION' or d.accept_tests)
      and e.observed_at>=now()-interval '5 minutes' and e.observed_at<=now()+interval '30 seconds'
      and sfa_private.is_admin(r.space_id)
      and (m.role='admin' or exists(select 1 from public.sfa_resident_access a where a.resident_id=r.id and a.user_id=d.user_id and a.revoked_at is null))
    order by j.available_at limit 3 for update of j skip locked
  ), claimed as (
    update sfa_private.push_jobs j set attempts=j.attempts+1,available_at=now()+interval '2 minutes',
      lease=gen_random_uuid(),worker=auth.uid(),claimed_token=d.token
    from candidates c,sfa_private.push_devices d where j.id=c.id and d.installation_id=j.installation_id returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_id',c.event_id,'lease',c.lease,'token',c.claimed_token,
    'observed_at',e.observed_at,'is_test',e.simulated)),'[]'::jsonb) into result from claimed c join public.sfa_events e on e.id=c.event_id;
  return result;
end $$;

create function sfa_private.can_attend(p_resident uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sfa_residents r join public.sfa_memberships m on m.space_id=r.space_id
    where r.id=p_resident and r.archived_at is null and m.user_id=auth.uid() and m.revoked_at is null
      and (m.role='admin' or (m.role='caregiver' and exists(select 1 from public.sfa_resident_access a
        where a.resident_id=r.id and a.user_id=auth.uid() and a.revoked_at is null))));
$$;
revoke all on function sfa_private.can_attend(uuid) from public,anon,authenticated;

create function public.sfa_incidents(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not sfa_private.can_read_resident(p_resident) then raise exception 'Resident unavailable' using errcode='42501'; end if;
  return jsonb_build_object('can_attend',sfa_private.can_attend(p_resident),'events',coalesce((select jsonb_agg(row_to_json(item)) from (
    select e.id,e.event_type,e.observed_at,e.simulated,e.detail,a.actor_id,a.outcome,a.updated_at
    from public.sfa_events e left join public.sfa_event_attention a on a.event_id=e.id
    where e.resident_id=p_resident and e.event_type in ('SOS','CAIDA_CONFIRMADA','GEOCERCA_SALIDA','PRUEBA_SOS','PRUEBA_NOTIFICACION')
    order by e.observed_at desc,e.id limit 50
  ) item),'[]'::jsonb));
end $$;

create function public.sfa_attend_incident(p_event uuid,p_expected timestamptz,p_outcome text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resident uuid; current_attention public.sfa_event_attention%rowtype;
begin
  select resident_id into resident from public.sfa_events where id=p_event
    and event_type in ('SOS','CAIDA_CONFIRMADA','GEOCERCA_SALIDA','PRUEBA_SOS','PRUEBA_NOTIFICACION');
  if resident is null or not sfa_private.can_attend(resident) then raise exception 'Caregiver required' using errcode='42501'; end if;
  if p_outcome is null or p_outcome not in ('attending','attended','false_alarm') then raise exception 'Invalid outcome' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event::text,12));
  select * into current_attention from public.sfa_event_attention where event_id=p_event for update;
  if found then
    if p_expected is distinct from current_attention.updated_at then raise exception 'Attention changed' using errcode='40001'; end if;
    if current_attention.actor_id<>auth.uid() then raise exception 'Another caregiver owns attention' using errcode='42501'; end if;
    if current_attention.outcome=p_outcome then return jsonb_build_object('updated',true); end if;
    if current_attention.outcome<>'attending' or p_outcome='attending' then raise exception 'Incident already resolved' using errcode='22023'; end if;
    update public.sfa_event_attention set outcome=p_outcome,updated_at=clock_timestamp() where event_id=p_event;
  else
    if p_expected is not null or p_outcome<>'attending' then raise exception 'Take attention first' using errcode='40001'; end if;
    insert into public.sfa_event_attention values(p_event,auth.uid(),'attending',clock_timestamp());
  end if;
  insert into public.sfa_audit(space_id,actor_id,action,target_id) select space_id,auth.uid(),'incident_'||p_outcome,p_event from public.sfa_residents where id=resident;
  return jsonb_build_object('updated',true);
end $$;
revoke all on function public.sfa_push_test_consent(uuid,boolean),public.sfa_phone_sos(uuid,uuid,timestamptz,boolean),
  public.sfa_incidents(uuid),public.sfa_attend_incident(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.sfa_push_test_consent(uuid,boolean),public.sfa_phone_sos(uuid,uuid,timestamptz,boolean),
  public.sfa_incidents(uuid),public.sfa_attend_incident(uuid,timestamptz,text) to authenticated;
notify pgrst,'reload schema';
commit;
