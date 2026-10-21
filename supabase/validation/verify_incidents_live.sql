-- Read-only authorization checks. No fixtures, events, receivers or push jobs.
begin;
do $$
declare signature text;
begin
  foreach signature in array array[
    'public.sfa_phone_sos(uuid,uuid,timestamp with time zone,boolean)',
    'public.sfa_push_test_consent(uuid,boolean)',
    'public.sfa_incidents(uuid)',
    'public.sfa_attend_incident(uuid,timestamp with time zone,text)'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Missing command: %',signature; end if;
    if has_function_privilege('anon',signature,'EXECUTE') then raise exception 'Anonymous grant: %',signature; end if;
    if not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Missing authenticated grant: %',signature; end if;
  end loop;
  if not exists(select 1 from information_schema.columns where table_schema='sfa_private'
    and table_name='push_devices' and column_name='accept_tests' and is_nullable='NO') then
    raise exception 'Missing private consent';
  end if;
end $$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$
begin
  begin
    perform public.sfa_phone_sos(null,null,now(),true);
    raise exception 'Unauthenticated SOS accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sfa_push_test_consent(null,true);
    raise exception 'Unauthenticated consent accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sfa_incidents('00000000-0000-0000-0000-000000000000');
    raise exception 'Unauthenticated incident read accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sfa_attend_incident(null,null,'attending');
    raise exception 'Unauthenticated attention accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: 006 commands, private consent and unauthorized rejection; no alerts sent' as validation;
rollback;
