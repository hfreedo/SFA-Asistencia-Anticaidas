import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL engine. Auth is a fixture, not a Supabase login test.
const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`OK ${name}`);
}
async function login(n, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [n ? id(n) : '']);
  await db.exec(`set role ${role}`);
}
async function count(table) {
  return (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
}
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(await readFile(new URL('../migrations/202610200001_base_sfa.sql', import.meta.url), 'utf8'));
  await db.exec(`
    insert into auth.users values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');
    insert into public.sfa_spaces (id,name) values ('${id(10)}','A'),('${id(20)}','B');
    insert into public.sfa_memberships values
      ('${id(10)}','${id(1)}','admin',null),
      ('${id(10)}','${id(2)}','caregiver',null),
      ('${id(20)}','${id(3)}','admin',null);
    insert into public.sfa_residents (id,space_id,full_name) values
      ('${id(11)}','${id(10)}','Fixture A'),
      ('${id(12)}','${id(10)}','Fixture A2'),
      ('${id(21)}','${id(20)}','Fixture B');
    insert into public.sfa_resident_access values
      ('${id(10)}','${id(11)}','${id(2)}',false,null);
    insert into public.sfa_devices (id,resident_id,kind,transport) values
      ('${id(30)}','${id(11)}','belt','usb_pc');
    insert into public.sfa_positions values
      ('${id(40)}','${id(11)}','${id(30)}',0,0,5,now(),now(),false);
    insert into public.sfa_events (id,resident_id,device_id,event_type,observed_at) values
      ('${id(50)}','${id(11)}','${id(30)}','SOS',now());
    insert into public.sfa_event_attention values ('${id(50)}','${id(1)}','attending',now());
    insert into public.sfa_geofences values ('${id(11)}',0,0,5,'Demo',true,now());
  `);
  await check('all application tables have RLS', async () => {
    const { rows } = await db.query(`select relname from pg_class c join pg_namespace n
      on n.oid=c.relnamespace where n.nspname in ('public','sfa_private')
      and c.relkind='r' and not c.relrowsecurity`);
    assert.equal(rows.length, 0);
  });
  await check('anonymous cannot read resident data', async () => {
    await login(null, 'anon');
    await assert.rejects(() => count('sfa_residents'), e => e.code === '42501');
  });
  await check('uninvited account sees no residents', async () => {
    await login(4);
    assert.equal(await count('sfa_residents'), 0);
    assert.equal(await count('sfa_spaces'), 0);
  });
  await check('administrator only sees own space', async () => {
    await login(1);
    assert.equal(await count('sfa_residents'), 2);
    assert.equal(await count('sfa_spaces'), 1);
  });
  await check('caregiver only sees assigned resident and history', async () => {
    await login(2);
    assert.equal(await count('sfa_residents'), 1);
    for (const table of ['sfa_positions','sfa_events','sfa_event_attention','sfa_devices','sfa_geofences']) {
      assert.equal(await count(table), 1, table);
    }
  });
  await check('other space sees no location or event history', async () => {
    await login(3);
    for (const table of ['sfa_positions','sfa_events','sfa_event_attention','sfa_devices','sfa_geofences']) {
      assert.equal(await count(table), 0, table);
    }
  });
  await check('clients cannot promote themselves or modify/delete history', async () => {
    await login(2);
    for (const sql of [
      "update public.sfa_memberships set role='admin'",
      "update public.sfa_residents set full_name='changed'",
      'delete from public.sfa_positions',
      `insert into public.sfa_spaces (name) values ('unapproved')`,
    ]) await assert.rejects(() => db.exec(sql), e => e.code === '42501');
  });
  await check('revoked link immediately removes access', async () => {
    await db.exec('reset role');
    await db.exec(`update public.sfa_resident_access set revoked_at=now()`);
    await login(2);
    assert.equal(await count('sfa_positions'), 0);
    assert.equal(await count('sfa_residents'), 0);
  });
  await check('revoked membership also removes assigned access', async () => {
    await db.exec('reset role');
    await db.exec(`update public.sfa_resident_access set revoked_at=null;
      update public.sfa_memberships set revoked_at=now() where user_id='${id(2)}'`);
    await login(2);
    assert.equal(await count('sfa_positions'), 0);
  });
  await check('backend role can ingest; event IDs prevent duplicates', async () => {
    await login(null, 'service_role');
    await assert.rejects(() => db.exec(`insert into public.sfa_events
      (id,resident_id,device_id,event_type,observed_at) values
      ('${id(50)}','${id(11)}','${id(30)}','SOS',now())`), e => e.code === '23505');
  });
  await check('device cannot be attributed to another resident', async () => {
    await assert.rejects(() => db.exec(`insert into public.sfa_positions values
      ('${id(41)}','${id(21)}','${id(30)}',0,0,5,now(),now(),false)`), e => e.code === '23503');
  });
  await check('invalid coordinates rejected and old history retained', async () => {
    await assert.rejects(() => db.exec(`insert into public.sfa_positions values
      ('${id(41)}','${id(11)}','${id(30)}',91,0,5,now(),now(),false)`), e => e.code === '23514');
    await db.exec(`insert into public.sfa_positions values
      ('${id(41)}','${id(11)}','${id(30)}',0,0,5,'2020-01-01',now(),false)`);
    assert.equal(await count('sfa_positions'), 2);
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../migrations/202610200002_pc_sync.sql', import.meta.url), 'utf8'));
  let linked;
  await check('admin links PC idempotently, preserving local identity mapping', async () => {
    await login(1);
    const args = [id(70),1,id(10),'PC fixture','Room'];
    const call = () => db.query('select public.sfa_link_pc($1,$2,$3,$4,$5) as link', args);
    linked = (await call()).rows[0].link;
    assert.deepEqual((await call()).rows[0].link, linked);
  });
  await check('PC registration requires the administrator of that space', async () => {
    await login(3);
    await assert.rejects(() => db.query('select public.sfa_link_pc($1,1,$2,$3,$4)',
      [id(71),id(10),'Denied','Room']), e => e.code === '42501');
  });
  const sample = {id:id(80),kind:'event',observed_at:'2026-01-01T00:00:00Z',payload:{event_type:'SOS',detail:'Fixture',simulated:true}};
  const ingest = batch => db.query('select public.sfa_ingest_pc($1,$2) as ack', [linked.device_id,JSON.stringify(batch)]);
  await check('PC event retry creates one record with stable acknowledgement', async () => {
    await login(1);
    const a = (await ingest([sample])).rows[0].ack;
    assert.deepEqual((await ingest([sample])).rows[0].ack,a);
    assert.deepEqual(a.accepted,[id(80)]);
    assert.equal(await count('sfa_pc_samples'),1);
  });
  await check('reusing a sample identifier for different evidence is rejected', async () => {
    await assert.rejects(() => ingest([{...sample,payload:{...sample.payload,detail:'Changed'}}]), e => e.code === '23505');
  });
  await check('PC ingestion rejects unexpected personal information', async () => {
    await assert.rejects(() => ingest([{...sample,id:id(81),payload:{...sample.payload,medical_notes:'not allowed'}}]), e => e.code === '22023');
  });
  await check('other families cannot read or ingest PC samples', async () => {
    await login(3);
    assert.equal(await count('sfa_pc_samples'),0);
    await assert.rejects(() => ingest([sample]), e => e.code === '42501');
  });
  await check('anonymous callers cannot execute bridge commands', async () => {
    await login(null,'anon');
    await assert.rejects(() => ingest([sample]), e => e.code === '42501');
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../migrations/202610210003_push.sql', import.meta.url), 'utf8'));
  await db.exec(`update public.sfa_memberships set revoked_at=null where user_id='${id(2)}';
    update public.sfa_resident_access set revoked_at=null where user_id='${id(2)}'`);
  const register = (installation, token, enabled=true) => db.query('select public.sfa_register_push($1,$2,$3)', [installation,token,enabled]);
  const claimPush = async () => (await db.query('select public.sfa_claim_push() as jobs')).rows[0].jobs;
  const ackPush = job => db.query("select public.sfa_ack_push($1,$2,'sent')",[job.id,job.lease]);
  await check('push registration requires authorized caregiver membership', async () => {
    await login(4);
    await assert.rejects(() => register(id(100),'fixture_token_abcdefghijklmnop_1'),e=>e.code==='42501');
    await login(1); await register(id(100),'fixture_token_abcdefghijklmnop_1');
    await login(2); await register(id(101),'fixture_token_abcdefghijklmnop_2');
  });
  await check('FCM tokens are private even to authenticated users', async () => {
    await assert.rejects(()=>db.query('select * from sfa_private.push_devices'),e=>e.code==='42501');
    await assert.rejects(()=>register(id(100),'fixture_token_abcdefghijklmnop_3'),e=>e.code==='42501');
  });
  await db.exec('reset role');
  await db.exec(`insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at)
    values('${id(90)}','${id(11)}','${id(30)}','CAIDA_CONFIRMADA',now())`);
  let pushJobs;
  await check('only admin of event space can claim push deliveries', async () => {
    await login(3); assert.equal((await claimPush()).length,0);
    await login(2); assert.equal((await claimPush()).length,0);
    await login(1); pushJobs=await claimPush(); assert.equal(pushJobs.length,2);
    assert.equal((await claimPush()).length,0);
  });
  await check('ack requires worker identity and unguessable lease', async () => {
    await login(2); await assert.rejects(()=>ackPush(pushJobs[0]),e=>e.code==='42501');
    await login(1); await assert.rejects(()=>ackPush({...pushJobs[0],lease:id(999)}),e=>e.code==='42501');
    for(const job of pushJobs) await ackPush(job);
    await assert.rejects(()=>ackPush(pushJobs[0]),e=>e.code==='42501');
  });
  await db.exec('reset role');
  await db.exec(`update public.sfa_resident_access set revoked_at=now() where user_id='${id(2)}';
    insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at)
    values('${id(91)}','${id(11)}','${id(30)}','SOS',now())`);
  await check('revoked caregivers receive no new jobs', async () => {
    await login(1); const jobs=await claimPush(); assert.equal(jobs.length,1);
    assert.equal(jobs[0].token,'fixture_token_abcdefghijklmnop_1'); await ackPush(jobs[0]);
  });
  await db.exec('reset role');
  await db.exec(`insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated)
    values('${id(92)}','${id(11)}','${id(30)}','SOS',now(),true),
    ('${id(93)}','${id(11)}','${id(30)}','SOS',now()-interval '1 hour',false)`);
  await check('simulated and stale events do not generate push', async () => {
    await login(1); assert.equal((await claimPush()).length,0);
    await register(id(100),null,false);
  });
  await db.exec('reset role');
  await db.exec(`insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at)
    values('${id(94)}','${id(11)}','${id(30)}','SOS',now())`);
  await check('disabled devices stop delivery and anonymous cannot register', async () => {
    await login(1); assert.equal((await claimPush()).length,0);
    await login(null,'anon'); await assert.rejects(()=>register(id(100),'fixture_token_abcdefghijklmnop_1'),e=>e.code==='42501');
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../migrations/202610210004_phone_location.sql', import.meta.url), 'utf8'));
  let phone;
  const registerPhone = resident => db.query('select public.sfa_register_phone($1) as result',[resident]);
  const sendPosition = (device, sampleId, values={}) => db.query('select public.sfa_ingest_phone($1,$2,$3) as result',
    [device,sampleId,JSON.stringify({latitude:-25,longitude:-57,accuracy_m:5,observed_at:new Date().toISOString(),...values})]);
  await check('GPS registration requires configuration permission, not just read access', async () => {
    await login(3); await assert.rejects(()=>registerPhone(id(11)),e=>e.code==='42501');
    await login(2); await assert.rejects(()=>registerPhone(id(11)),e=>e.code==='42501');
    await login(1); phone=(await registerPhone(id(11))).rows[0].result.device_id;
    assert.equal((await registerPhone(id(11))).rows[0].result.device_id,phone);
  });
  await check('GPS only needs phone, not belt; retries are idempotent', async () => {
    const first=(await sendPosition(phone,id(110))).rows[0].result;
    assert.equal(first.accepted,id(110));
    assert.deepEqual((await sendPosition(phone,id(110))).rows[0].result,first);
  });
  await check('GPS rejects another owner, anonymous clients and direct table writes', async () => {
    await login(3); await assert.rejects(()=>sendPosition(phone,id(111)),e=>e.code==='42501');
    await login(null,'anon'); await assert.rejects(()=>sendPosition(phone,id(111)),e=>e.code==='42501');
    await login(1); await assert.rejects(()=>db.exec('delete from public.sfa_positions'),e=>e.code==='42501');
  });
  await check('GPS rejects stale, invalid, out-of-order and excessive samples', async () => {
    for (const values of [{observed_at:'2020-01-01T00:00:00Z'},{latitude:91},{accuracy_m:0},{}])
      await assert.rejects(()=>sendPosition(phone,id(111),values),e=>e.code==='22023');
  });
  await check('GPS context does not enable a simulated geofence', async () => {
    const result=(await db.query('select public.sfa_phone_context($1) as value',[phone])).rows[0].value;
    assert.equal(result.geofence,null);
  });
  await check('test push is simulated, explicitly labelled and only addressed to requester', async () => {
    await register(id(100),'fixture_token_abcdefghijklmnop_1');
    const call=()=>db.query('select public.sfa_request_push_test($1,$2) as value',[id(11),id(100)]);
    assert.equal((await call()).rows[0].value.queued,true);
    await assert.rejects(call,e=>e.code==='22023');
    assert.equal((await claimPush()).length,0,'Old senders must not claim test notifications');
    const jobs=(await db.query('select public.sfa_claim_push_v2() as jobs')).rows[0].jobs;
    assert.equal(jobs.length,1); assert.equal(jobs[0].is_test,true);
    assert.equal(jobs[0].token,'fixture_token_abcdefghijklmnop_1'); await ackPush(jobs[0]);
  });
  await check('test push cannot target another account or resident from another space', async () => {
    await login(3);
    await assert.rejects(()=>db.query('select public.sfa_request_push_test($1,$2)',[id(11),id(100)]),e=>e.code==='42501');
  });
  await check('revoked GPS devices cannot submit or fetch context', async () => {
    await db.exec('reset role'); await db.query('update public.sfa_devices set revoked_at=now() where id=$1',[phone]);
    await login(1);
    await assert.rejects(()=>sendPosition(phone,id(112)),e=>e.code==='42501');
    await assert.rejects(()=>db.query('select public.sfa_phone_context($1)',[phone]),e=>e.code==='42501');
  });
  console.log(`${checks} database checks passed (isolated PGlite; not hosted Supabase).`);
} finally {
  await db.close();
}
