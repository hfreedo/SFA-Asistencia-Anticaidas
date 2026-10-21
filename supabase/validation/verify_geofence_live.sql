-- No resident data changed; no location or alert emitted.
begin;
do $$
declare signature text;
begin
  foreach signature in array array['public.sfa_get_geofence(uuid)',
    'public.sfa_save_geofence(uuid,double precision,double precision,integer,text,timestamp with time zone)'] loop
    if to_regprocedure(signature) is null then raise exception 'Missing geofence command'; end if;
    if has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Anonymous grant'; end if;
    if not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Missing authenticated command'; end if;
  end loop;
end $$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$
begin
  begin
    perform public.sfa_get_geofence(null);
    raise exception 'Unauthenticated zone read accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sfa_save_geofence(null,0,0,5,'Fixture',null);
    raise exception 'Unauthenticated zone write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: 007 commands and unauthorized rejection; no zones changed' as validation;
rollback;
