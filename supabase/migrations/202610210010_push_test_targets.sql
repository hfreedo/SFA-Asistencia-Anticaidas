-- Only the signed-in account's own registered receivers; never expose FCM tokens.
begin;
create function public.sfa_push_test_targets(p_resident uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not sfa_private.can_read_resident(p_resident) or not exists(
    select 1 from public.sfa_residents r join public.sfa_memberships m on m.space_id=r.space_id
    where r.id=p_resident and m.user_id=auth.uid() and m.revoked_at is null and m.role in ('admin','caregiver')) then
    raise exception 'Caregiver and resident access required' using errcode='42501';
  end if;
  return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object(
    'installation_id',d.installation_id,'updated_at',d.updated_at,'last_test',(
      select jsonb_build_object('state',j.state,'observed_at',e.observed_at)
      from sfa_private.push_jobs j join public.sfa_events e on e.id=j.event_id
      where j.installation_id=d.installation_id and e.resident_id=p_resident and e.simulated and e.event_type='PRUEBA_NOTIFICACION'
      order by e.observed_at desc limit 1)) order by d.updated_at desc)
    from sfa_private.push_devices d where d.user_id=auth.uid() and d.enabled),'[]'::jsonb));
end $$;
revoke all on function public.sfa_push_test_targets(uuid) from public,anon;
grant execute on function public.sfa_push_test_targets(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
