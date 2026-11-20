const assert=require('node:assert/strict');
const crypto=require('node:crypto');
process.env.NODE_ENV='test';
process.env.RINKCIRCUIT_TEST_SCHEMA='rinkcircuit_test_'+crypto.randomBytes(8).toString('hex');
const {getDb,closeDb}=require('../server/db/database');
const {migrate}=require('../server/db/migrate');
const {decideRequest}=require('../server/services/moderationService');
const db=getDb();
async function run(){
  await migrate();
  const now=new Date().toISOString();
  await db.run("INSERT INTO rinkcircuit.organisations(id,name,created_at,updated_at) VALUES ('org','Fixture',?,?)",now,now);
  await db.run(`INSERT INTO rinkcircuit.league_programmes(id,organisation_id,name,slug,area,municipality,category,verification_status,created_at,updated_at)
    VALUES ('league','org','Fixture','fixture','Toronto','Toronto','Ice','research_checked',?,?)`,now,now);
  await db.run(`INSERT INTO rinkcircuit.listing_requests(id,request_type,programme_id,requester_name,requester_email,created_at)
    VALUES ('claim','claim','league','Fixture','fixture@example.com',?)`,now);
  await assert.rejects(decideRequest('claim',{decision:'approved'},'reviewer'),error=>error.status===400);
  assert.equal((await db.get("SELECT status FROM rinkcircuit.listing_requests WHERE id='claim'")).status,'pending');
  assert.equal((await db.get('SELECT count(*) AS count FROM rinkcircuit.audit_logs')).count,0);
  await assert.rejects(decideRequest('claim',{decision:'approved',evidence_reviewed:'true',admin_notes:'Reviewed authority with operator'},'reviewer'),error=>error.status===400);
  const input={decision:'approved',evidence_reviewed:true,admin_notes:'Confirmed authority using official operator contact.'};
  const outcomes=await Promise.allSettled([decideRequest('claim',input,'reviewer'),decideRequest('claim',input,'reviewer')]);
  assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);
  assert.equal(outcomes.find(item=>item.status==='rejected').reason.status,409);
  const programme=await db.get("SELECT claimed_status,verification_status,version FROM rinkcircuit.league_programmes WHERE id='league'");
  assert.equal(programme.claimed_status,'claimed');assert.equal(programme.verification_status,'research_checked');assert.equal(programme.version,2);
  const audit=await db.all('SELECT actor,details_json FROM rinkcircuit.audit_logs');
  assert.equal(audit.length,1);assert.equal(audit[0].actor,'reviewer');assert.equal(JSON.parse(audit[0].details_json).evidence_reviewed,true);
  console.log('Ownership evidence, atomic decisions and audit checks passed.');
}
run().catch(error=>{console.error('Moderation test failed:',error.code||error.message);process.exitCode=1;}).finally(async()=>{
  try{await db.exec('DROP SCHEMA IF EXISTS rinkcircuit CASCADE');}finally{await closeDb();}
});
