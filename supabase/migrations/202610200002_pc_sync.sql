begin;

create table sfa_private.pc_links (
  installation_id uuid not null,
  local_resident_id bigint not null check (local_resident_id > 0),
  resident_id uuid not null references public.sfa_residents(id),
  device_id uuid not null unique references public.sfa_devices(id),
  primary key (installation_id, local_resident_id)
);
alter table sfa_private.pc_links enable row level security;
revoke all on sfa_private.pc_links from public, anon, authenticated;
grant all on sfa_private.pc_links to service_role;

create table public.sfa_pc_samples (
  id uuid primary key,
  resident_id uuid not null references public.sfa_residents(id),
  device_id uuid not null,
  kind text not null check (kind in ('event', 'telemetry')),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  foreign key (resident_id, device_id) references public.sfa_devices(resident_id, id)
);
create index on public.sfa_pc_samples(resident_id, observed_at desc);
alter table public.sfa_pc_samples enable row level security;
revoke all on public.sfa_pc_samples from public, anon, authenticated;
grant select on public.sfa_pc_samples to authenticated;
grant all on public.sfa_pc_samples to service_role;
create policy pc_samples_read on public.sfa_pc_samples for select to authenticated
  using (sfa_private.can_read_resident(resident_id));

create function public.sfa_link_pc(p_installation uuid, p_local_resident bigint,
  p_space uuid, p_name text, p_room text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid; d uuid; existing_space uuid;
begin
  if auth.uid() is null or not sfa_private.is_admin(p_space) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if p_installation is null or p_local_resident is null or p_local_resident <= 0
    or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_room is null or length(p_room)>160 then
    raise exception 'Invalid profile' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_installation::text || ':' || p_local_resident::text, 0));
  select l.resident_id,l.device_id,s.space_id into r,d,existing_space
    from sfa_private.pc_links l join public.sfa_residents s on s.id=l.resident_id
    where l.installation_id=p_installation and l.local_resident_id=p_local_resident;
  if r is not null then
    if existing_space<>p_space or not exists(select 1 from public.sfa_devices where id=d and revoked_at is null) then
      raise exception 'Link unavailable' using errcode='42501';
    end if;
  else
    insert into public.sfa_residents(space_id,full_name,room)
      values(p_space,trim(p_name),p_room) returning id into r;
    insert into public.sfa_devices(resident_id,kind,label)
      values(r,'pc_bridge','PC SFA') returning id into d;
    insert into sfa_private.pc_links values(p_installation,p_local_resident,r,d);
    insert into public.sfa_audit(space_id,actor_id,action,target_id)
      values(p_space,auth.uid(),'pc_link_created',d);
  end if;
  return jsonb_build_object('resident_id',r,'device_id',d,'space_id',p_space);
end $$;

create function public.sfa_ingest_pc(p_device uuid,p_batch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid; s uuid; item jsonb; item_id uuid; observed timestamptz;
  kind text; body jsonb; old public.sfa_pc_samples%rowtype; accepted jsonb := '[]'::jsonb;
begin
  select d.resident_id,x.space_id into r,s from public.sfa_devices d
    join public.sfa_residents x on x.id=d.resident_id
    where d.id=p_device and d.kind='pc_bridge' and d.revoked_at is null and x.archived_at is null;
  if r is null or auth.uid() is null or not sfa_private.is_admin(s) then
    raise exception 'Authorized bridge required' using errcode='42501';
  end if;
  if p_batch is null or jsonb_typeof(p_batch)<>'array' or jsonb_array_length(p_batch) not between 1 and 50
    or pg_catalog.octet_length(p_batch::text)>131072 then
    raise exception 'Invalid batch' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_batch) loop
    item_id := (item->>'id')::uuid;
    observed := (item->>'observed_at')::timestamptz;
    kind := item->>'kind'; body := item->'payload';
    if item_id is null or observed is null or observed>now()+interval '5 minutes'
      or kind is null or kind not in ('event','telemetry')
      or body is null or jsonb_typeof(body)<>'object' or pg_catalog.octet_length(body::text)>4096 then
      raise exception 'Invalid sample' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_object_keys(body) k where k not in
      ('state','accel_g','tilt_deg','motion','fall_count','event_type','detail','simulated')) then
      raise exception 'Unexpected field' using errcode='22023';
    end if;
    if kind='event' and (body->>'event_type' is null or body->>'event_type' !~ '^[A-Z0-9_]{1,80}$'
      or length(coalesce(body->>'detail',''))>1000) then
      raise exception 'Invalid event' using errcode='22023';
    end if;
    if body ? 'simulated' and jsonb_typeof(body->'simulated')<>'boolean' then
      raise exception 'Invalid simulation flag' using errcode='22023';
    end if;
    if kind='telemetry' and (
      coalesce(body->>'state','') not in ('NORMAL','EVENTO_INERCIAL','POSIBLE_CAIDA','CAIDA_CONFIRMADA','ALERTA_SILENCIADA')
      or (body->>'accel_g')::double precision not between 0 and 100
      or (body->>'tilt_deg')::double precision not between 0 and 180
      or (body->>'motion')::double precision not between 0 and 1000
      or (body->>'fall_count')::bigint < 0) then
      raise exception 'Invalid telemetry' using errcode='22023';
    end if;
    -- One transaction and lock per ID makes uncertain-delivery retries idempotent.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(item_id::text, 1));
    select * into old from public.sfa_pc_samples where id=item_id;
    if found then
      if old.device_id<>p_device or old.kind<>kind or old.observed_at<>observed or old.payload<>body then
        raise exception 'Sample identifier collision' using errcode='23505';
      end if;
    else
      insert into public.sfa_pc_samples values(item_id,r,p_device,kind,observed,now(),body);
      if kind='event' then
        insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated,detail)
          values(item_id,r,p_device,body->>'event_type',observed,coalesce((body->>'simulated')::boolean,false),
          jsonb_build_object('text',coalesce(body->>'detail',''),'source','pc'));
      end if;
    end if;
    accepted := accepted || jsonb_build_array(item_id);
  end loop;
  update public.sfa_devices set last_seen_at=now() where id=p_device;
  return jsonb_build_object('accepted',accepted);
end $$;

revoke all on function public.sfa_link_pc(uuid,bigint,uuid,text,text) from public,anon,authenticated;
revoke all on function public.sfa_ingest_pc(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sfa_link_pc(uuid,bigint,uuid,text,text) to authenticated;
grant execute on function public.sfa_ingest_pc(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
