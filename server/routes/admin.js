const {
  eachSeries
} = require('../db/async');
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  getDb
} = require('../db/database');
const {
  previewAndStageBatch,
  commitStagedBatch
} = require('../services/importService');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

/**
 * POST /api/admin/login
 * Authenticates admin credentials and returns session token
 */
router.post('/login', async (req, res) => {
  const {
    username,
    password
  } = req.body;
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const isValidUser = cleanUser === ADMIN_USER.toLowerCase();
  const isValidPass = !!ADMIN_TOKEN && cleanPass === ADMIN_TOKEN;
  if (!isValidUser || !isValidPass) {
    return res.status(401).json({
      error: 'Invalid username or security key. Access denied.',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Record audit log entry for successful login
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.run(`
      INSERT INTO rinkcircuit.audit_logs (id, actor, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, 'admin_login', 'auth_session', 'session', ?, ?)
    `, `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, cleanUser, JSON.stringify({
      ip: req.ip
    }), now);
  } catch (err) {
    console.error('Failed to log admin login:', err);
  }
  res.json({
    success: true,
    token: ADMIN_TOKEN,
    user: {
      username: 'admin',
      name: 'RinkCircuit Operations Admin',
      role: 'Super Administrator'
    }
  });
});

// Admin Authorization Middleware (Acceptance A12)
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({
      error: 'Unauthorized access. Valid administrator credentials required.',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}
router.use(requireAdmin);

/**
 * GET /api/admin/overview
 * Freshness metrics, lead verification reconciliation, pending queues (Acceptance A20)
 */
router.get('/overview', async (req, res) => {
  const db = getDb();

  // Freshness check: records with last_checked_at older than 90 days or NULL
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const staleLeagues = await db.all(`
    SELECT id, name, slug, municipality, verification_status, last_checked_at
    FROM rinkcircuit.league_programmes
    WHERE publication_status = 'published' AND (last_checked_at IS NULL OR last_checked_at < ?)
    ORDER BY last_checked_at ASC
  `, ninetyDaysAgo); // Demand reconciliation: Unique verified leads vs total submissions (Acceptance A20)
  const totalLeads = (await db.get("SELECT count(*) as c FROM rinkcircuit.leads")).c;
  const verifiedLeads = (await db.get("SELECT count(*) as c FROM rinkcircuit.leads WHERE verification_status = 'verified'")).c;
  const tentativeLeads = totalLeads - verifiedLeads;
  // Demand by city
  const demandByCity = await db.all(`
    SELECT city, count(*) as count
    FROM rinkcircuit.interests
    GROUP BY city
    ORDER BY count DESC
  `); // Demand by interest type
  const demandByType = await db.all(`
    SELECT interest_type, count(*) as count
    FROM rinkcircuit.interests
    GROUP BY interest_type
  `); // Pending queues
  const pendingRequests = (await db.get("SELECT count(*) as c FROM rinkcircuit.listing_requests WHERE status = 'pending'")).c;
  const pendingTeamInterests = (await db.get("SELECT count(*) as c FROM rinkcircuit.interests WHERE interest_type = 'captain_team'")).c;
  res.json({
    counts: {
      totalLeagues: (await db.get("SELECT count(*) as c FROM rinkcircuit.league_programmes WHERE publication_status = 'published'")).c,
      draftLeagues: (await db.get("SELECT count(*) as c FROM rinkcircuit.league_programmes WHERE publication_status = 'draft'")).c,
      staleLeaguesCount: staleLeagues.length,
      pendingRequests,
      pendingTeamInterests,
      totalLeads,
      verifiedLeads,
      tentativeLeads
    },
    staleLeagues,
    demandByCity,
    demandByType
  });
});

/**
 * GET /api/admin/requests
 * Listing requests queue
 */
router.get('/requests', async (req, res) => {
  const db = getDb();
  const requests = await db.all(`
    SELECT
      r.id, r.request_type, r.programme_id, r.suggested_name, r.requester_name,
      r.requester_email, r.requester_role, r.evidence_url, r.message, r.status,
      r.decision_date, r.admin_notes, r.created_at,
      p.name as current_programme_name, p.slug as current_programme_slug
    FROM rinkcircuit.listing_requests r
    LEFT JOIN rinkcircuit.league_programmes p ON r.programme_id = p.id
    ORDER BY r.created_at DESC
  `);
  res.json({
    data: requests
  });
}); /**
    * POST /api/admin/requests/:id/decision
    * Decide on a listing request (Acceptance A13)
    */
router.post('/requests/:id/decision', async (req, res) => {
  const db = getDb();
  const {
    id
  } = req.params;
  const {
    decision,
    admin_notes,
    actor = 'admin'
  } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({
      error: "Decision must be 'approved' or 'rejected'."
    });
  }
  const request = await db.get("SELECT * FROM rinkcircuit.listing_requests WHERE id = ?", id);
  if (!request) {
    return res.status(404).json({
      error: 'Request not found.'
    });
  }
  const now = new Date().toISOString();
  await db.transaction(async () => {
    await db.run(`
      UPDATE rinkcircuit.listing_requests
      SET status = ?, admin_notes = ?, decision_date = ?
      WHERE id = ?
    `, decision, admin_notes || '', now, id); // If claim approved, mark programme claimed
    if (decision === 'approved' && request.request_type === 'claim' && request.programme_id) {
      await db.run(`
        UPDATE rinkcircuit.league_programmes
        SET claimed_status = 'claimed', verification_status = 'operator_confirmed', updated_at = ?
        WHERE id = ?
      `, now, request.programme_id);
    }
    await db.run(`
      INSERT INTO rinkcircuit.audit_logs (id, actor, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, 'listing_request', ?, ?, ?)
    `, `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, actor, `request_${decision}`, id, JSON.stringify({
      decision,
      admin_notes,
      request_type: request.request_type
    }), now);
  });
  res.json({
    success: true,
    message: `Request successfully ${decision}.`
  });
});

/**
 * GET /api/admin/teams/pending
 * Captain team submissions awaiting review
 */
router.get('/teams/pending', async (req, res) => {
  const db = getDb();
  const pending = await db.all(`
    SELECT
      i.id, i.team_name, i.city, i.division, i.roster_size_estimate,
      i.home_league_or_independent, i.additional_notes, i.created_at,
      l.id as lead_id, l.name as captain_name, l.email as captain_email,
      l.verification_status
    FROM rinkcircuit.interests i
    JOIN rinkcircuit.leads l ON i.lead_id = l.id
    WHERE i.interest_type = 'captain_team'
    ORDER BY i.created_at DESC
  `);
  res.json({
    data: pending
  });
}); /**
    * POST /api/admin/teams/:id/decision
    * Approve captain submission into public team profile (Acceptance A15)
    */
router.post('/teams/:id/decision', async (req, res) => {
  const db = getDb();
  const {
    id
  } = req.params;
  const {
    decision,
    approved_name,
    approved_city,
    approved_division,
    home_league_name,
    actor = 'admin'
  } = req.body;
  const interest = await db.get("SELECT * FROM rinkcircuit.interests WHERE id = ?", id);
  if (!interest) {
    return res.status(404).json({
      error: 'Interest submission not found.'
    });
  }
  const now = new Date().toISOString();
  if (decision === 'approved') {
    const teamName = approved_name || interest.team_name;
    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const teamId = `team_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // Acceptance A15: Public profile contains ONLY approved public fields. Captain email/phone are NOT stored on public team profile.
    await db.run(`
      INSERT INTO rinkcircuit.teams (id, name, slug, city, division_label, home_league_name, publication_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?)
    `, teamId, teamName, slug, approved_city || interest.city, approved_division || interest.division || 'Recreational', home_league_name || interest.home_league_or_independent || 'Independent', now, now);

    // Link team_id on interest
    await db.run("UPDATE rinkcircuit.interests SET team_id = ? WHERE id = ?", teamId, id);
    await db.run(`
      INSERT INTO rinkcircuit.audit_logs (id, actor, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, 'approve_team_profile', 'team', ?, ?, ?)
    `, `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, actor, teamId, JSON.stringify({
      interest_id: id,
      team_name: teamName
    }), now);
    return res.json({
      success: true,
      team_id: teamId,
      slug,
      message: 'Team profile published successfully.'
    });
  }
  res.json({
    success: true,
    message: 'Team submission rejected.'
  });
});

