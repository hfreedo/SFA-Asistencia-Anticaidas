-- Validate deployment without changing residents, positions or event attention.
begin;
do $$
begin
  if to_regprocedure('sfa_private.resident_zone_status(uuid)') is null then raise exception 'Missing situation function'; end if;
  if has_function_privilege('anon','sfa_private.resident_zone_status(uuid)','EXECUTE')
    or has_function_privilege('authenticated','sfa_private.resident_zone_status(uuid)','EXECUTE') then
    raise exception 'Private situation function directly exposed';
  end if;
  if has_function_privilege('anon','public.sfa_incidents(uuid)','EXECUTE') then raise exception 'Anonymous incidents access'; end if;
  if position('zone_status' in pg_get_functiondef('public.sfa_incidents(uuid)'::regprocedure))=0 then raise exception 'Situation missing from authorized response'; end if;
end $$;
select 'PASS: 009 active; situation independent of attention; existing access restrictions preserved' as validation;
rollback;
