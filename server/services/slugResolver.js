const {getDb}=require('../db/database');
async function resolveLeagueSlug(slug){
  const db=getDb(),seen=new Set();let current=slug;
  for(let i=0;i<20;i++){
    if(seen.has(current))return null;seen.add(current);
    const programme=await db.get("SELECT id,name,slug,description,updated_at,publication_status FROM rinkcircuit.league_programmes WHERE slug=?",current);
    if(programme)return programme.publication_status==='published'?programme:null;
    const redirect=await db.get("SELECT new_slug FROM rinkcircuit.slug_redirects WHERE old_slug=? AND entity_type='league_programme'",current);
    if(!redirect)return null;current=redirect.new_slug;
  }
  return null;
}
module.exports={resolveLeagueSlug};
