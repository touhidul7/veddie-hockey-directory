const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  getDb
} = require('../db/database');
const {
  sendVerificationEmail
} = require('../services/emailService');
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * POST /api/interests
 * Handles Captain interest, Champions League interest, Tournament interest, and Request a League demand
 */
router.post('/', async (req, res) => {
  const db = getDb();
  const {
    interest_type,
    name,
    email,
    phone,
    role = 'player',
    city,
    team_name,
    home_league,
    division,
    roster_size_estimate,
    event_id,
    preferred_nights,
    skill_description,
    registration_mode,
    marketing_consent = false,
    additional_notes
  } = req.body;

  // Basic validation
  if (!email || !normalizeEmail(email)) {
    return res.status(400).json({
      error: 'A valid email address is required.'
    });
  }
  if (!interest_type) {
    return res.status(400).json({
      error: 'Interest type is required.'
    });
  }
  const cleanEmail = normalizeEmail(email);
  const cleanName = (name || '').trim() || cleanEmail.split('@')[0];
  const cleanCity = (city || '').trim() || 'Greater Toronto Area';

  // Validation rules per form type
  if (interest_type === 'captain_team' && !team_name) {
    return res.status(400).json({
      error: 'Team name is required for team registration.'
    });
  }

  // Acceptance A08: Idempotency & Deduplication
  // Dedupe key based on normalized email, interest type, and specific target (team/event/city)
  const targetKey = (event_id || team_name || cleanCity).toLowerCase().replace(/[^a-z0-9]/g, '');
  const dedupeKey = `dedupe_${cleanEmail}_${interest_type}_${targetKey}`;
  const existingInterest = await db.get("SELECT id, lead_id, created_at FROM rinkcircuit.interests WHERE dedupe_key = ?", dedupeKey);
  if (existingInterest) {
    // Return existing receipt without resending verification email or creating duplicate leads
    return res.status(200).json({
      success: true,
      deduplicated: true,
      submission_id: existingInterest.id,
      message: 'Your interest record has already been received. Please check your inbox for verification.',
      verification_required: true
    });
  }
  const now = new Date().toISOString();

  // Find or create lead
  let lead = await db.get("SELECT id, verification_status FROM rinkcircuit.leads WHERE lower(email) = ?", cleanEmail);
  if (!lead) {
    const leadId = `lead_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await db.run(`
      INSERT INTO rinkcircuit.leads (id, name, email, phone, role, city, verification_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, leadId, cleanName, cleanEmail, phone || '', role, cleanCity, now, now);
    lead = {
      id: leadId,
      verification_status: 'pending'
    };
  }
  // Record CASL Consents (Acceptance A10: Decoupled service vs marketing consent)
  const consentStmt = `
    INSERT INTO rinkcircuit.consents (id, lead_id, purpose, consent_text, granted, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  await db.run(consentStmt, `con_${Date.now()}_srv_${crypto.randomBytes(3).toString('hex')}`, lead.id, 'service_communication', 'Consent to receive transactional emails and service notifications regarding this inquiry.', 1, now);
  await db.run(consentStmt, `con_${Date.now()}_mkt_${crypto.randomBytes(3).toString('hex')}`, lead.id, 'marketing', 'Optional consent to receive hockey newsletters and tournament announcements from RinkCircuit, operated by Plaionn Sports Group.', marketing_consent ? 1 : 0, now);

  // Insert Interest
  const interestId = `int_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await db.run(`
    INSERT INTO rinkcircuit.interests (
      id, lead_id, interest_type, team_name, city, preferred_nights,
      skill_description, registration_mode, division, roster_size_estimate,
      home_league_or_independent, event_id, additional_notes, dedupe_key, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, interestId, lead.id, interest_type, team_name || null, cleanCity, Array.isArray(preferred_nights) ? preferred_nights.join(', ') : preferred_nights || null, skill_description || null, registration_mode || 'team', division || null, roster_size_estimate ? parseInt(roster_size_estimate, 10) : null, home_league || null, event_id || null, additional_notes || null, dedupeKey, now);

  // Send single-use verification email if lead is not already verified
  let emailRecord = null;
  if (lead.verification_status !== 'verified') {
    emailRecord = await sendVerificationEmail(lead.id, cleanEmail, cleanName);
  }
  res.status(201).json({
    success: true,
    submission_id: interestId,
    lead_id: lead.id,
    verification_required: lead.verification_status !== 'verified',
    message: lead.verification_status === 'verified' ? 'Thank you! Your verified interest has been recorded.' : 'Thank you! Please check your email to verify your address and confirm your interest.'
  });
});
module.exports = router;
