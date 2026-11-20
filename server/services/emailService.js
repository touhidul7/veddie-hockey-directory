const crypto = require('crypto');
const { getDb } = require('../db/database');
async function sendVerificationEmail(leadId, leadEmail, leadName) {
  const db = getDb();
  return db.transaction(async () => {
    await db.get('SELECT id FROM rinkcircuit.leads WHERE id = ? FOR UPDATE',leadId);
    const now = new Date().toISOString();
    const existing = await db.get(`SELECT token FROM rinkcircuit.email_verifications
      WHERE lead_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,leadId,now);
    if (existing) return { token:existing.token, queued:true };
    const token = crypto.randomBytes(24).toString('hex');
    const verificationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now()+86400000).toISOString();
    await db.run(`INSERT INTO rinkcircuit.email_verifications (id,token,lead_id,expires_at,created_at)
      VALUES (?,?,?,?,?)`,verificationId,token,leadId,expiresAt,now);
    const origin = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
    const verificationUrl = new URL(`/verify-email?token=${token}`,origin).toString();
    const record = { id:crypto.randomUUID(), token, verificationUrl, queued:true };
    await db.run(`INSERT INTO rinkcircuit.email_outbox (id,lead_id,recipient,subject,body,status,created_at,verification_id,expires_at)
      VALUES (?,?,?,?,?,'pending',?,?,?)`,record.id,leadId,leadEmail,'Verify your hockey interest - RinkCircuit',
      `Hello ${leadName},\n\nConfirm your email address: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nRinkCircuit - operated by Plaionn Sports Group`,now,verificationId,expiresAt);
    return record;
  });
}
async function sendReceiptEmail(to,name,subject,message) {
  const id=crypto.randomUUID();
  await getDb().run(`INSERT INTO rinkcircuit.email_outbox (id,recipient,subject,body,status,created_at)
    VALUES (?,?,?,?,'pending',?)`,id,to,subject,`Hello ${name},\n\n${message}\n\nRinkCircuit`,new Date().toISOString());
  return {id,queued:true};
}
async function getOutbox() { return getDb().all('SELECT * FROM rinkcircuit.email_outbox ORDER BY created_at'); }
module.exports = {sendVerificationEmail,sendReceiptEmail,getOutbox};
