import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`OK team: ${name}`); }
async function login(n, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']);
  await db.exec(`set role ${role}`);
}
async function rpc(name, args = []) {
  return (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args)).rows[0].result;
}
const invite = (user, role = 'caregiver', residents = [id(11)], configure = false, share = false) =>
  rpc('sfa_prepare_team_invite', [id(10), `user${user}@example.invalid`, role, residents, configure, share]);
const denied = action => assert.rejects(action, e => e.code === '42501');
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const name of ['202610200001_base_sfa.sql', '202610200002_pc_sync.sql', '202610210003_push.sql', '202610210004_phone_location.sql', '202610210005_team.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  for (let n = 1; n <= 12; n++) await db.query('insert into auth.users values($1,$2,$3)', [id(n), `user${n}@example.invalid`, n === 5 ? null : new Date().toISOString()]);
  await db.query('insert into public.sfa_spaces(id,name) values($1,$2),($3,$4)', [id(10), 'Fixture A', id(20), 'Fixture B']);
  await db.query("insert into public.sfa_memberships values($1,$2,'admin',null),($3,$4,'admin',null)", [id(10), id(1), id(20), id(3)]);
  await db.query('insert into public.sfa_residents(id,space_id,full_name) values($1,$2,$3),($4,$2,$5),($6,$7,$8)', [id(11),id(10),'Person A',id(12),'Person A2',id(21),id(20),'Person B']);

  await check('anonymous and unassigned accounts cannot enumerate or administer team', async () => {
    await login(null,'anon'); await denied(() => rpc('sfa_team',[id(10)]));
    await login(6); await denied(() => rpc('sfa_team',[id(10)])); await denied(() => invite(2));
    await login(3); await denied(() => rpc('sfa_team',[id(10)]));
  });
  await check('invitation grants nothing before verified account accepts', async () => {
    await login(1); await invite(2);
    await login(2);
    assert.equal((await db.query('select * from public.sfa_residents')).rows.length,0);
    assert.equal((await rpc('sfa_accept_team_invites')).accepted,1);
    assert.equal((await rpc('sfa_accept_team_invites')).accepted,0);
    assert.deepEqual((await db.query('select id from public.sfa_residents')).rows.map(r=>r.id),[id(11)]);
    await denied(() => rpc('sfa_team',[id(10)])); await denied(() => rpc('sfa_register_phone',[id(11)]));
  });
  await check('email in JWT metadata cannot claim another invitation', async () => {
    await login(1); await invite(5);
    await login(5); await denied(() => rpc('sfa_accept_team_invites'));
    await login(6); await db.query("select set_config('request.jwt.claim.email','user5@example.invalid',false)");
    assert.equal((await rpc('sfa_accept_team_invites')).accepted,0);
  });
  await check('limited person can share only assigned GPS, not administer or link PC', async () => {
    await login(1); await invite(4,'resident',[id(11)],false,true);
    await login(4); assert.equal((await rpc('sfa_accept_team_invites')).accepted,1);
    const phone=await rpc('sfa_register_phone',[id(11)]);
    assert.ok(phone.device_id); await rpc('sfa_phone_context',[phone.device_id]);
    await denied(() => rpc('sfa_register_phone',[id(12)]));
    await denied(() => rpc('sfa_set_team_access',[id(10),id(4),[id(12)],false,true]));
    await denied(() => rpc('sfa_link_pc',[id(10),1,id(80),'Fixture','']));
    await login(1); await rpc('sfa_revoke_team_member',[id(10),id(4)]);
    await login(4); await denied(() => rpc('sfa_phone_context',[phone.device_id]));
    assert.equal((await db.query('select * from public.sfa_residents')).rows.length,0);
  });
  await check('administrator assigns and removes access without changing role or deleting history', async () => {
    await login(1); await rpc('sfa_set_team_access',[id(10),id(2),[id(11)],true,false]);
    await login(2); await denied(() => rpc('sfa_register_phone',[id(11)]));
    await login(1); await rpc('sfa_set_team_access',[id(10),id(2),[id(12)],false,true]);
    await login(2);
    assert.deepEqual((await db.query('select id from public.sfa_residents')).rows.map(r=>r.id),[id(12)]);
    await rpc('sfa_register_phone',[id(12)]); await denied(() => rpc('sfa_register_phone',[id(11)]));
    await denied(() => rpc('sfa_revoke_team_member',[id(10),id(1)]));
    await login(1); await rpc('sfa_set_team_access',[id(10),id(2),[],false,false]);
    await login(2); assert.equal((await db.query('select * from public.sfa_residents')).rows.length,0);
  });
  await check('outside-space, duplicate, null and elevated-person grants are rejected atomically', async () => {
    await login(1);
    await denied(() => invite(6,'caregiver',[id(21)]));
    await denied(() => invite(6,'caregiver',[id(11),id(11)]));
    await assert.rejects(() => invite(6,'resident',[id(11)],true,true),e=>e.code==='22023');
    await assert.rejects(() => invite(6,'admin',[id(11)]),e=>e.code==='22023');
    await assert.rejects(() => invite(6,'caregiver',[id(11)],null,false),e=>e.code==='22023');
    assert.equal((await rpc('sfa_team',[id(10)])).invitations.some(i=>i.email==='user6@example.invalid'),false);
  });
  await check('cancelled and expired invitations cannot enroll', async () => {
    await login(1); const invitation=await invite(6);
    await rpc('sfa_cancel_team_invite',[id(10),invitation.id]);
    await login(6); assert.equal((await rpc('sfa_accept_team_invites')).accepted,0);
    await login(1); await invite(9);
    await db.exec('reset role'); await db.query('update sfa_private.team_invites set expires_at=now()-interval \'1 second\' where email=$1',['user9@example.invalid']);
    await login(9); assert.equal((await rpc('sfa_accept_team_invites')).accepted,0);
  });
  await check('last administrator cannot be revoked, even by own authenticated command', async () => {
    await login(1); await assert.rejects(()=>rpc('sfa_revoke_team_member',[id(10),id(1)]),e=>e.code==='22023');
    await invite(8,'admin',[]);
    await login(8); assert.equal((await rpc('sfa_accept_team_invites')).accepted,1);
    await rpc('sfa_team',[id(10)]); await denied(()=>rpc('sfa_team',[id(20)]));
    await login(1); await rpc('sfa_revoke_team_member',[id(10),id(8)]);
    await login(8); await denied(()=>rpc('sfa_team',[id(10)]));
  });
  await check('revoked inviter cannot leave pending grants that activate later', async () => {
    await login(1); await invite(7,'admin',[]);
    await login(7); await rpc('sfa_accept_team_invites'); await invite(10);
    await login(1); await rpc('sfa_revoke_team_member',[id(10),id(7)]);
    await login(10); assert.equal((await rpc('sfa_accept_team_invites')).accepted,0);
  });
  await check('team and invitation tables remain inaccessible for direct client mutation', async () => {
    await login(1);
    await denied(()=>db.exec("update public.sfa_memberships set role='admin'"));
    await denied(()=>db.exec('select * from sfa_private.team_invites'));
    const result=await rpc('sfa_team',[id(10)]);
    assert.ok(result.members.some(m=>m.email==='user1@example.invalid'));
    assert.ok(!JSON.stringify(result).includes('token'));
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../migrations/202610210006_incidents.sql',import.meta.url),'utf8'));
  await login(1); await rpc('sfa_set_team_access',[id(10),id(2),[id(11)],false,false]);
  await invite(11,'resident',[id(11)],false,true);
  await login(11); await rpc('sfa_accept_team_invites');
  const sosPhone=(await rpc('sfa_register_phone',[id(11)])).device_id;
  const sosStamp=new Date().toISOString();
  await check('limited emitter cannot register as caregiver receiver or attend incidents',async()=>{
    await denied(()=>rpc('sfa_register_push',[id(101),'fixture_token_for_limited_person',true]));
    await denied(()=>rpc('sfa_attend_incident',[id(200),null,'attending']));
  });
  await login(1); await rpc('sfa_register_push',[id(101),'fixture_token_for_administrator',true]);
  await login(2); await rpc('sfa_register_push',[id(102),'fixture_token_for_caregiver',true]);
  await check('test consent belongs only to the registered installation owner',async()=>{
    await denied(()=>rpc('sfa_push_test_consent',[id(101),true]));
    assert.equal((await rpc('sfa_push_test_consent',[id(102),true])).accept_tests,true);
  });
  await check('SOS test is idempotent, visible on web and only targets opted-in caregivers',async()=>{
    await login(11);
    for(let n=0;n<2;n++) assert.equal((await rpc('sfa_phone_sos',[sosPhone,id(200),sosStamp,true])).accepted,id(200));
    const view=await rpc('sfa_incidents',[id(11)]);
    assert.equal(view.can_attend,false); assert.equal(view.events.length,1); assert.equal(view.events[0].simulated,true);
    await login(1); assert.equal((await rpc('sfa_claim_push')).length,0);
    const jobs=await rpc('sfa_claim_push_v2'); assert.equal(jobs.length,1);
    assert.equal(jobs[0].token,'fixture_token_for_caregiver'); assert.equal(jobs[0].is_test,true);
    await rpc('sfa_ack_push',[jobs[0].id,jobs[0].lease,'sent']);
  });
  await check('real SOS targets authorized receivers without reusing test identity',async()=>{
    await login(11); await rpc('sfa_phone_sos',[sosPhone,id(201),sosStamp,false]);
    await assert.rejects(()=>rpc('sfa_phone_sos',[sosPhone,id(200),sosStamp,false]),e=>e.code==='23505');
    await login(1); const jobs=await rpc('sfa_claim_push_v2'); assert.equal(jobs.length,2);
    assert.ok(jobs.every(job=>job.is_test===false));
    for(const job of jobs) await rpc('sfa_ack_push',[job.id,job.lease,'sent']);
  });
  await check('SOS rejects anonymous, another owner, stale timestamps and flooding',async()=>{
    await login(null,'anon'); await denied(()=>rpc('sfa_phone_sos',[sosPhone,id(202),sosStamp,false]));
    await login(2); await denied(()=>rpc('sfa_phone_sos',[sosPhone,id(202),sosStamp,false]));
    await login(11);
    await assert.rejects(()=>rpc('sfa_phone_sos',[sosPhone,id(202),new Date(Date.now()-301000).toISOString(),false]),e=>e.code==='22023');
    await assert.rejects(()=>rpc('sfa_phone_sos',[sosPhone,id(202),sosStamp,false]),e=>e.code==='22023');
  });
  await check('attention ownership, optimistic revision and terminal outcomes are enforced',async()=>{
    await login(2); await rpc('sfa_attend_incident',[id(201),null,'attending']);
    let event=(await rpc('sfa_incidents',[id(11)])).events.find(e=>e.id===id(201));
    assert.equal(event.actor_id,id(2)); assert.equal(event.outcome,'attending');
    await login(1);
    await assert.rejects(()=>rpc('sfa_attend_incident',[id(201),null,'attending']),e=>e.code==='40001');
    await denied(()=>rpc('sfa_attend_incident',[id(201),event.updated_at,'attended']));
    await login(2); await rpc('sfa_attend_incident',[id(201),event.updated_at,'attended']);
    event=(await rpc('sfa_incidents',[id(11)])).events.find(e=>e.id===id(201));
    assert.equal(event.outcome,'attended');
    await assert.rejects(()=>rpc('sfa_attend_incident',[id(201),event.updated_at,'false_alarm']),e=>e.code==='22023');
    await login(3); await denied(()=>rpc('sfa_incidents',[id(11)]));
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../migrations/202610210007_cloud_geofence.sql',import.meta.url),'utf8'));
  let zoneRevision;
  await check('cloud zone requires explicit configuration permission, not GPS sharing',async()=>{
    await login(null,'anon'); await denied(()=>rpc('sfa_get_geofence',[id(11)]));
    await login(3); await denied(()=>rpc('sfa_get_geofence',[id(11)]));
    await login(11); assert.equal((await rpc('sfa_get_geofence',[id(11)])).can_configure,false);
    await denied(()=>rpc('sfa_save_geofence',[id(11),0,0,5,'Fixture',null]));
    await login(2); await denied(()=>rpc('sfa_save_geofence',[id(11),0,0,5,'Fixture',null]));
  });
  await check('admin saves a 5 metre zone and the existing Android context receives it',async()=>{
    await login(1); const result=await rpc('sfa_save_geofence',[id(11),0,0,5,'Fixture',null]);
    zoneRevision=result.geofence.updated_at; assert.equal(result.geofence.radius_m,5);
    await login(11); const context=await rpc('sfa_phone_context',[sosPhone]);
    assert.equal(context.geofence.radius_m,5); assert.equal(context.geofence.updated_at,zoneRevision);
    assert.equal((await rpc('sfa_incidents',[id(11)])).events.length,2);
  });
  await check('invalid coordinates, small radii and stale revisions are rejected',async()=>{
    await login(1);
    for(const args of [[91,0,5], [0,181,5], [0,0,4], [0,0,100001], ['NaN',0,5]])
      await assert.rejects(()=>rpc('sfa_save_geofence',[id(11),...args,'Fixture',zoneRevision]),e=>e.code==='22023');
    await assert.rejects(()=>rpc('sfa_save_geofence',[id(11),0,0,10,'Fixture',null]),e=>e.code==='40001');
    assert.equal((await rpc('sfa_get_geofence',[id(11)])).geofence.radius_m,5);
  });
  await check('assigned configuring caregiver can change only the permitted resident zone',async()=>{
    await login(1); await rpc('sfa_set_team_access',[id(10),id(2),[id(11)],true,false]);
    await login(2); const updated=await rpc('sfa_save_geofence',[id(11),0,0,10,'Fixture',zoneRevision]);
    assert.equal(updated.geofence.radius_m,10);
    await denied(()=>rpc('sfa_save_geofence',[id(12),0,0,5,'Fixture',null]));
    await denied(()=>db.query('update public.sfa_geofences set radius_m=100 where resident_id=$1',[id(11)]));
    await login(1); await rpc('sfa_set_team_access',[id(10),id(2),[id(11)],false,false]);
    await login(2); assert.equal((await rpc('sfa_get_geofence',[id(11)])).can_configure,false);
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../migrations/202610210008_persistent_geofence.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610210009_zone_situation.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/202610210010_push_test_targets.sql',import.meta.url),'utf8'));
  let exitId;
  const fix = async (n, seconds, latitude=0, accuracy=1) => rpc('sfa_ingest_phone',[sosPhone,id(n),{
    latitude,longitude:0,accuracy_m:accuracy,observed_at:new Date(Date.now()+seconds*1000).toISOString(),
  }]);
  await check('imprecise GPS cannot generate a geofence incident',async()=>{
    await login(11); await fix(300,-89,0,100);
    assert.equal((await rpc('sfa_incidents',[id(11)])).events.filter(e=>e.event_type==='GEOCERCA_SALIDA').length,0);
    await fix(301,-78); await fix(302,-67);
  });
  await check('two sustained outside samples generate one durable incident and authorized push jobs',async()=>{
    await login(11); await fix(303,-56,.001); await fix(304,-45,.001);
    const exits=(await rpc('sfa_incidents',[id(11)])).events.filter(e=>e.event_type==='GEOCERCA_SALIDA');
    assert.equal(exits.length,1); exitId=exits[0].id;
    assert.equal(exits[0].outcome,null); assert.equal(exits[0].detail.source,'phone_gps_server');
    await login(1); const jobs=await rpc('sfa_claim_push_v2'); assert.equal(jobs.filter(j=>j.event_id===exitId).length,2);
    for(const job of jobs) await rpc('sfa_ack_push',[job.id,job.lease,'sent']);
  });
  await check('continued outside, uncertain GPS and reentry do not remove or duplicate pending attention',async()=>{
    await login(11); await fix(305,-34,.001); await fix(306,-23,.001,100);
    await fix(307,-12); await fix(308,-1);
    const exits=(await rpc('sfa_incidents',[id(11)])).events.filter(e=>e.event_type==='GEOCERCA_SALIDA');
    assert.equal(exits.length,1); assert.equal(exits[0].id,exitId); assert.equal(exits[0].outcome,null);
  });
  await check('explicit caregiver resolution followed by a new exit creates a new incident',async()=>{
    await login(2); await rpc('sfa_attend_incident',[exitId,null,'attending']);
    const taken=(await rpc('sfa_incidents',[id(11)])).events.find(e=>e.id===exitId);
    await rpc('sfa_attend_incident',[exitId,taken.updated_at,'attended']);
    await login(11); await fix(309,10,.001); await fix(310,21,.001);
    const exits=(await rpc('sfa_incidents',[id(11)])).events.filter(e=>e.event_type==='GEOCERCA_SALIDA');
    assert.equal(exits.length,2); assert.equal(exits.filter(e=>e.outcome===null).length,1);
  });
  await check('unresolved incidents never disappear behind the fifty-item resolved history limit',async()=>{
    await db.exec('reset role');
    for(let n=400;n<470;n++) {
      await db.query("insert into public.sfa_events(id,resident_id,device_id,event_type,observed_at,simulated) values($1,$2,$3,'PRUEBA_NOTIFICACION',now()+($4 * interval '1 second'),true)",[id(n),id(11),sosPhone,n]);
      await db.query("insert into public.sfa_event_attention values($1,$2,'attended',clock_timestamp())",[id(n),id(2)]);
    }
    await login(2); const result=await rpc('sfa_incidents',[id(11)]);
    assert.equal(result.viewer_id,id(2));
    assert.equal(result.events.filter(e=>e.outcome==='attended').length,50);
    assert.equal(result.events.filter(e=>e.event_type==='GEOCERCA_SALIDA' && e.outcome===null).length,1);
    assert.ok(result.events.some(e=>e.id===id(200)));
    await denied(()=>db.query('select * from sfa_private.geofence_state'));
  });
  await check('closing attention while still outside retains the zone warning without duplicate alerts',async()=>{
    await login(2); const current=(await rpc('sfa_incidents',[id(11)])).events.find(e=>e.event_type==='GEOCERCA_SALIDA' && e.outcome===null);
    await rpc('sfa_attend_incident',[current.id,null,'attending']);
    const taken=(await rpc('sfa_incidents',[id(11)])).events.find(e=>e.id===current.id);
    await rpc('sfa_attend_incident',[current.id,taken.updated_at,'attended']);
    const snapshot=await rpc('sfa_incidents',[id(11)]);
    assert.equal(snapshot.zone_status.state,'outside'); assert.equal(snapshot.zone_status.last_confirmed,'outside');
    assert.equal(snapshot.events.filter(e=>e.event_type==='GEOCERCA_SALIDA' && !e.outcome).length,0);
    await denied(()=>db.query('select sfa_private.resident_zone_status($1)',[id(11)]));
  });
  await check('imprecise or stale GPS cannot dismiss a previously confirmed exit',async()=>{
    await db.exec('reset role');
    const saved=(await db.query('select previous_at,quality from sfa_private.geofence_state where device_id=$1',[sosPhone])).rows[0];
    await db.query("update sfa_private.geofence_state set quality='imprecise' where device_id=$1",[sosPhone]);
    await login(2); let status=(await rpc('sfa_incidents',[id(11)])).zone_status;
    assert.equal(status.state,'imprecise'); assert.equal(status.last_confirmed,'outside');
    await db.exec('reset role');
    await db.query("update sfa_private.geofence_state set previous_at=now()-interval '100 seconds' where device_id=$1",[sosPhone]);
    await login(2); status=(await rpc('sfa_incidents',[id(11)])).zone_status;
    assert.equal(status.state,'stale'); assert.equal(status.last_confirmed,'outside');
    await db.exec('reset role'); await db.query('update sfa_private.geofence_state set previous_at=$2,quality=$3 where device_id=$1',[sosPhone,saved.previous_at,saved.quality]);
  });
  await check('zone revision changes cannot label the previous perimeter as the current state',async()=>{
    await db.exec('reset role');
    await db.query("update public.sfa_geofences set updated_at=updated_at+interval '1 second' where resident_id=$1",[id(11)]);
    await login(2); const status=(await rpc('sfa_incidents',[id(11)])).zone_status;
    assert.equal(status.state,'unknown'); assert.equal(status.last_confirmed,'unknown');
    await login(null,'anon'); await denied(()=>rpc('sfa_incidents',[id(11)]));
    await login(3); await denied(()=>rpc('sfa_incidents',[id(11)]));
  });
  await check('revoked emitter stops submitting while incident history remains available to caregivers',async()=>{
    await login(1); await rpc('sfa_revoke_team_member',[id(10),id(11)]);
    await login(11); await denied(()=>rpc('sfa_phone_sos',[sosPhone,id(203),sosStamp,false]));
    await login(2); assert.ok((await rpc('sfa_incidents',[id(11)])).events.length>2);
  });
  await check('test receiver list reveals only the current caregiver own installations, never FCM tokens',async()=>{
    await login(null,'anon'); await denied(()=>rpc('sfa_push_test_targets',[id(11)]));
    await login(3); await denied(()=>rpc('sfa_push_test_targets',[id(11)]));
    await login(2); const result=await rpc('sfa_push_test_targets',[id(11)]);
    assert.equal(result.devices.length,1); assert.equal(result.devices[0].installation_id,id(102));
    assert.ok(!JSON.stringify(result).includes('fixture_token'));
    assert.ok(!JSON.stringify(result).includes(id(101)));
  });
  await check('PC-style self-test is simulated, targets only the selected own phone and has a rate limit',async()=>{
    await login(2); await denied(()=>rpc('sfa_request_push_test',[id(11),id(101)]));
    const result=await rpc('sfa_request_push_test',[id(11),id(102)]); assert.equal(result.queued,true);
    const targets=await rpc('sfa_push_test_targets',[id(11)]);
    assert.equal(targets.devices[0].last_test.state,'pending');
    const event=(await rpc('sfa_incidents',[id(11)])).events.find(e=>e.id===result.event_id);
    assert.equal(event.simulated,true); assert.equal(event.event_type,'PRUEBA_NOTIFICACION');
    await assert.rejects(()=>rpc('sfa_request_push_test',[id(11),id(102)]),e=>e.code==='22023');
    await db.exec('reset role'); const jobs=(await db.query('select installation_id from sfa_private.push_jobs where event_id=$1',[result.event_id])).rows;
    assert.deepEqual(jobs.map(j=>j.installation_id),[id(102)]);
  });
  await check('disabled phones disappear from the self-test destination list',async()=>{
    await login(2); await rpc('sfa_register_push',[id(102),null,false]);
    assert.deepEqual((await rpc('sfa_push_test_targets',[id(11)])).devices,[]);
  });
  await check('two non-admin accounts share GPS and SOS only through the same assigned resident', async () => {
    await db.exec('reset role');
    for (const n of [50,51,52]) await db.query('insert into auth.users values($1,$2,now())',[id(n),`fixture${n}@example.invalid`]);
    await db.query("insert into public.sfa_memberships values($1,$2,'caregiver',null),($1,$3,'resident',null),($1,$4,'caregiver',null)",[id(10),id(50),id(51),id(52)]);
    await db.query('insert into public.sfa_resident_access(space_id,resident_id,user_id,can_configure,can_share_location) values($1,$2,$3,false,false),($1,$2,$4,false,true)',[id(10),id(12),id(50),id(51)]);
    await login(51); const phone = await rpc('sfa_register_phone',[id(12)]);
    await rpc('sfa_ingest_phone',[phone.device_id,id(500),{latitude:0,longitude:0,accuracy_m:5,observed_at:new Date().toISOString()}]);
    await rpc('sfa_phone_sos',[phone.device_id,id(501),new Date().toISOString(),false]);
    await denied(()=>rpc('sfa_team',[id(10)]));
    await login(50);
    assert.equal((await db.query('select count(*)::int n from public.sfa_positions where resident_id=$1',[id(12)])).rows[0].n,1);
    assert.ok((await rpc('sfa_incidents',[id(12)])).events.some(e=>e.id===id(501)));
    assert.deepEqual((await rpc('sfa_push_test_targets',[id(12)])).devices,[]);
    await rpc('sfa_register_push',[id(502),'fixture_new_caregiver_registration',true]);
    await db.exec('reset role'); await db.query("update public.sfa_events set received_at=now()-interval '31 seconds' where id=$1",[id(501)]);
    await login(51); await rpc('sfa_phone_sos',[phone.device_id,id(503),new Date().toISOString(),false]);
    await login(52);
    assert.equal((await db.query('select count(*)::int n from public.sfa_positions where resident_id=$1',[id(12)])).rows[0].n,0);
    await denied(()=>rpc('sfa_incidents',[id(12)]));
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int n from sfa_private.push_jobs where event_id=$1 and installation_id=$2',[id(503),id(502)])).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from sfa_private.push_jobs where event_id=$1 and installation_id=$2',[id(501),id(502)])).rows[0].n,0);
  });
  console.log(`${checks} team/incident checks passed (isolated PGlite, not live Auth/email/FCM).`);
} finally { await db.close(); }
