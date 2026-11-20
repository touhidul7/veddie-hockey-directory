const express = require('express');
const router = express.Router();
const { validateSubmission } = require('../middleware/validateSubmission');
const {
  getDb
} = require('../db/database');
const {
  sendVerificationEmail
} = require('../services/emailService');

/**
 * POST /api/email-verifications
 * Single-use token verification (Acceptance A09)
 */
router.post('/', validateSubmission('verification'), async (req, res) => {
  const db = getDb();
  const {
    token
  } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: 'A valid verification token is required.'
    });
  }
  const response = await db.transaction(async () => {
    const record = await db.get(`
    SELECT v.id, v.token, v.lead_id, v.expires_at, v.used_at, l.email, l.name
    FROM rinkcircuit.email_verifications v
    JOIN rinkcircuit.leads l ON v.lead_id = l.id
    WHERE v.token = ? FOR UPDATE OF v
  `, token.trim());
    if (!record) {
      return {
        status: 404,
        body: {
          error: 'Invalid verification token.',
          code: 'TOKEN_NOT_FOUND',
          message: 'This verification link is invalid or does not exist.'
        }
      };
    }
    const now = new Date().toISOString();

    // Acceptance A09: Check if reused
    if (record.used_at) {
      return {
        status: 400,
        body: {
          error: 'Verification link already used.',
          code: 'TOKEN_ALREADY_USED',
          message: 'This email verification link has already been used. Your email address is confirmed.'
        }
      };
    }

    // Acceptance A09: Check if expired
    if (record.expires_at < now) {
      return {
        status: 400,
        body: {
          error: 'Verification link expired.',
          code: 'TOKEN_EXPIRED',
          message: 'This verification link has expired. Please request a new verification link below.'
        }
      };
    }

    await require('../services/analytics').record('email_verified');
    // Atomically mark token used and lead verified
    await db.transaction(async () => {
      await db.run("UPDATE rinkcircuit.email_verifications SET used_at = ? WHERE id = ?", now, record.id);
      await db.run("UPDATE rinkcircuit.leads SET verification_status = 'verified', updated_at = ? WHERE id = ?", now, record.lead_id);
    });
    return {
      status: 200,
      body: {
        success: true,
        message: 'Your email address has been successfully verified! Your hockey interest is now confirmed.',
        email: record.email
      }
    };
  });
  res.status(response.status).json(response.body);
});

/**
 * POST /api/email-verifications/resend
 * Resend verification link safely
 */
router.post('/resend', validateSubmission('resend'), async (req, res) => {
  const email = req.body.email;
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({
    error: 'Email is required.'
  });
  const lead = await getDb().get('SELECT id,name,email,verification_status FROM rinkcircuit.leads WHERE lower(email) = ?', email.trim().toLowerCase());
  if (lead && lead.verification_status !== 'verified') await sendVerificationEmail(lead.id, lead.email, lead.name);
  res.json({
    success: true,
    message: 'If this address needs verification, a verification email is queued for delivery.'
  });
});
module.exports = router;
