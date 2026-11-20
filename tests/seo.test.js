const assert=require('node:assert/strict');const crypto=require('node:crypto');
process.env.NODE_ENV='test';process.env.RINKCIRCUIT_TEST_SCHEMA='rinkcircuit_test_'+crypto.randomBytes(8).toString('hex');
process.env.ADMIN_TOKEN=crypto.randomBytes(32).toString('hex');process.env.ADMIN_USER='admin';
process.env.APP_URL='https://rink-circuit-hocky.vercel.app';process.env.PUBLIC_INDEXING_ENABLED='true';delete process.env.VERCEL_ENV;
const {getDb,closeDb}=require('../server/db/database');const {migrate}=require('../server/db/migrate');const db=getDb();let server;
async function run(){
 await migrate();const now=new Date().toISOString();
 await db.run(`INSERT INTO rinkcircuit.league_programmes(id,name,slug,area,municipality,category,publication_status,created_at,updated_at)
 VALUES ('seo','QA <script>alert(1)</script> & Hockey','seo-original','Toronto','Toronto','Adult ice','published',?,?),('private','PRIVATE SECRET NAME','private-seo','Toronto','Toronto','Adult ice','draft',?,?)`,now,now,now,now);
 await db.run(`INSERT INTO rinkcircuit.events(id,title,slug,city,lifecycle_state,created_at,updated_at) VALUES ('seo-event','QA Event','seo-event','Toronto','interest-only',?,?),('secret-event','PRIVATE EVENT','private-event','Toronto','draft',?,?)`,now,now,now,now);
 await db.run(`INSERT INTO rinkcircuit.teams(id,name,slug,city,publication_status,created_at,updated_at) VALUES ('seo-team','QA Team','seo-team','Toronto','published',?,?)`,now,now);
 server=require('../server/index').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const get=async path=>{const response=await fetch(base+path,{redirect:'manual'});return {status:response.status,headers:response.headers,text:await response.text()};};
 let r=await get('/leagues/seo-original');assert.equal(r.status,200);assert.ok(r.text.includes('QA &lt;script&gt;'));assert.ok(!r.text.includes('<script>alert(1)</script>'));assert.ok(r.text.includes('href="https://rink-circuit-hocky.vercel.app/leagues/seo-original"'));assert.equal(r.headers.get('x-robots-tag'),'index,follow');
 for(const path of ['/admin','/captains','/verify-email?token=secret-value','/listing-request','/leagues?city=Toronto']){r=await get(path);assert.equal(r.headers.get('x-robots-tag'),'noindex,follow');assert.ok(!r.text.includes('secret-value'));}
 for(const path of ['/leagues/private-seo','/tournaments/private-event','/locations/on/unknown','/locations/bc/toronto','/does-not-exist']){r=await get(path);assert.equal(r.status,404,path);assert.equal(r.headers.get('x-robots-tag'),'noindex,follow');assert.ok(!r.text.includes('PRIVATE SECRET NAME'));}
 r=await get('/tournaments/seo-event');assert.equal(r.status,200);assert.ok(r.text.includes('QA Event | Events | RinkCircuit'));assert.equal(r.headers.get('x-robots-tag'),'index,follow');
 r=await get('/teams/seo-team');assert.equal(r.status,200);assert.ok(r.text.includes('QA Team | RinkCircuit'));
 r=await get('/locations/on/toronto');assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'noindex,follow');
 const sitemap=await get('/sitemap.xml');for(const path of ['/leagues/seo-original','/teams/seo-team','/tournaments/seo-event'])assert.ok(sitemap.text.includes(path));assert.ok(!sitemap.text.includes('private-'));assert.ok(!sitemap.text.includes('/locations/'));
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.ADMIN_TOKEN})});assert.equal(login.status,200);const auth=await login.json();const headers={'Content-Type':'application/json',cookie:login.headers.get('set-cookie').split(';')[0],'x-csrf-token':auth.csrfToken};
 const edit=async data=>fetch(base+'/api/admin/leagues/seo',{method:'PATCH',headers,body:JSON.stringify(data)});
 assert.equal((await edit({version:1,slug:'seo-second'})).status,200);assert.equal((await edit({version:2,slug:'seo-final'})).status,200);
 for(const old of ['seo-original','seo-second']){r=await get('/leagues/'+old);assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/leagues/seo-final');}
 assert.equal((await edit({version:2,name:'Stale'})).status,409);assert.equal((await edit({version:3,slug:'../bad'})).status,400);
 assert.equal((await edit({version:3,publication_status:'archived'})).status,200);
 for(const slug of ['seo-original','seo-second','seo-final']){assert.equal((await get('/leagues/'+slug)).status,404);assert.equal((await get('/api/leagues/'+slug)).status,404);}
 assert.ok(!(await get('/sitemap.xml')).text.includes('seo-final'));
 process.env.VERCEL_ENV='preview';assert.equal((await get('/tournaments/seo-event')).headers.get('x-robots-tag'),'noindex,follow');assert.ok(!(await get('/sitemap.xml')).text.includes('<loc>'));assert.ok((await get('/robots.txt')).text.includes('Disallow: /'));delete process.env.VERCEL_ENV;
 process.env.PUBLIC_INDEXING_ENABLED='false';assert.equal((await get('/')).headers.get('x-robots-tag'),'noindex,follow');
 delete process.env.APP_URL;assert.equal((await get('/sitemap.xml')).status,503);assert.ok(!(await get('/')).text.includes('rel="canonical"'));
 console.log('SEO checks passed: escaped server metadata, canonical URLs, events, teams, query/private noindex, preview lock, sitemap publication boundary, rename chain and unpublish.');
}
run().catch(e=>{console.error('SEO test failed:',e.message);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));try{await db.exec('DROP SCHEMA IF EXISTS rinkcircuit CASCADE');}finally{await closeDb();}});
