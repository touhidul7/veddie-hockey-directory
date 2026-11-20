const assert = require('node:assert/strict');
const { smtpConfig, failureState, deliverBatch } = require('../server/services/smtpDelivery');
const env = { SMTP_HOST:'smtp.example.com', SMTP_PORT:'587', SMTP_USER:'user', SMTP_PASS:'secret', SMTP_FROM:'mail@example.com', APP_URL:'https://example.com' };
assert.equal(smtpConfig(env).options.requireTLS,true);
assert.equal(smtpConfig({...env,SMTP_PORT:'465'}).options.secure,true);
assert.equal(smtpConfig(env).options.tls.rejectUnauthorized,true);
assert.throws(()=>smtpConfig({...env,SMTP_PORT:'25'}));
assert.throws(()=>smtpConfig({...env,SMTP_FROM:'bad\r\nBcc: victim@example.com'}));
assert.throws(()=>smtpConfig({...env,NODE_ENV:'production',APP_URL:'http://example.com'}));
assert.throws(()=>smtpConfig({}));
assert.deepEqual(failureState({responseCode:451,message:'private address'},1),{status:'pending',error:'SMTP_451'});
assert.equal(failureState({responseCode:451},5).status,'failed');
assert.equal(failureState({responseCode:550},1).status,'failed');
assert.equal(failureState({code:'ETIMEDOUT'},1).status,'uncertain');
assert.equal(failureState({code:'ECONNECTION'},1).status,'pending');
assert.equal(failureState({code:'EAUTH'},1).status,'failed');
const oldEnabled = process.env.SMTP_ENABLED;
process.env.SMTP_ENABLED='false';
deliverBatch().then(result=>{
  assert.deepEqual(result,{enabled:false,processed:0});
  console.log('SMTP configuration, retry policy and disabled-send checks passed.');
}).catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  if(oldEnabled===undefined)delete process.env.SMTP_ENABLED;else process.env.SMTP_ENABLED=oldEnabled;
});
