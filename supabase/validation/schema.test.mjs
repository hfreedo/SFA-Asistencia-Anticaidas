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
  console.log(`${checks} database checks passed (isolated PGlite; not hosted Supabase).`);
} finally {
  await db.close();
}
