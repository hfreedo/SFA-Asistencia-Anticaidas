-- Read-only metadata check. No test notification or token access.
begin;
do $$
begin
  if to_regprocedure('public.sfa_push_test_targets(uuid)') is null then raise exception 'Missing receiver query'; end if;
  if has_function_privilege('anon','public.sfa_push_test_targets(uuid)','EXECUTE') then raise exception 'Anonymous receiver listing'; end if;
  if not has_function_privilege('authenticated','public.sfa_push_test_targets(uuid)','EXECUTE') then raise exception 'Missing authenticated query'; end if;
  if has_table_privilege('authenticated','sfa_private.push_devices','SELECT') then raise exception 'FCM table exposed'; end if;
end $$;
select 'PASS: 010 active; receiver metadata owner-only; tokens private; no notification sent' as validation;
rollback;
