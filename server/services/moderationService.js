const crypto=require('node:crypto');
const {getDb}=require('../db/database');
function fail(status,message){const error=new Error(message);error.status=status;throw error;}
async function audit(db,actor,action,type,id,details,now){
  await db.run('INSERT INTO rinkcircuit.audit_logs(id,actor,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),actor,action,type,id,JSON.stringify(details),now);
}
async function decideTeam(id,input,actor){
  input=input||{};
  if(!['approved','rejected'].includes(input.decision))fail(400,'Choose approved or rejected.');
  for(const key of ['approved_name','approved_city','approved_division','home_league_name']){
    if(input[key]!=null && (typeof input[key]!=='string'||input[key].length>200))fail(400,'Approved team fields must be text of at most 200 characters.');
  }
  const db=getDb();
  return db.transaction(async()=>{
    const interest=await db.get('SELECT i.*,l.verification_status FROM rinkcircuit.interests i JOIN rinkcircuit.leads l ON l.id=i.lead_id WHERE i.id=? FOR UPDATE OF i',id);
    if(!interest||interest.interest_type!=='captain_team')fail(404,'Team submission not found.');
    if(interest.moderation_status!=='pending')fail(409,'This submission has already been reviewed.');
    const now=new Date().toISOString();
    let teamId=null,slug=null;
    if(input.decision==='approved'){
      if(!interest.publication_consent)fail(409,'Explicit publication consent is required.');
      if(interest.verification_status!=='verified')fail(409,'Captain email must be verified before publication.');
      const name=(input.approved_name??interest.team_name??'').trim();
      const city=(input.approved_city??interest.city??'').trim();
      if(!name||!city)fail(400,'Approved team name and city are required.');
      teamId=crypto.randomUUID();
      slug=(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'team')+'-'+crypto.createHash('sha256').update(id).digest('hex').slice(0,12);
      await db.run(`INSERT INTO rinkcircuit.teams(id,name,slug,city,division_label,home_league_name,publication_status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'published',?,?)`,teamId,name,slug,city,input.approved_division??interest.division??null,input.home_league_name??interest.home_league_or_independent??null,now,now);
    }
    await db.run('UPDATE rinkcircuit.interests SET team_id=?,moderation_status=?,moderated_at=? WHERE id=?',teamId,input.decision,now,id);
    if(input.decision==='approved')await require('./analytics').record('team_approved');
    await audit(db,actor,'team_'+input.decision,'interest',id,{team_id:teamId,decision:input.decision},now);
    return {success:true,team_id:teamId,slug,message:input.decision==='approved'?'Team profile published.':'Team submission rejected.'};
  });
}
async function decideRequest(id,input,actor){
  input=input||{};
  if(!['approved','rejected'].includes(input.decision))fail(400,'Choose approved or rejected.');
  if(input.admin_notes!==undefined&&(typeof input.admin_notes!=='string'||input.admin_notes.length>5000))fail(400,'Review notes must be text of at most 5000 characters.');
  const db=getDb();
  return db.transaction(async()=>{
    const request=await db.get('SELECT * FROM rinkcircuit.listing_requests WHERE id=? FOR UPDATE',id);
    if(!request)fail(404,'Request not found.');
    if(request.status!=='pending')fail(409,'This request has already been reviewed.');
    const now=new Date().toISOString();
    const claim=input.decision==='approved'&&request.request_type==='claim';
    if(claim){
      if(input.evidence_reviewed!==true || !input.admin_notes || input.admin_notes.trim().length<10)fail(400,'Confirm ownership evidence review and record how authority was verified.');
      if(!request.programme_id)fail(400,'A claim must identify an existing programme.');
      const result=await db.run("UPDATE rinkcircuit.league_programmes SET claimed_status='claimed',version=version+1,updated_at=? WHERE id=?",now,request.programme_id);
      if(!result.changes)fail(404,'Programme no longer exists.');
    }
    await db.run('UPDATE rinkcircuit.listing_requests SET status=?,admin_notes=?,decision_date=?,evidence_reviewed=? WHERE id=?',input.decision,input.admin_notes||'',now,claim,id);
    await audit(db,actor,'request_'+input.decision,'listing_request',id,{decision:input.decision,admin_notes:input.admin_notes||'',evidence_reviewed:claim,request_type:request.request_type},now);
    return {success:true,message:'Review decision recorded. Approved corrections or removals require a separate editorial change; claims do not grant account access.'};
  });
}
module.exports={decideTeam,decideRequest};
