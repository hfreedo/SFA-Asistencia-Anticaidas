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
  await check('revoked emitter stops submitting while incident history remains available to caregivers',async()=>{
    await login(1); await rpc('sfa_revoke_team_member',[id(10),id(11)]);
    await login(11); await denied(()=>rpc('sfa_phone_sos',[sosPhone,id(203),sosStamp,false]));
    await login(2); assert.equal((await rpc('sfa_incidents',[id(11)])).events.length,2);
  });
  console.log(`${checks} team/incident checks passed (isolated PGlite, not live Auth/email/FCM).`);
} finally { await db.close(); }
