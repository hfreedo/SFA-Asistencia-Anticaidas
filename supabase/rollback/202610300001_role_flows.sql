-- Manual rollback: disable new tests and use real-only maps without rewriting records.
-- Keep the private test table and all production records; do not restore a database backup.
begin;
revoke execute on function public.sfa_begin_admin_gps_test(uuid,boolean),public.sfa_admin_gps_test(uuid,jsonb,boolean) from authenticated;
create or replace function public.sfa_map_position(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare point jsonb;
begin
  if auth.uid() is null or not sfa_private.can_read_resident(p_resident) then
    raise exception 'Resident access required' using errcode='42501'; end if;
  select jsonb_build_object('latitude',latitude,'longitude',longitude,'accuracy_m',accuracy_m,
    'observed_at',observed_at,'simulated',false,'source','phone') into point from public.sfa_positions
    where resident_id=p_resident and not simulated order by observed_at desc limit 1;
  return jsonb_build_object('position',point);
end $$;
notify pgrst,'reload schema';
commit;
