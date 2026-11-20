const {getDb}=require('../db/database');
const clientEvents=new Set(['search_submitted','filter_applied','league_viewed','official_link_clicked','external_registration_clicked']);
const serviceEvents=new Set(['interest_submitted','email_verified','team_approved','listing_request_submitted']);
async function record(event){
  if(!clientEvents.has(event)&&!serviceEvents.has(event))throw new Error('Unknown metric');
  await getDb().run(`INSERT INTO rinkcircuit.analytics_daily(day,event_name,count) VALUES ((now() AT TIME ZONE 'UTC')::date,?,1)
    ON CONFLICT(day,event_name) DO UPDATE SET count=rinkcircuit.analytics_daily.count+1`,event);
}
module.exports={record,clientEvents};
