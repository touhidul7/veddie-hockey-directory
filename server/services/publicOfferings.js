const {getDb}=require('../db/database');
function safeUrl(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
async function forProgrammes(ids){
  const result=new Map();if(!ids.length)return result;
  const db=getDb();
  const rows=await db.all(`SELECT id,programme_id,season_label,skill_labels,nights,age_eligibility,registration_modes,
    registration_status,fee_amount,fee_currency,fee_unit,fee_notes,registration_url,last_checked_at
    FROM rinkcircuit.season_offerings WHERE programme_id = ANY(?::text[]) ORDER BY id`,ids);
  const arenas=rows.length?await db.all(`SELECT oa.offering_id,a.id,a.name,a.address,a.city,a.postal_code
    FROM rinkcircuit.offering_arenas oa JOIN rinkcircuit.arenas a ON a.id=oa.arena_id
    WHERE oa.offering_id=ANY(?::text[]) ORDER BY a.name`,rows.map(row=>row.id)):[];
  for(const row of rows){
    let nights=[];try{const parsed=JSON.parse(row.nights||'[]');if(Array.isArray(parsed))nights=parsed.filter(x=>typeof x==='string');}catch{}
    const {programme_id,...offering}=row;
    const fresh=row.last_checked_at&&Date.parse(row.last_checked_at)<=Date.now()&&Date.parse(row.last_checked_at)>Date.now()-90*86400000;
    const item={...offering,nights,registration_url:safeUrl(row.registration_url),registration_status:fresh?row.registration_status:'unknown',
      freshness:fresh?'recent':'needs_review',arenas:arenas.filter(a=>a.offering_id===row.id).map(({offering_id,...arena})=>arena)};
    if(!result.has(programme_id))result.set(programme_id,[]);result.get(programme_id).push(item);
  }
  return result;
}
module.exports={forProgrammes,safeUrl};