/**
 * POST /api/admin/imports/preview
 * Staged import preview (Acceptance A05)
 */
router.post('/imports/preview', async (req, res) => {
  const {
    filename = 'upload.csv',
    sourceName = 'Manual Upload',
    rows
  } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({
      error: 'No data rows provided for import.'
    });
  }
  try {
    const preview = await previewAndStageBatch(filename, sourceName, rows);
    res.json(preview);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/**
 * POST /api/admin/imports/:id/commit
 * Commit staged rows (Acceptance A06, A07)
 */
router.post('/imports/:id/commit', async (req, res) => {
  const {
    id
  } = req.params;
  const {
    approvedRowIds,
    actor = 'admin'
  } = req.body;
  if (!approvedRowIds || !Array.isArray(approvedRowIds)) {
    return res.status(400).json({
      error: 'Approved row IDs array is required.'
    });
  }
  try {
    const result = await commitStagedBatch(id, approvedRowIds, actor);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/**
 * PATCH /api/admin/leagues/:id
 * Optimistic concurrency control and slug redirect tracking (Acceptance A18, A21)
 */
router.patch('/leagues/:id', async (req, res) => {
  const db = getDb();
  const {
    id
  } = req.params;
  const {
    version,
    name,
    slug: newSlug,
    municipality,
    area,
    category,
    description,
    publication_status,
    verification_status,
    owner_disclosure,
    last_checked_at,
    actor = 'admin'
  } = req.body;
  const current = await db.get("SELECT * FROM rinkcircuit.league_programmes WHERE id = ?", id);
  if (!current) {
    return res.status(404).json({
      error: 'League not found.'
    });
  }

  // Acceptance A21: Optimistic concurrency check
  if (version !== undefined && Number(version) !== current.version) {
    return res.status(409).json({
      error: 'Conflict: This record was modified concurrently by another user or process.',
      code: 'STALE_WRITE_CONFLICT',
      currentRecord: current
    });
  }
  const now = new Date().toISOString();
  await db.transaction(async () => {
    // Acceptance A18: If slug changed, insert redirect
    if (newSlug && newSlug !== current.slug) {
      await db.run(`
        INSERT INTO rinkcircuit.slug_redirects (old_slug, new_slug, entity_type, created_at)
        VALUES (?, ?, 'league_programme', ?)
        ON CONFLICT (old_slug) DO UPDATE SET new_slug = EXCLUDED.new_slug, created_at = EXCLUDED.created_at
      `, current.slug, newSlug, now);
    }
    await db.run(`
      UPDATE rinkcircuit.league_programmes
      SET name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          municipality = COALESCE(?, municipality),
          area = COALESCE(?, area),
          category = COALESCE(?, category),
          description = COALESCE(?, description),
          publication_status = COALESCE(?, publication_status),
          verification_status = COALESCE(?, verification_status),
          owner_disclosure = COALESCE(?, owner_disclosure),
          last_checked_at = COALESCE(?, last_checked_at),
          version = version + 1,
          updated_at = ?
      WHERE id = ?
    `, name, newSlug, municipality, area, category, description, publication_status, verification_status, owner_disclosure, last_checked_at, now, id);
    await db.run(`
      INSERT INTO rinkcircuit.audit_logs (id, actor, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, 'update_league', 'league_programme', ?, ?, ?)
    `, `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, actor, id, JSON.stringify({
      before: {
        name: current.name,
        slug: current.slug,
        status: current.publication_status
      },
      after: req.body
    }), now);
  });
  const updated = await db.get("SELECT * FROM rinkcircuit.league_programmes WHERE id = ?", id);
  res.json({
    success: true,
    data: updated
  });
});

/**
 * GET /api/admin/audit
 * Audit logs
 */
router.get('/audit', async (req, res) => {
  const db = getDb();
  const logs = await db.all("SELECT * FROM rinkcircuit.audit_logs ORDER BY created_at DESC LIMIT 100");
  res.json({
    data: logs
  });
});

/**
 * GET /api/admin/backup
 * Backup drill export (Acceptance A19)
 */
router.get('/backup', async (req, res) => {
  const { exportBackup } = require('../db/backup');
  res.json(await exportBackup());
});

router.post('/restore', async (req, res) => {
  const { restoreBackup } = require('../db/backup');
  await restoreBackup(req.body.data);
  res.json({ success: true, message: 'All application records and relationships restored.' });
});

module.exports = router;
