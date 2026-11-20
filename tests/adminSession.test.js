const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {getDb}=require('../server/db/database');
const {requireAdmin}=require('../server/middleware/adminSession');
async function run() {
  const db=getDb(),originalGet=db.get, originalSecret=process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN='test-only-secret';
  const token='a'.repeat(64);
  const csrf=crypto.createHmac('sha256',process.env.ADMIN_TOKEN).update(`csrf:${token}`).digest('hex');
  const res={set(){return this;},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
  try {
    db.get=async()=>({username:'real-admin'});
    const req={method:'POST',headers:{cookie:`rinkcircuit_admin=${token}`,'x-csrf-token':csrf},body:{actor:'forged-admin'}};
    let passed=false;await requireAdmin(req,res,()=>{passed=true;});
    assert.equal(passed,true);assert.equal(req.body.actor,'real-admin');
    assert.equal(req.admin.username,'real-admin');
    req.headers['x-csrf-token']='forged';
    await requireAdmin(req,res,()=>assert.fail('Invalid CSRF was accepted'));
    assert.equal(res.statusCode,403);
    db.get=async()=>undefined;
    await requireAdmin(req,res,()=>assert.fail('Expired session was accepted'));
    assert.equal(res.statusCode,401);
    console.log('Authenticated audit identity and session rejection checks passed.');
  } finally {db.get=originalGet;if(originalSecret===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=originalSecret;}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
