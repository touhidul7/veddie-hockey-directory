const assert=require('node:assert/strict');
const {closeDb}=require('../server/db/database');
const app=require('../server/index');
async function verifyServer(){
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const path of ['/api/health','/api/leagues?limit=2','/api/events','/api/teams','/api/locations']){
      const response=await fetch(origin+path);assert.equal(response.status,200,path);await response.json();console.log('PASS '+path);
    }
    assert.equal((await fetch(origin+'/api/admin/overview')).status,401);
    assert.equal((await fetch(origin+'/api/admin/overview',{headers:{'x-admin-token':process.env.ADMIN_TOKEN||'invalid'}})).status,401);
    console.log('PASS admin rejects unauthenticated and legacy-key access');
    const home=await fetch(origin+'/');assert.equal(home.status,200);assert.ok((await home.text()).includes('RinkCircuit'));
    console.log('Read-only server smoke checks passed.');
  }finally{await new Promise(resolve=>server.close(resolve));await closeDb();}
}
if(require.main===module)verifyServer().catch(error=>{console.error('Smoke check failed:',error.code||error.message);process.exitCode=1;});
module.exports={verifyServer};
