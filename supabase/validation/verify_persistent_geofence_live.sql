-- Read-only validation: no positions, residents or alerts are created.
begin;
do $$
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='sfa_private' and c.relname='geofence_state' and c.relrowsecurity) then
    raise exception 'Private geofence state or RLS missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='sfa_evaluate_phone_zone' and tgenabled='O') then
    raise exception 'Geofence trigger missing';
  end if;
  if has_table_privilege('authenticated','sfa_private.geofence_state','SELECT')
    or has_table_privilege('anon','sfa_private.geofence_state','SELECT') then
    raise exception 'Unexpected private state grant';
  end if;
  if has_function_privilege('anon','public.sfa_incidents(uuid)','EXECUTE') then
    raise exception 'Anonymous incident access';
  end if;
end $$;
select 'PASS: 008 active, private state protected, no positions replayed' as validation;
rollback;
