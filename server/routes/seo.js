const router=require('express').Router();
const fs=require('node:fs'),path=require('node:path');
const {getDb}=require('../db/database');
const {resolveLeagueSlug}=require('../services/slugResolver');
const escape=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const publicEventStates="('interest-only','announced','registration-open','registration-closed','completed','cancelled')";
function indexingEnabled(){return !!origin() && process.env.PUBLIC_INDEXING_ENABLED==='true' && process.env.VERCEL_ENV!=='preview';}
function origin(){try{const url=new URL(process.env.APP_URL);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.origin:null;}catch{return null;}}
router.get('/robots.txt',(req,res)=>{
  const base=origin();res.type('text/plain').send(indexingEnabled()?`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /verify-email\nDisallow: /captains\nDisallow: /listing-request\nDisallow: /request-a-league\nSitemap: ${base}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
});
router.get('/sitemap.xml',async(req,res)=>{
  const base=origin();if(!base)return res.status(503).type('text/plain').send('Public site URL is not configured.');
  const rows=await getDb().all("SELECT slug FROM rinkcircuit.league_programmes WHERE publication_status='published' ORDER BY slug");
  const teams=await getDb().all("SELECT slug FROM rinkcircuit.teams WHERE publication_status='published' ORDER BY slug");
  const events=await getDb().all(`SELECT slug FROM rinkcircuit.events WHERE lifecycle_state IN ${publicEventStates} ORDER BY slug`);
  const paths=['/','/leagues','/teams','/tournaments',...rows.map(row=>'/leagues/'+encodeURIComponent(row.slug)),...teams.map(row=>'/teams/'+encodeURIComponent(row.slug)),...events.map(row=>'/tournaments/'+encodeURIComponent(row.slug))];
  if(!indexingEnabled())paths.length=0;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${escape(base+p)}</loc></url>`).join('')}</urlset>`);
});
async function html(req,res,next){
  if(!['GET','HEAD'].includes(req.method)||req.path.startsWith('/api')||req.path.startsWith('/assets/'))return next();
  if(req.path==='/index.html')return res.redirect(301,'/');
  const filename=path.join(__dirname,'../../dist/index.html');if(!fs.existsSync(filename))return next();
  let title='RinkCircuit — Adult Hockey Directory',description='Find published adult hockey programmes and review official league sources.',indexable=['/','/leagues','/teams','/tournaments'].includes(req.path),status=200;
  if(req.path.startsWith('/leagues/')){
    let slug;try{slug=decodeURIComponent(req.path.slice(9));}catch{return res.sendStatus(400);}
    const record=await resolveLeagueSlug(slug);
    if(!record){status=404;title='Listing not found | RinkCircuit';indexable=false;}
    else if(record.slug!==slug)return res.redirect(301,'/leagues/'+encodeURIComponent(record.slug));
    else{title=record.name+' | RinkCircuit';description=record.description||`Official sources and programme details for ${record.name}.`;indexable=true;}
  }else if(req.path.startsWith('/teams/')){
    const team=await getDb().get("SELECT name FROM rinkcircuit.teams WHERE slug=? AND publication_status='published'",req.path.slice(7));
    indexable=!!team;if(team)title=team.name+' | RinkCircuit';else status=404;
  }else if(req.path.startsWith('/tournaments/')){
    let slug;try{slug=decodeURIComponent(req.path.slice('/tournaments/'.length));}catch{return res.sendStatus(400);}
    const event=await getDb().get(`SELECT title,description FROM rinkcircuit.events WHERE slug=? AND lifecycle_state IN ${publicEventStates}`,slug);
    if(!event){status=404;indexable=false;title='Event not found | RinkCircuit';}
    else{indexable=true;title=event.title+' | Events | RinkCircuit';description=event.description||'Event information and interest options. Interest does not confirm entry.';}
  }else if(req.path.startsWith('/locations/')){
    const match=/^\/locations\/on\/([a-z-]+)$/.exec(req.path);
    const city=match?require('./locations').cityMetadata[match[1]]:null;
    const supported=city&&await getDb().get("SELECT id FROM rinkcircuit.league_programmes WHERE publication_status='published' AND lower(municipality)=? LIMIT 1",city.name.toLowerCase());
    if(!supported){status=404;title='City guide not found | RinkCircuit';}
    else{title=city.headline+' | RinkCircuit';description=city.description;}
    // Curated editorial city copy still needs approval; do not index thin pages.
    indexable=false;
  }else if(!['/','/leagues','/teams','/tournaments','/admin','/captains','/operators','/request-a-league','/listing-request','/verify-email','/privacy','/terms','/contact'].includes(req.path)&&!req.path.startsWith('/locations/'))status=404;
  const base=origin();indexable=indexable&&indexingEnabled()&&status===200&&!Object.keys(req.query).length;
  const staticTitles={'/':'Adult Hockey Directory','/leagues':'Adult Hockey League Finder','/teams':'Adult Hockey Teams','/tournaments':'Hockey Events','/admin':'Operations Console','/captains':'Captain Interest','/request-a-league':'Request a League','/listing-request':'Listing Request','/verify-email':'Email Verification','/privacy':'Privacy Notice','/terms':'Terms','/contact':'Contact','/operators':'For Operators'};
  if(staticTitles[req.path])title=staticTitles[req.path]+' | RinkCircuit';
  if(status===404)indexable=false;
  const meta=`<meta name="rinkcircuit-indexing" content="${indexingEnabled()?'enabled':'disabled'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable?'index,follow':'noindex,follow'}">${base?`<link rel="canonical" href="${escape(base+req.path)}">`:''}`;
  const content=fs.readFileSync(filename,'utf8').replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+[^>]*name=["'](?:description|robots)["'][^>]*>/gi,'').replace('</head>',meta+'</head>');
  res.set('Cache-Control','no-store').set('X-Robots-Tag',indexable?'index,follow':'noindex,follow').status(status).type('html').send(content);
}
module.exports={router,html,origin,indexingEnabled};
