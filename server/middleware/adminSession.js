const crypto = require('node:crypto');
const { getDb } = require('../db/database');
const cookieName = 'rinkcircuit_admin';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && crypto.timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
function cookieOptions() {
  return { httpOnly:true, sameSite:'strict', secure:process.env.NODE_ENV==='production'||process.env.VERCEL==='1', path:'/api' };
}
function tokenFrom(req) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)rinkcircuit_admin=([a-f0-9]{64})(?:;|$)/);
  return match?.[1];
}
function csrf(token) { return crypto.createHmac('sha256',process.env.ADMIN_TOKEN || '').update(`csrf:${token}`).digest('hex'); }
function user(username) { return {username,name:'RinkCircuit Operations Admin',role:'Administrator'}; }
async function login(req,res) {
  res.set('Cache-Control','no-store');
  // Login CSRF: require the configured public origin (or direct local origin).
  const origin = req.headers.origin;
  const expectedOrigin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  if (origin && origin !== new URL(expectedOrigin).origin) return res.status(403).json({error:'Untrusted login origin.'});
  const {username,password} = req.body || {};
  const configuredUser = process.env.ADMIN_USER || 'admin';
  if (!process.env.ADMIN_TOKEN || typeof username !== 'string' || !equal(username.trim().toLowerCase(),configuredUser.toLowerCase()) || !equal(password,process.env.ADMIN_TOKEN)) {
    return res.status(401).json({error:'Invalid username or security key.',code:'INVALID_CREDENTIALS'});
  }
  const token = crypto.randomBytes(32).toString('hex');
  const db = getDb();
  await db.transaction(async()=>{
    await db.run('DELETE FROM rinkcircuit.admin_sessions WHERE expires_at<=now() OR token_hash=?',hash(tokenFrom(req)||''));
    await db.run("INSERT INTO rinkcircuit.admin_sessions(token_hash,username,credential_hash,expires_at) VALUES (?,?,?,now()+interval '8 hours')",hash(token),configuredUser,hash(process.env.ADMIN_TOKEN));
    await db.run("INSERT INTO rinkcircuit.audit_logs(id,actor,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,'admin_login','auth_session',?,'{}',?)",crypto.randomUUID(),configuredUser,hash(token),new Date().toISOString());
  });
  res.cookie(cookieName,token,{...cookieOptions(),maxAge:8*3600000});
  res.json({success:true,user:user(configuredUser),csrfToken:csrf(token)});
}
async function requireAdmin(req,res,next) {
  res.set('Cache-Control','no-store');
  const token = tokenFrom(req);
  if (!token || !process.env.ADMIN_TOKEN) return res.status(401).json({error:'Admin login required.',code:'AUTH_REQUIRED'});
  const session = await getDb().get('SELECT username FROM rinkcircuit.admin_sessions WHERE token_hash=? AND expires_at>now() AND credential_hash=?',hash(token),hash(process.env.ADMIN_TOKEN));
  if (!session) return res.status(401).json({error:'Session expired. Please sign in.',code:'AUTH_REQUIRED'});
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && !equal(req.headers['x-csrf-token'],csrf(token))) return res.status(403).json({error:'Invalid request token.',code:'CSRF_REQUIRED'});
  req.admin = {username:session.username,tokenHash:hash(token),csrfToken:csrf(token)};
  // Audit actors come only from the authenticated session.
  if (req.body && typeof req.body==='object') req.body.actor=session.username;
  next();
}
async function logout(req,res) {
  await getDb().run('DELETE FROM rinkcircuit.admin_sessions WHERE token_hash=?',req.admin.tokenHash);
  res.clearCookie(cookieName,cookieOptions());
  res.json({success:true});
}
module.exports = {login,requireAdmin,logout,user};
