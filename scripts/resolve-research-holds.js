const {getDb,closeDb}=require('../server/db/database');
const {getBatchReview,reviewImportRow}=require('../server/services/importService');
const {sourceReviewFor}=require('../server/services/sourceReview');
const plan=require('../server/data/programme-scope-resolutions.json');
async function run(){
  const apply=process.argv.includes('--apply');
  const rows=await getDb().all('SELECT * FROM rinkcircuit.import_rows');
  const results=[];
  for(const decision of plan.decisions){
    const matches=rows.filter(row=>row.candidate_programme_name===decision.name&&sourceReviewFor(row.candidate_programme_name,row.candidate_area,row.candidate_category,row.evidence_url));
    if(matches.length!==1)throw new Error('Candidate changed or ambiguous: '+decision.name);
    const row=matches[0],flags=JSON.parse(row.flags||'[]');
    if(!flags.includes('editorial_hold')&&flags.includes('scope_reviewed')){
      const preview=await getBatchReview(row.batch_id);
      const existing=preview.stagedRows.find(item=>item.id===row.id).editorialResolution;
      if(existing?.scope!==decision.programmeScope||existing?.evidenceUrl!==decision.evidenceUrl)throw new Error('Existing scope differs from reviewed decision');
      results.push({name:decision.name,outcome:'already_resolved'});continue;
    }
    if(row.status!=='pending_review'||!flags.includes('editorial_hold'))throw new Error('Candidate is no longer awaiting hold review');
    if(apply)await reviewImportRow(row.batch_id,row.id,{action:'resolve_hold',version:row.review_version,evidenceReviewed:true,evidenceUrl:decision.evidenceUrl,reason:decision.reason,programmeScope:decision.programmeScope},'research-scope-reconciliation');
    results.push({name:decision.name,outcome:apply?'resolved_draft_only':'proposed',scope:decision.programmeScope});
  }
  console.log(JSON.stringify({mode:apply?'apply':'preview',results},null,2));
}
run().catch(error=>{console.error('Hold resolution failed:',error.code||error.message);process.exitCode=1;}).finally(closeDb);
