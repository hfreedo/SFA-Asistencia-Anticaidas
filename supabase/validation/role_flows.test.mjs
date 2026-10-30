import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = n => `30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`OK role flow: ${name}`); };
async function login(n, role='authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n ? id(n) : '']);
  await db.exec(`set role ${role}`);
}
async function rpc(name,args=[]) { return (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result; }
const denied = action => assert.rejects(action,e=>e.code==='42501');
const sample = (seconds=0) => ({latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(Date.now()+seconds*1000).toISOString()});
async function snapshot() {
  await db.exec('reset role');
  const result = {};
  for (const table of ['public.sfa_memberships','public.sfa_resident_access','public.sfa_positions','public.sfa_events','public.sfa_devices','public.sfa_geofences','public.sfa_audit','sfa_private.push_jobs','sfa_private.geofence_state']) {
    result[table]=(await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) digest from ${table} t`)).rows[0].digest;
  }
  return result;
}
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  const candidate='202610300001_role_flows.sql';
  for (const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')&&n!==candidate).sort()) {
    await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  }
  for(let n=1;n<=6;n++) await db.query('insert into auth.users values($1,$2,now())',[id(n),`fixture${n}@example.invalid`]);
  await db.query("insert into public.sfa_spaces(id,name) values($1,'A'),($2,'B')",[id(10),id(20)]);
  await db.query("insert into public.sfa_residents(id,space_id,full_name) values($1,$2,'Person A'),($3,$4,'Person B')",[id(11),id(10),id(21),id(20)]);
  for(const [user,space,role] of [[1,10,'admin'],[2,10,'caregiver'],[3,10,'resident'],[5,20,'admin'],[6,10,'admin']]) await db.query('insert into public.sfa_memberships values($1,$2,$3,null)',[id(space),id(user),role]);
  for(const user of [2,3]) await db.query('insert into public.sfa_resident_access(space_id,resident_id,user_id,can_configure,can_share_location) values($1,$2,$3,false,true)',[id(10),id(11),id(user)]);
  await login(1); const oldPhone=(await rpc('sfa_register_phone',[id(11)])).device_id;
  await rpc('sfa_ingest_phone',[oldPhone,id(80),sample(-20)]);
  await rpc('sfa_phone_sos',[oldPhone,id(81),new Date().toISOString(),false]);
  const before=await snapshot();
  await db.exec(await readFile(new URL(`../migrations/${candidate}`,import.meta.url),'utf8'));
  await check('migration preserves existing roles, grants, devices, positions and incidents exactly',async()=>assert.deepEqual(await snapshot(),before));
  await check('existing administrator permissions and old device references remain unchanged',async()=>{
    await login(1);
    assert.equal((await rpc('sfa_register_phone',[id(11)])).device_id,oldPhone);
    await rpc('sfa_phone_context',[oldPhone]);
    assert.deepEqual(await snapshot(),before);
  });
  await check('resident and specifically authorized caregiver still emit real GPS',async()=>{
    for(const user of [2,3]) {
      await login(user); const phone=(await rpc('sfa_register_phone',[id(11)])).device_id;
      await rpc('sfa_ingest_phone',[phone,id(90+user),sample()]);
    }
    await login(2); assert.equal((await db.query('select count(*)::int n from public.sfa_positions')).rows[0].n,3);
  });
  await check('anonymous, unassigned, caregiver, resident and other-space admin cannot start admin GPS tests',async()=>{
    await login(null,'anon'); await denied(()=>rpc('sfa_begin_admin_gps_test',[id(11),true]));
    for(const user of [2,3,4,5]) { await login(user); await denied(()=>rpc('sfa_begin_admin_gps_test',[id(11),true])); }
  });
  await check('a test cannot start without explicit confirmation',async()=>{
    await login(1);
    for(const consent of [null,false]) await assert.rejects(()=>rpc('sfa_begin_admin_gps_test',[id(11),consent]),e=>e.code==='22023');
  });
  await login(1); let session=(await rpc('sfa_begin_admin_gps_test',[id(11),true])).session_id;
  const production=await snapshot();
  await check('normal map displays a labelled test without overwriting real GPS or creating incidents',async()=>{
    await login(1); const fix={...sample(),latitude:1,longitude:2};
    const result=await rpc('sfa_admin_gps_test',[session,fix,false]);
    assert.equal(result.simulated,true); assert.equal(result.active,true);
    assert.equal(result.last_sample.latitude,1);
    await rpc('sfa_admin_gps_test',[session,fix,false]);
    await login(2); const point=(await rpc('sfa_map_position',[id(11)])).position;
    assert.equal(point.latitude,1); assert.equal(point.simulated,true); assert.equal(point.source,'admin_test');
    await login(3); assert.equal((await rpc('sfa_map_position',[id(11)])).position.simulated,true);
    assert.deepEqual(await snapshot(),production);
  });
  await check('test map point remains invisible to unauthorized accounts',async()=>{
    await login(null,'anon'); await denied(()=>rpc('sfa_map_position',[id(11)]));
    for(const user of [4,5]) { await login(user); await denied(()=>rpc('sfa_map_position',[id(11)])); }
  });
  await check('another administrator can view the point but cannot manage the test session',async()=>{
    await login(6);
    await denied(()=>rpc('sfa_admin_gps_test',[session,null,false]));
    await denied(()=>rpc('sfa_admin_gps_test',[session,null,true]));
    await denied(()=>db.exec('select * from sfa_private.admin_gps_tests'));
    assert.equal((await rpc('sfa_map_position',[id(11)])).position.simulated,true);
  });
  await check('sample cannot disguise itself as production, contain extra fields or be invalid',async()=>{
    await login(1);
    for(const value of [{...sample(),simulated:false},{...sample(),latitude:91},sample(-200),{...sample(),accuracy_m:0}]) await assert.rejects(()=>rpc('sfa_admin_gps_test',[session,value,false]));
    assert.deepEqual(await snapshot(),production);
  });
  await check('newer real GPS takes precedence without deleting test or older history',async()=>{
    await db.exec('reset role');
    const saved=await db.query('select observed_at from public.sfa_positions where device_id=$1',[oldPhone]);
    await db.query("update public.sfa_positions set observed_at=now()+interval '20 seconds' where device_id=$1",[oldPhone]);
    await login(2); assert.equal((await rpc('sfa_map_position',[id(11)])).position.simulated,false);
    await db.exec('reset role');
    await db.query('update public.sfa_positions set observed_at=$1 where device_id=$2',[saved.rows[0].observed_at,oldPhone]);
    assert.deepEqual(await snapshot(),production);
  });
  await check('stop clears test coordinates and blocks subsequent writes',async()=>{
    await login(1); assert.equal((await rpc('sfa_admin_gps_test',[session,null,true])).active,false);
    await denied(()=>rpc('sfa_admin_gps_test',[session,sample(),false]));
    await db.exec('reset role'); assert.equal((await db.query('select last_sample from sfa_private.admin_gps_tests where id=$1',[session])).rows[0].last_sample,null);
    await login(2); assert.equal((await rpc('sfa_map_position',[id(11)])).position.simulated,false);
  });
  await check('new test invalidates the previous session without affecting another admin',async()=>{
    await login(6); const other=(await rpc('sfa_begin_admin_gps_test',[id(11),true])).session_id;
    await login(1); session=(await rpc('sfa_begin_admin_gps_test',[id(11),true])).session_id;
    const next=(await rpc('sfa_begin_admin_gps_test',[id(11),true])).session_id;
    await denied(()=>rpc('sfa_admin_gps_test',[session,null,false])); session=next;
    await login(6); assert.equal((await rpc('sfa_admin_gps_test',[other,null,false])).active,true);
  });
  await check('expiry and role revocation stop access; the owner can still discard test data',async()=>{
    await db.exec('reset role'); await db.query("update sfa_private.admin_gps_tests set expires_at=now()-interval '1 second' where id=$1",[session]);
    await login(1); await denied(()=>rpc('sfa_admin_gps_test',[session,null,false]));
    session=(await rpc('sfa_begin_admin_gps_test',[id(11),true])).session_id;
    await db.exec('reset role'); await db.query('update public.sfa_memberships set revoked_at=now() where user_id=$1',[id(1)]);
    await login(1); await denied(()=>rpc('sfa_admin_gps_test',[session,null,false]));
    assert.equal((await rpc('sfa_admin_gps_test',[session,null,true])).active,false);
  });
  await check('manual rollback changes permissions only, preserving later records',async()=>{
    const saved=await snapshot();
    await db.exec(await readFile(new URL('../rollback/202610300001_role_flows.sql',import.meta.url),'utf8'));
    assert.deepEqual(await snapshot(),saved);
    await login(6); await rpc('sfa_register_phone',[id(11)]);
    await denied(()=>rpc('sfa_begin_admin_gps_test',[id(11),true]));
    assert.equal((await rpc('sfa_map_position',[id(11)])).position.simulated,false);
  });
  console.log(`${checks} role-flow checks passed (isolated database; no physical GPS or FCM delivery proof).`);
} finally { await db.close(); }
