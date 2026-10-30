-- Explicit administrator tests shown in normal maps, without rewriting real GPS.
begin;

create table sfa_private.admin_gps_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  resident_id uuid not null references public.sfa_residents(id),
  expires_at timestamptz not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_sample jsonb
);
alter table sfa_private.admin_gps_tests enable row level security;
revoke all on sfa_private.admin_gps_tests from public,anon,authenticated;
grant all on sfa_private.admin_gps_tests to service_role;

create function public.sfa_begin_admin_gps_test(p_resident uuid,p_confirm boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare session_id uuid; expiry timestamptz;
begin
  if p_confirm is distinct from true then raise exception 'Explicit test confirmation required' using errcode='22023'; end if;
  if auth.uid() is null or not exists(select 1 from public.sfa_residents r
    where r.id=p_resident and r.archived_at is null and sfa_private.is_admin(r.space_id)) then
    raise exception 'Administrator required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,15));
  insert into sfa_private.admin_gps_tests(user_id,resident_id,expires_at)
    values(auth.uid(),p_resident,now()+interval '30 minutes')
    on conflict(user_id) do update set id=gen_random_uuid(),resident_id=excluded.resident_id,
      expires_at=excluded.expires_at,started_at=excluded.started_at,ended_at=null,last_sample=null
    returning id,expires_at into session_id,expiry;
  return jsonb_build_object('session_id',session_id,'resident_id',p_resident,'expires_at',expiry,'simulated',true);
end $$;

create function public.sfa_admin_gps_test(p_session uuid,p_sample jsonb,p_end boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item sfa_private.admin_gps_tests%rowtype; stamp timestamptz; previous timestamptz;
  lat double precision; lng double precision; accuracy double precision; clean jsonb;
begin
  if auth.uid() is null or p_session is null or p_end is null or (p_end and p_sample is not null) then
    raise exception 'Invalid test request' using errcode='22023'; end if;
  select * into item from sfa_private.admin_gps_tests where id=p_session and user_id=auth.uid() for update;
  if not found then raise exception 'Test unavailable' using errcode='42501'; end if;
  -- Owners may discard their own test even after losing the administrator role.
  if p_end then
    update sfa_private.admin_gps_tests set ended_at=coalesce(ended_at,now()),last_sample=null where id=item.id;
    return jsonb_build_object('active',false,'simulated',true,'last_sample',null);
  end if;
  if item.ended_at is not null or item.expires_at<=now() or not exists(select 1 from public.sfa_residents r
    where r.id=item.resident_id and r.archived_at is null and sfa_private.is_admin(r.space_id)) then
    raise exception 'Test expired or unauthorized' using errcode='42501'; end if;
  if p_sample is not null then
    if jsonb_typeof(p_sample)<>'object' or pg_catalog.octet_length(p_sample::text)>1024 then
      raise exception 'Invalid sample' using errcode='22023'; end if;
    if exists(select 1 from jsonb_object_keys(p_sample) k where k not in ('latitude','longitude','accuracy_m','observed_at')) then
      raise exception 'Unexpected sample field' using errcode='22023'; end if;
    stamp=(p_sample->>'observed_at')::timestamptz;
    lat=(p_sample->>'latitude')::double precision; lng=(p_sample->>'longitude')::double precision;
    accuracy=(p_sample->>'accuracy_m')::double precision;
    if stamp is null or stamp<now()-interval '90 seconds' or stamp>now()+interval '30 seconds'
      or lat is null or not(lat between -90 and 90) or lng is null or not(lng between -180 and 180)
      or accuracy is null or not(accuracy>0 and accuracy<=10000) then
      raise exception 'Invalid sample' using errcode='22023'; end if;
    clean=jsonb_build_object('latitude',lat,'longitude',lng,'accuracy_m',accuracy,'observed_at',stamp);
    previous=(item.last_sample->>'observed_at')::timestamptz;
    if previous=stamp and item.last_sample is distinct from clean then
      raise exception 'Sample conflict' using errcode='23505'; end if;
    if previous is not null and previous<>stamp and stamp<previous+interval '8 seconds' then
      raise exception 'Sample out of order or too frequent' using errcode='22023'; end if;
    update sfa_private.admin_gps_tests set last_sample=clean where id=item.id;
    item.last_sample=clean;
  end if;
  return jsonb_build_object('active',true,'simulated',true,'expires_at',item.expires_at,'last_sample',item.last_sample);
end $$;
create function public.sfa_map_position(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare real_point jsonb; test sfa_private.admin_gps_tests%rowtype;
begin
  if auth.uid() is null or not sfa_private.can_read_resident(p_resident) then
    raise exception 'Resident access required' using errcode='42501'; end if;
  select jsonb_build_object('latitude',p.latitude,'longitude',p.longitude,'accuracy_m',p.accuracy_m,
    'observed_at',p.observed_at,'simulated',false,'source','phone') into real_point
    from public.sfa_positions p where p.resident_id=p_resident and not p.simulated order by p.observed_at desc limit 1;
  select t.* into test from sfa_private.admin_gps_tests t join public.sfa_residents r on r.id=t.resident_id
    where t.resident_id=p_resident and t.ended_at is null and t.expires_at>now() and t.last_sample is not null
      and r.archived_at is null and exists(select 1 from public.sfa_memberships m
        where m.user_id=t.user_id and m.space_id=r.space_id and m.role='admin' and m.revoked_at is null)
    order by (t.last_sample->>'observed_at')::timestamptz desc,t.started_at desc,t.id limit 1;
  if test.last_sample is not null and (real_point is null or
    (test.last_sample->>'observed_at')::timestamptz>=(real_point->>'observed_at')::timestamptz) then
    return jsonb_build_object('position',test.last_sample || jsonb_build_object('simulated',true,'source','admin_test','test_until',test.expires_at));
  end if;
  return jsonb_build_object('position',real_point);
end $$;
revoke all on function public.sfa_begin_admin_gps_test(uuid,boolean),public.sfa_admin_gps_test(uuid,jsonb,boolean),public.sfa_map_position(uuid) from public,anon,authenticated;
grant execute on function public.sfa_begin_admin_gps_test(uuid,boolean),public.sfa_admin_gps_test(uuid,jsonb,boolean),public.sfa_map_position(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
