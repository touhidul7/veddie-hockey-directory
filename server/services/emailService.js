const crypto = require('crypto');
const {
  getDb
} = require('../db/database');

// In-memory outbox log for transactional emails
const emailOutbox = [];
async function sendVerificationEmail(leadId, leadEmail, leadName) {
  const db = getDb();

  // Check if unexpired unused token already exists
  const existing = await db.get(`
    SELECT token, expires_at FROM rinkcircuit.email_verifications
    WHERE lead_id = ? AND used_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `, leadId, new Date().toISOString());
  let token;
  if (existing) {
    token = existing.token;
  } else {
    token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // 24 hours
    const now = new Date().toISOString();
    await db.run(`
      INSERT INTO rinkcircuit.email_verifications (id, token, lead_id, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, `ver_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, token, leadId, expiresAt, now);
  }
  const verificationUrl = `/verify-email?token=${token}`;
  const emailRecord = {
    id: `email_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    to: leadEmail,
    name: leadName,
    subject: 'Verify your hockey interest — RinkCircuit',
    body: `Hello ${leadName},\n\nThank you for reaching out to RinkCircuit. Please confirm your email address by clicking the link below:\n\n${verificationUrl}\n\nThis single-use link expires in 24 hours.\n\nRinkCircuit - operated by Plaionn Sports Group`,
    token,
    verificationUrl,
    sent_at: new Date().toISOString()
  };
  emailOutbox.push(emailRecord);
  console.log('[EmailService] Verification queued in development outbox; delivery provider not configured.');
  return emailRecord;
}
function sendReceiptEmail(to, name, subject, message) {
  const emailRecord = {
    id: `email_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    to,
    name,
    subject,
    body: `Hello ${name},\n\n${message}\n\nRinkCircuit - operated by Plaionn Sports Group`,
    sent_at: new Date().toISOString()
  };
  emailOutbox.push(emailRecord);
  return emailRecord;
}
function getOutbox() {
  return emailOutbox;
}
module.exports = {
  sendVerificationEmail,
  sendReceiptEmail,
  getOutbox
};
