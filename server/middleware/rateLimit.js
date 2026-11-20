const crypto = require('node:crypto');
const net = require('node:net');
const { getDb } = require('../db/database');

function clientAddress(req) {
  // Only Vercel's runtime may supply the platform-overwritten forwarding header.
  // Local/self-hosted servers use the socket and ignore user-supplied headers.
  const forwarded = process.env.VERCEL === '1' ? req.headers['x-forwarded-for'] : undefined;
  const address = typeof forwarded === 'string' && net.isIP(forwarded.trim())
    ? forwarded.trim() : req.socket.remoteAddress || 'unknown';
  if (address.startsWith('::ffff:') && net.isIP(address.slice(7)) === 4) return address.slice(7);
  return net.isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname : address;
}

function keyFor(scope, identity) {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.ADMIN_TOKEN;
  if (!secret) throw new Error('A server secret is required for request throttling.');
  return crypto.createHmac('sha256', secret).update(`${scope}\0${identity}`).digest('hex');
}

async function consumeLimit(scope, identity, limit, windowSeconds) {
  const db = getDb();
  const key = keyFor(scope, identity);
  // Database time and atomic UPSERT keep counters consistent across instances.
  const row = await db.get(`INSERT INTO rinkcircuit.request_limits AS current (key_hash, hits, expires_at)
    VALUES (?, 1, floor(extract(epoch FROM now()))::bigint + ?)
    ON CONFLICT (key_hash) DO UPDATE SET
      hits = CASE WHEN current.expires_at <= floor(extract(epoch FROM now()))::bigint
        THEN 1 ELSE LEAST(current.hits + 1, ?) END,
      expires_at = CASE WHEN current.expires_at <= floor(extract(epoch FROM now()))::bigint
        THEN floor(extract(epoch FROM now()))::bigint + ? ELSE current.expires_at END
    RETURNING hits, GREATEST(1, expires_at - floor(extract(epoch FROM now()))::bigint) AS retry_after`,
  key, windowSeconds, limit + 1, windowSeconds);
  // Bounded opportunistic cleanup; no timer or always-running worker required.
  await db.run(`DELETE FROM rinkcircuit.request_limits WHERE key_hash IN
    (SELECT key_hash FROM rinkcircuit.request_limits
      WHERE expires_at < floor(extract(epoch FROM now()))::bigint - 86400
      ORDER BY expires_at LIMIT 100)`);
  return { allowed: row.hits <= limit, retryAfter: Number(row.retry_after) };
}

const policies = {
  '/api/analytics': ['analytics', 120],
  '/api/interests': ['interest', 20],
  '/api/listing-requests': ['listing', 10],
  '/api/email-verifications': ['verification', 30],
  '/api/email-verifications/resend': ['resend', 5],
  '/api/admin/login': ['admin-login', 10],
};

async function submissionRateLimit(req, res, next) {
  if(req.path==='/api/analytics'&&process.env.ANALYTICS_ENABLED!=='true')return next();
  const policy = req.method === 'POST' && policies[req.path.toLowerCase().replace(/\/+$/, '')];
  if (!policy) return next();
  try {
    const result = await consumeLimit(policy[0], clientAddress(req), policy[1], 900);
    res.set('Cache-Control', 'no-store');
    if (!result.allowed) return res.set('Retry-After', String(result.retryAfter)).status(429).json({
      error: 'Too many attempts. Please wait before trying again.', code: 'RATE_LIMITED', retry_after: result.retryAfter,
    });
    return next();
  } catch (error) {
    console.error('Request limiter unavailable:', error.code || error.name);
    return res.set('Retry-After', '30').status(503).json({ error: 'Submissions are temporarily unavailable. Please try again shortly.', code: 'SUBMISSIONS_UNAVAILABLE' });
  }
}
module.exports = { submissionRateLimit, consumeLimit, keyFor, clientAddress };
