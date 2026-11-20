const assert = require('node:assert/strict');
const { clientAddress, submissionRateLimit } = require('../server/middleware/rateLimit');

async function run() {
  const previous = process.env.VERCEL;
  const previousSecret = process.env.RATE_LIMIT_SECRET;
  const previousAdmin = process.env.ADMIN_TOKEN;
  try {
    delete process.env.VERCEL;
    const req = { headers: {'x-forwarded-for':'192.0.2.8'}, socket: { remoteAddress:'::ffff:127.0.0.1' } };
    assert.equal(clientAddress(req),'127.0.0.1');
    process.env.VERCEL = '1';
    assert.equal(clientAddress(req),'192.0.2.8');
    req.headers['x-forwarded-for']='192.0.2.8, 192.0.2.9';
    assert.equal(clientAddress(req),'127.0.0.1');
    req.headers['x-forwarded-for']='2001:db8::1';
    assert.equal(clientAddress(req),'[2001:db8::1]');
    req.headers['x-forwarded-for']='2001:0db8:0:0:0:0:0:1';
    assert.equal(clientAddress(req),'[2001:db8::1]');
    let next = 0;
    await submissionRateLimit({method:'GET',path:'/api/interests'}, {}, ()=>next++);
    await submissionRateLimit({method:'POST',path:'/api/admin/backup'}, {}, ()=>next++);
    assert.equal(next,2);
    process.env.RATE_LIMIT_SECRET = '';
    process.env.ADMIN_TOKEN = '';
    for (const path of ['/api/interests', '/api/listing-requests', '/api/email-verifications', '/api/email-verifications/resend', '/api/admin/login', '/API/INTERESTS/']) {
      const res = {
        headers: {}, set(name,value) {this.headers[name]=value;return this;},
        status(value) {this.statusCode=value;return this;}, json(value) {this.body=value;return this;},
      };
      await submissionRateLimit({...req,method:'POST',path},res,()=>assert.fail('Unprotected submission'));
      assert.equal(res.statusCode,503);
      assert.equal(res.headers['Retry-After'],'30');
      assert.equal(res.body.code,'SUBMISSIONS_UNAVAILABLE');
    }
    console.log('Rate limit client identity and route checks passed.');
  } finally {
    if(previous===undefined) delete process.env.VERCEL;
    else process.env.VERCEL=previous;
    if(previousSecret===undefined) delete process.env.RATE_LIMIT_SECRET;
    else process.env.RATE_LIMIT_SECRET=previousSecret;
    if(previousAdmin===undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN=previousAdmin;
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
