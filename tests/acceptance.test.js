const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.RINKCIRCUIT_TEST_SCHEMA = `rinkcircuit_test_${crypto.randomBytes(8).toString('hex')}`;
process.env.ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');
const { getDb, closeDb } = require('../server/db/database');
const { migrate } = require('../server/db/migrate');
const { previewAndStageBatch, commitStagedBatch } = require('../server/services/importService');
const { exportBackup, restoreBackup } = require('../server/db/backup');
const tables = require('../server/db/tables.json');
const db = getDb();
let server, base, adminCookie, csrfToken;
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function request(url, method='GET', body, admin=false) {
  const headers={'Content-Type':'application/json'};
  if(admin) { headers.Cookie=adminCookie; headers['x-csrf-token']=csrfToken; }
  const res=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});
  const data=await res.json();
  if(url==='/api/admin/login' && res.ok) { adminCookie=res.headers.get('set-cookie').split(';')[0];csrfToken=data.csrfToken; }
  return {status:res.status,body:data,cookie:res.headers.get('set-cookie')};
}
async function run() {
  await migrate();
  await migrate();
  const app=require('../server/index');
  server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  const now=new Date().toISOString();
  await db.run(`INSERT INTO rinkcircuit.organisations (id,name,aliases,created_at,updated_at) VALUES ('org_test','Test Operator','Alias Hockey',?,?)`,now,now);
  await db.run(`INSERT INTO rinkcircuit.league_programmes (id,organisation_id,name,slug,area,municipality,category,publication_status,verification_status,created_at,updated_at)
    VALUES ('league_test','org_test','Fixture Hockey','fixture-hockey','Vaughan','Vaughan','Adult ice','published','research_checked',?,?)`,now,now);
  await db.run(`INSERT INTO rinkcircuit.season_offerings (id,programme_id,season_label,age_eligibility,nights,registration_status,created_at,updated_at)
    VALUES ('off_test','league_test','Winter 2026','18+','["Monday"]','unknown',?,?)`,now,now);
  await db.run(`INSERT INTO rinkcircuit.events (id,title,slug,city,lifecycle_state,created_at,updated_at)
    VALUES ('event_test','Fixture Event','fixture-event','Toronto','interest-only',?,?),('event_draft','Draft','fixture-draft','Toronto','draft',?,?)`,now,now,now,now);
  await check('migrations and RLS',async()=>{
    const rows=await db.all("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname = 'rinkcircuit'");
    for(const table of tables)assert.ok(rows.some(r=>r.tablename===table&&r.rowsecurity));
  });
  await check('shared rate limit concurrency, expiry and cleanup',async()=>{
    const { consumeLimit, keyFor } = require('../server/middleware/rateLimit');
    const results = await Promise.all(Array.from({length: 8}, () => consumeLimit('fixture-limit', '192.0.2.1', 3, 60)));
    assert.equal(results.filter(result => result.allowed).length, 3);
    assert.ok(results.every(result => result.retryAfter >= 1 && result.retryAfter <= 60));
    const key = keyFor('fixture-limit', '192.0.2.1');
    assert.match(key, /^[a-f0-9]{64}$/);
    await db.run('UPDATE rinkcircuit.request_limits SET expires_at = 0 WHERE key_hash = ?',key);
    assert.equal((await consumeLimit('fixture-limit','192.0.2.1',3,60)).allowed,true);
    await db.run("INSERT INTO rinkcircuit.request_limits (key_hash,hits,expires_at) VALUES ('expired-fixture',1,0)");
    assert.equal((await consumeLimit('fixture-limit','192.0.2.2',3,60)).allowed,true);
    assert.equal(await db.get("SELECT key_hash FROM rinkcircuit.request_limits WHERE key_hash='expired-fixture'"),undefined);
  });
  await check('transaction rollback',async()=>{
    await assert.rejects(db.transaction(async()=>{await db.run("UPDATE rinkcircuit.league_programmes SET name='Rolled back' WHERE id='league_test'");throw new Error('rollback');}));
    assert.equal((await db.get("SELECT name FROM rinkcircuit.league_programmes WHERE id='league_test'")).name,'Fixture Hockey');
  });
  await check('alias plus city and night search',async()=>{
    const r=await request('/api/leagues?q=Alias&city=Vaughan&night=Monday&category=Adult&age=18%2B');assert.equal(r.status,200);assert.equal(r.body.pagination.total,1);assert.equal(r.body.data[0].id,'league_test');
    assert.equal((await request('/api/leagues?night=Tuesday')).body.data.length,0);
    assert.equal((await request('/api/leagues?age=30%2B')).body.pagination.total,0);
    assert.equal((await request('/api/leagues?sport=unsupported')).status,400);
    assert.equal((await request('/api/leagues?sport=all')).body.pagination.total,1);
  });
  await check('bounded pagination and unknown fee',async()=>{
    assert.equal((await request('/api/leagues?limit=-1')).body.pagination.limit,1);
    const r=await request('/api/leagues/fixture-hockey');assert.equal(r.status,200);assert.equal(r.body.data.offerings[0].fee_amount,null);
  });
  await check('city directory includes published offering details',async()=>{
    assert.equal((await request('/api/locations')).status,200);
    const city=await request('/api/locations/on/vaughan');
    assert.equal(city.body.data.totalLeagues,1);
    assert.equal(city.body.data.leagues[0].offerings[0].age_eligibility,'18+');
  });
  await check('event publication boundary',async()=>{assert.equal((await request('/api/events')).body.data.length,1);assert.equal((await request('/api/events/fixture-draft')).status,404);assert.equal((await request('/api/events/fixture-event')).body.data.price_amount,null);});
  await check('admin credentials',async()=>{
    assert.equal((await request('/api/admin/overview')).status,401);
    assert.equal((await request('/api/admin/login','POST',{username:'admin',password:'admin1234'})).status,401);
    assert.equal((await request('/api/admin/login','POST',{username:'admin',password:process.env.ADMIN_TOKEN})).status,200);
    assert.equal((await request('/api/admin/overview','GET',null,true)).status,200);
  });
  await check('admin cookie session, CSRF and legacy credential boundary',async()=>{
    const r=await request('/api/admin/login','POST',{username:'admin',password:process.env.ADMIN_TOKEN});
    assert.equal(r.status,200); assert.ok(!('token' in r.body));
    assert.match(r.cookie,/HttpOnly/i);assert.match(r.cookie,/SameSite=Strict/i);
    assert.ok(!r.cookie.includes(process.env.ADMIN_TOKEN));
    assert.equal((await fetch(base+'/api/admin/overview',{headers:{'x-admin-token':process.env.ADMIN_TOKEN}})).status,401);
    assert.equal((await fetch(base+'/api/admin/logout',{method:'POST',headers:{Cookie:adminCookie}})).status,403);
    assert.equal((await request('/api/admin/session','GET',null,true)).body.user.username,'admin');
    const cross=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({username:'admin',password:process.env.ADMIN_TOKEN})});
    assert.equal(cross.status,403);
    const stored=await db.get('SELECT token_hash FROM rinkcircuit.admin_sessions LIMIT 1');
    assert.ok(!adminCookie.includes(stored.token_hash));
    assert.equal((await db.get("SELECT rowsecurity FROM pg_tables WHERE schemaname='rinkcircuit' AND tablename='admin_sessions'")).rowsecurity,true);
  });
  const submission={interest_type:'captain_team',email:'fixture@example.com',name:'Fixture Captain',city:'Toronto',team_name:'Fixture Team',marketing_consent:false,publication_consent:true};
  let receipt;
  await check('concurrent interest deduplication and durable outbox',async()=>{
    const results=await Promise.all([request('/api/interests','POST',submission),request('/api/interests','POST',submission)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);receipt=results.find(r=>r.status===201).body;
    assert.ok(!('verification_token' in receipt));
    assert.equal((await db.get('SELECT count(*) AS c FROM rinkcircuit.interests')).c,1);
    assert.equal((await db.get('SELECT count(*) AS c FROM rinkcircuit.email_outbox')).c,1);
    assert.equal((await db.get("SELECT granted FROM rinkcircuit.consents WHERE purpose='marketing'")).granted,0);
  });
  await check('failed submission rolls back all writes',async()=>{
    const r=await request('/api/interests','POST',{...submission,email:'invalid-event@example.com',event_id:'missing-event'});
    assert.equal(r.status,500);
    assert.equal((await db.get("SELECT count(*) AS c FROM rinkcircuit.leads WHERE email='invalid-event@example.com'")).c,0);
  });
  await check('verification token is single-use',async()=>{
    const token=(await db.get('SELECT token FROM rinkcircuit.email_verifications WHERE lead_id=?',receipt.lead_id)).token;
    const results=await Promise.all([request('/api/email-verifications','POST',{token}),request('/api/email-verifications','POST',{token})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    assert.equal((await db.get('SELECT verification_status FROM rinkcircuit.leads WHERE id=?',receipt.lead_id)).verification_status,'verified');
  });
  await check('verified duplicate receipt preserves verification and outbox',async()=>{
    const before = (await db.get('SELECT count(*) AS count FROM rinkcircuit.email_outbox')).count;
    const repeat = await request('/api/interests','POST',submission);
    assert.equal(repeat.status,200);
    assert.equal(repeat.body.deduplicated,true);
    assert.equal(repeat.body.verification_required,false);
    assert.equal((await db.get('SELECT count(*) AS count FROM rinkcircuit.email_outbox')).count,before);
  });
  await check('resend does not expose addresses or tokens',async()=>{
    const known=await request('/api/email-verifications/resend','POST',{email:submission.email});
    const unknown=await request('/api/email-verifications/resend','POST',{email:'unknown@example.com'});
    assert.deepEqual(known,unknown);
  });
  await check('team moderation and public privacy',async()=>{
    const r=await request(`/api/admin/teams/${receipt.submission_id}/decision`,'POST',{decision:'approved'},true);assert.equal(r.status,200);
    const team=await request('/api/teams/'+r.body.slug);assert.equal(team.status,200);assert.ok(!JSON.stringify(team.body).includes(submission.email));
    assert.equal((await request('/api/teams')).body.data.length,1);
    assert.equal((await request(`/api/admin/teams/${receipt.submission_id}/decision`,'POST',{decision:'approved'},true)).status,409);
    assert.ok(!(await request('/api/admin/teams/pending','GET',null,true)).body.data.some(row=>row.id===receipt.submission_id));
  });
  await check('team consent, verification, rejection and concurrency safeguards',async()=>{
    const {decideTeam}=require('../server/services/moderationService');
    const create=async(id,consent)=>db.run(`INSERT INTO rinkcircuit.interests(id,lead_id,interest_type,team_name,city,publication_consent,created_at)
      VALUES (?,?,'captain_team','Same name','Toronto',?,?)`,id,receipt.lead_id,consent,now);
    await create('no-consent',false);
    await assert.rejects(decideTeam('no-consent',{decision:'approved'},'admin'),e=>e.status===409);
    await decideTeam('no-consent',{decision:'rejected'},'admin');
    assert.equal((await db.get("SELECT moderation_status FROM rinkcircuit.interests WHERE id='no-consent'")).moderation_status,'rejected');
    await create('concurrent-team',true);
    await db.run("UPDATE rinkcircuit.leads SET verification_status='pending' WHERE id=?",receipt.lead_id);
    await assert.rejects(decideTeam('concurrent-team',{decision:'approved'},'admin'),e=>e.status===409);
    await db.run("UPDATE rinkcircuit.leads SET verification_status='verified' WHERE id=?",receipt.lead_id);
    const outcomes=await Promise.allSettled([decideTeam('concurrent-team',{decision:'approved'},'admin'),decideTeam('concurrent-team',{decision:'approved'},'admin')]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,409);
    assert.equal((await db.get("SELECT count(*) AS count FROM rinkcircuit.teams WHERE name='Same name'")).count,1);
    await assert.rejects(decideTeam('no-consent',{decision:'unexpected'},'admin'),e=>e.status===400);
  });
  await check('listing request moderation and audit',async()=>{
    const r=await request('/api/listing-requests','POST',{request_type:'correction',programme_id:'league_test',requester_name:'Fixture',requester_email:'fixture@example.com',message:'Test correction'});assert.equal(r.status,201);
    assert.equal((await request(`/api/admin/requests/${r.body.request_id}/decision`,'POST',{decision:'rejected',admin_notes:'Fixture'},true)).status,200);
    assert.equal((await request('/api/admin/requests','GET',null,true)).body.data[0].status,'rejected');
  });
  await check('concurrent edits reject stale version and redirect slug',async()=>{
    const results=await Promise.all([
      request('/api/admin/leagues/league_test','PATCH',{version:1,name:'Updated one'},true),
      request('/api/admin/leagues/league_test','PATCH',{version:1,name:'Updated two'},true)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal((await request('/api/admin/leagues/league_test','PATCH',{version:2,slug:'renamed-fixture'},true)).status,200);
    assert.equal((await request('/api/leagues/fixture-hockey')).status,301);
  });
  await check('import stages without publishing and commits idempotently',async()=>{
    const rows=[{League:'Imported Fixture',Area:'Toronto',Category:'Adult ice',Source:'https://example.com/league'},
      {League:'H.E.T.I. Fixture',Area:'Toronto',Category:'Applicant',Source:'https://example.com/applicant'},
      {League:'',Area:'',Category:''}];
    const preview=await previewAndStageBatch('fixture.csv','test',rows);
    assert.equal(preview.summary.missingFields,1);assert.equal(preview.summary.applicantLeads,1);
    assert.equal((await db.get('SELECT count(*) AS c FROM rinkcircuit.league_programmes')).c,1);
    const ids=preview.stagedRows.map(r=>r.id);
    assert.equal((await commitStagedBatch(preview.batchId,ids)).createdCount,2);
    assert.equal((await commitStagedBatch(preview.batchId,ids)).createdCount,0);
    const next=await previewAndStageBatch('fixture.csv','test',rows);
    assert.equal((await commitStagedBatch(next.batchId,next.stagedRows.map(r=>r.id))).createdCount,0);
    const applicant=await db.get("SELECT publication_status FROM rinkcircuit.league_programmes WHERE name='H.E.T.I. Fixture'");assert.equal(applicant.publication_status,'draft');
    const offering=await db.get("SELECT nights,fee_amount,registration_status FROM rinkcircuit.season_offerings WHERE id!='off_test' LIMIT 1");
    assert.deepEqual(offering,{nights:null,fee_amount:null,registration_status:'unknown'});
  });
  await check('admin import API',async()=>{
    const p=await request('/api/admin/imports/preview','POST',{rows:[{League:'API Fixture',Area:'Toronto',Category:'Ice',Source:'https://example.com/api'}]},true);assert.equal(p.status,200);
    const r=await request(`/api/admin/imports/${p.body.batchId}/commit`,'POST',{approvedRowIds:p.body.stagedRows.map(r=>r.id),rowVersions:Object.fromEntries(p.body.stagedRows.map(r=>[r.id,r.reviewVersion]))},true);assert.equal(r.status,200);assert.equal(r.body.createdCount,1);
  });
  await check('SMTP job endpoint requires its own secret',async()=>{
    assert.equal((await request('/api/jobs/email')).status,401);
    assert.equal((await request('/api/jobs/email','GET',null,true)).status,401);
  });
  await check('SMTP concurrent claims, retries and uncertain recovery without live mail',async()=>{
    const { deliverBatch } = require('../server/services/smtpDelivery');
    const add = async id => db.run(`INSERT INTO rinkcircuit.email_outbox(id,recipient,subject,body,created_at)
      VALUES (?, 'fixture@example.com', 'Fixture', 'No live mail', ?)`,id,now);
    await add('smtp-success');
    let sends=0;
    const transport={sendMail:async mail=>{sends++;assert.equal(mail.to.address,'fixture@example.com');return {accepted:['fixture@example.com']};}};
    await Promise.all([deliverBatch({transport,from:'sender@example.com',limit:1}),deliverBatch({transport,from:'sender@example.com',limit:1})]);
    assert.equal(sends,1);
    assert.equal((await db.get("SELECT status FROM rinkcircuit.email_outbox WHERE id='smtp-success'")).status,'sent');
    await add('smtp-retry');
    const temporary={sendMail:async()=>{throw Object.assign(new Error('PRIVATE SMTP RESPONSE'),{responseCode:451});}};
    await deliverBatch({transport:temporary,from:'sender@example.com',limit:1});
    let row=await db.get("SELECT * FROM rinkcircuit.email_outbox WHERE id='smtp-retry'");
    assert.equal(row.status,'pending');assert.equal(row.attempts,1);assert.equal(row.last_error,'SMTP_451');
    assert.equal((await deliverBatch({transport,from:'sender@example.com',limit:1})).processed,0);
    await db.run("UPDATE rinkcircuit.email_outbox SET next_attempt_at=now()-interval '1 second', attempts=4 WHERE id='smtp-retry'");
    await deliverBatch({transport:temporary,from:'sender@example.com',limit:1});
    assert.equal((await db.get("SELECT status FROM rinkcircuit.email_outbox WHERE id='smtp-retry'")).status,'failed');
    await add('smtp-uncertain');
    await deliverBatch({transport:{sendMail:async()=>{throw Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});}},from:'sender@example.com',limit:1});
    assert.equal((await db.get("SELECT status FROM rinkcircuit.email_outbox WHERE id='smtp-uncertain'")).status,'uncertain');
    await add('smtp-interrupted');
    await db.run("UPDATE rinkcircuit.email_outbox SET status='processing', locked_until=now()-interval '1 second' WHERE id='smtp-interrupted'");
    await add('smtp-expired');
    await db.run("UPDATE rinkcircuit.email_outbox SET expires_at=now()-interval '1 second' WHERE id='smtp-expired'");
    assert.equal((await deliverBatch({transport,from:'sender@example.com',limit:1})).processed,0);
    assert.equal((await db.get("SELECT status FROM rinkcircuit.email_outbox WHERE id='smtp-expired'")).status,'cancelled');
    assert.equal((await db.get("SELECT status FROM rinkcircuit.email_outbox WHERE id='smtp-interrupted'")).status,'uncertain');
    assert.equal(sends,1);
  });
  await check('admin backup export is audited and uncached',async()=>{
    const before=(await db.get("SELECT count(*) AS c FROM rinkcircuit.audit_logs WHERE action='backup_export'")).c;
    const response=await fetch(base+'/api/admin/backup',{headers:{Cookie:adminCookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).format,'rinkcircuit-postgres-v1');
    assert.equal((await db.get("SELECT count(*) AS c FROM rinkcircuit.audit_logs WHERE action='backup_export'")).c,before+1);
  });
  await check('full relational backup and restore',async()=>{
    const backup=await exportBackup();
    await db.run("UPDATE rinkcircuit.league_programmes SET name='Changed after backup' WHERE id='league_test'");
    await restoreBackup(backup);
    const restored=await exportBackup();
    for(const table of tables){const order=rows=>rows.map(row=>JSON.stringify(row)).sort();assert.deepEqual(order(restored[table]),order(backup[table]),table);}
    await assert.rejects(restoreBackup({league_programmes:[]}));
  });
  await check('resend route throttles with retry timing and no extra mail',async()=>{
    const before = (await db.get('SELECT count(*) AS count FROM rinkcircuit.email_outbox')).count;
    const responses = await Promise.all(Array.from({length:7},()=>fetch(base+'/api/email-verifications/resend',{
      method:'POST', headers:{'Content-Type':'application/json','X-Forwarded-For':crypto.randomUUID()},body:JSON.stringify({email:'not-a-lead@example.com'}),
    })));
    assert.ok(responses.some(response=>response.status===429));
    for (const response of responses) {
      assert.ok([200,429].includes(response.status));
      if(response.status===429) {
        assert.ok(Number(response.headers.get('retry-after'))>0);
        assert.equal((await response.json()).code,'RATE_LIMITED');
      }
    }
    assert.equal((await db.get('SELECT count(*) AS count FROM rinkcircuit.email_outbox')).count,before);
  });
  await check('database diagnostics are read only',async()=>{
    const before=(await db.get('SELECT count(*) AS c FROM rinkcircuit.audit_logs')).c;
    const r=await request('/api/admin-tests/run','GET',null,true);assert.equal(r.status,200);assert.equal(r.body.allPassed,true);
    assert.equal((await db.get('SELECT count(*) AS c FROM rinkcircuit.audit_logs')).c,before);
  });
  await check('anonymous role cannot read private data',async()=>{
    await assert.rejects(db.transaction(async()=>{await db.exec('SET LOCAL ROLE anon');await db.all('SELECT * FROM rinkcircuit.leads');}),error=>error.code==='42501');
  });
  await check('admin session expiry, logout and credential rotation',async()=>{
    const cookie=adminCookie;
    assert.equal((await request('/api/admin/logout','POST',{},true)).status,200);
    assert.equal((await fetch(base+'/api/admin/overview',{headers:{Cookie:cookie}})).status,401);
    await request('/api/admin/login','POST',{username:'admin',password:process.env.ADMIN_TOKEN});
    await db.run("UPDATE rinkcircuit.admin_sessions SET expires_at=now()-interval '1 second'");
    assert.equal((await request('/api/admin/overview','GET',null,true)).status,401);
    await request('/api/admin/login','POST',{username:'admin',password:process.env.ADMIN_TOKEN});
    const original=process.env.ADMIN_TOKEN;process.env.ADMIN_TOKEN=crypto.randomBytes(32).toString('hex');
    try {assert.equal((await request('/api/admin/overview','GET',null,true)).status,401);} finally{process.env.ADMIN_TOKEN=original;}
  });
  console.log(`Migration integration checks passed: ${passed}`);
}
run().catch(error=>{console.error('Integration failure:',error.code||error.message);process.exitCode=1;}).finally(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  try{await db.exec('DROP SCHEMA IF EXISTS rinkcircuit CASCADE');console.log('Removed isolated test schema.');}catch(error){console.error('Test schema cleanup failed:',error.code||error.message);process.exitCode=1;}
  await closeDb();
});
