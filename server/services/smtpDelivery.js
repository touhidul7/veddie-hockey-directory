const nodemailer = require('nodemailer');
const { getDb, closeDb } = require('../db/database');

function smtpConfig(env = process.env) {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'APP_URL'];
  if (required.some(key => !env[key])) throw new Error('SMTP_CONFIG_MISSING');
  const port = Number(env.SMTP_PORT);
  if (![465, 587].includes(port)) throw new Error('SMTP_PORT_MUST_BE_465_OR_587');
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.SMTP_FROM)) throw new Error('SMTP_FROM_MUST_BE_EMAIL');
  const origin = new URL(env.APP_URL);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('APP_URL_INVALID');
  if (env.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error('APP_URL_REQUIRES_HTTPS');
  return { from: env.SMTP_FROM, options: {
    host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    tls: { rejectUnauthorized: true }, connectionTimeout: 10000,
    greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  } };
}

function failureState(error, attempts) {
  // Never store provider responses: they may contain addresses or credentials.
  const code = Number(error.responseCode);
  if (code >= 500 && code < 600) return { status: 'failed', error: `SMTP_${code}` };
  if (code >= 400 && code < 500) return { status: attempts >= 5 ? 'failed' : 'pending', error: `SMTP_${code}` };
  if (['ECONNECTION', 'EDNS', 'EAUTH', 'ETLS'].includes(error.code)) {
    return { status: attempts >= 5 || error.code === 'EAUTH' ? 'failed' : 'pending', error: error.code };
  }
  // A timeout/disconnect can happen after acceptance. Require review, not a blind resend.
  return { status: 'uncertain', error: 'SMTP_OUTCOME_UNKNOWN' };
}

async function deliverBatch({ transport, from, limit = 5 } = {}) {
  if (!transport) {
    if (process.env.SMTP_ENABLED !== 'true') return { enabled: false, processed: 0 };
    const config = smtpConfig();
    from = config.from;
    transport = nodemailer.createTransport(config.options);
  }
  if (!from || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('INVALID_DELIVERY_OPTIONS');
  const db = getDb();
  const counts = { processed: 0, sent: 0, pending: 0, failed: 0, uncertain: 0 };
  await db.run("UPDATE rinkcircuit.email_outbox SET status='uncertain', last_error='WORKER_INTERRUPTED', locked_until=NULL WHERE status='processing' AND locked_until < now()");
  await db.run(`UPDATE rinkcircuit.email_outbox AS mail SET status='cancelled', last_error='VERIFICATION_NO_LONGER_ACTIVE'
    WHERE status='pending' AND (expires_at <= now() OR EXISTS
      (SELECT 1 FROM rinkcircuit.email_verifications v WHERE v.id=mail.verification_id AND v.used_at IS NOT NULL))`);
  for (let i = 0; i < limit; i++) {
    const row = await db.get(`UPDATE rinkcircuit.email_outbox SET status='processing', attempts=attempts+1,
      locked_until=now()+interval '2 minutes'
      WHERE id=(SELECT id FROM rinkcircuit.email_outbox WHERE status='pending' AND next_attempt_at<=now()
        ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
    if (!row) break;
    const messageId = `<${row.id}@${from.split('@')[1]}>`;
    let outcome;
    try {
      const result = await transport.sendMail({ from: { name: 'RinkCircuit', address: from },
        to: { address: row.recipient }, subject: row.subject, text: row.body,
        messageId, disableFileAccess: true, disableUrlAccess: true });
      outcome = result.accepted?.length ? { status: 'sent', error: null } : { status: 'failed', error: 'SMTP_RECIPIENT_REJECTED' };
    } catch (error) { outcome = failureState(error, row.attempts); }
    // Keep the SMTP send outside a DB transaction. If this write fails, the claim
    // becomes uncertain after its lease expires and is not automatically resent.
    await db.run(`UPDATE rinkcircuit.email_outbox SET status=?, last_error=?, message_id=?, locked_until=NULL,
      sent_at=CASE WHEN ?='sent' THEN ? ELSE sent_at END,
      next_attempt_at=now()+(? * interval '1 second') WHERE id=? AND status='processing'`,
    outcome.status, outcome.error, messageId, outcome.status, new Date().toISOString(),
    Math.min(3600, 60 * 2 ** (row.attempts - 1)), row.id);
    counts.processed++; counts[outcome.status]++;
  }
  return counts;
}

async function verifySmtp() {
  const config = smtpConfig();
  await nodemailer.createTransport(config.options).verify();
  return { connected: true }; // verifies login/TLS, never sends a message
}

if (require.main === module) {
  const action = process.argv.includes('--verify') ? verifySmtp : deliverBatch;
  action().then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error('SMTP operation failed:', error.code || 'CONFIG_OR_DELIVERY_ERROR'); process.exitCode = 1; })
    .finally(closeDb);
}
module.exports = { smtpConfig, failureState, deliverBatch, verifySmtp };
