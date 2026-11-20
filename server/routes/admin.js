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
const { login, requireAdmin, logout, user } = require('../middleware/adminSession');
router.post('/login', login);
router.use(requireAdmin);
router.get('/session', (req,res)=>res.json({user:user(req.admin.username),csrfToken:req.admin.csrfToken}));
router.post('/logout', logout);

router.get('/imports', async (req, res) => {
  res.json({ data: await getDb().all(`SELECT id, filename, total_rows, approved_rows, status, created_at
    FROM rinkcircuit.import_batches ORDER BY created_at DESC LIMIT 50`) });
});

router.get('/imports/:id', async (req,res)=>res.json(await require('../services/importService').getBatchReview(req.params.id)));

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
  const verifiedLeads = (await db.get("SELECT count(*) as c FROM rinkcircuit.leads l WHERE verification_status = 'verified' AND EXISTS (SELECT 1 FROM rinkcircuit.interests i WHERE i.lead_id=l.id AND i.moderation_status!='rejected')")).c;
  const tentativeLeads = (await db.get("SELECT count(*) AS c FROM rinkcircuit.leads WHERE verification_status!='verified'")).c;
  const excludedVerifiedLeads=totalLeads-verifiedLeads-tentativeLeads;
  const analytics=await db.all('SELECT event_name,sum(count)::bigint AS count FROM rinkcircuit.analytics_daily GROUP BY event_name');
  const rawSubmissions=Number(analytics.find(row=>row.event_name==='interest_submitted')?.count||0);
  // Demand by city
  const demandByCity = await db.all(`
    SELECT i.city, count(DISTINCT i.lead_id) as count
    FROM rinkcircuit.interests i JOIN rinkcircuit.leads l ON l.id=i.lead_id
    WHERE l.verification_status='verified' AND i.moderation_status!='rejected'
    GROUP BY i.city
    ORDER BY count DESC
  `); // Demand by interest type
  const demandByType = await db.all(`
    SELECT i.interest_type, count(DISTINCT i.lead_id) as count
    FROM rinkcircuit.interests i JOIN rinkcircuit.leads l ON l.id=i.lead_id
    WHERE l.verification_status='verified' AND i.moderation_status!='rejected'
    GROUP BY i.interest_type
  `); // Pending queues
  const demandByNight=await db.all(`SELECT trim(n.night) AS night,count(DISTINCT i.lead_id) AS count
    FROM rinkcircuit.interests i JOIN rinkcircuit.leads l ON l.id=i.lead_id
    CROSS JOIN LATERAL unnest(string_to_array(i.preferred_nights,',')) AS n(night)
    WHERE l.verification_status='verified' AND i.moderation_status!='rejected'
      AND trim(n.night) IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') GROUP BY trim(n.night)`);
  const demandByEvent=await db.all(`SELECT i.event_id,count(DISTINCT i.lead_id) AS verified_leads,count(DISTINCT i.team_id) AS approved_teams
    FROM rinkcircuit.interests i JOIN rinkcircuit.leads l ON l.id=i.lead_id WHERE l.verification_status='verified' AND i.moderation_status!='rejected' AND i.event_id IS NOT NULL GROUP BY i.event_id`);
  const sourceCoverage=await db.get(`SELECT count(*) AS published,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM rinkcircuit.source_evidence e WHERE e.programme_id=p.id)) AS with_evidence
    FROM rinkcircuit.league_programmes p WHERE p.publication_status='published'`);
  const pendingRequests = (await db.get("SELECT count(*) as c FROM rinkcircuit.listing_requests WHERE status = 'pending'")).c;
  const pendingTeamInterests = (await db.get("SELECT count(*) as c FROM rinkcircuit.interests WHERE interest_type = 'captain_team' AND moderation_status = 'pending'")).c;
  res.json({
    counts: {
      totalLeagues: (await db.get("SELECT count(*) as c FROM rinkcircuit.league_programmes WHERE publication_status = 'published'")).c,
      draftLeagues: (await db.get("SELECT count(*) as c FROM rinkcircuit.league_programmes WHERE publication_status = 'draft'")).c,
      staleLeaguesCount: staleLeagues.length,
      pendingRequests,
      pendingTeamInterests,
      rawSubmissions,
      totalLeads,
      verifiedLeads,
      tentativeLeads,excludedVerifiedLeads
    },
    staleLeagues,
    analytics,
    analyticsDefinitions:{rawSubmissions:'Accepted interest requests, including successful retries, since metrics were enabled; not historical totals.',verifiedDemand:'Distinct verified leads with non-rejected interests per group; groups must not be summed as a global total.',referrals:'Consented outbound clicks; not registrations or paid entries.',approvedTeams:'Distinct linked approved team IDs per event; unlinked team-name submissions are not counted as verified teams.'},
    sourceCoverage,demandByNight,demandByEvent,
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
router.post('/requests/:id/decision', async (req,res)=>res.json(await require('../services/moderationService').decideRequest(req.params.id,req.body,req.admin.username)));

/**
 * GET /api/admin/teams/pending
 * Captain team submissions awaiting review
 */
router.get('/teams/pending', async (req, res) => {
  const db = getDb();
  const pending = await db.all(`
    SELECT
      i.id, i.team_name, i.city, i.division, i.roster_size_estimate,
      i.home_league_or_independent, i.additional_notes, i.created_at, i.publication_consent,
      l.id as lead_id, l.name as captain_name, l.email as captain_email,
      l.verification_status
    FROM rinkcircuit.interests i
    JOIN rinkcircuit.leads l ON i.lead_id = l.id
    WHERE i.interest_type = 'captain_team' AND i.moderation_status = 'pending'
    ORDER BY i.created_at DESC
  `);
  res.json({
    data: pending
  });
}); /**
    * POST /api/admin/teams/:id/decision
    * Approve captain submission into public team profile (Acceptance A15)
    */
router.post('/teams/:id/decision', async (req,res)=>res.json(await require('../services/moderationService').decideTeam(req.params.id,req.body,req.admin.username)));

/**
 * POST /api/admin/imports/preview
 * Staged import preview (Acceptance A05)
 */
router.post('/imports/preview', async (req, res) => {
  const {
    filename = 'upload.csv',
    sourceName = 'Manual Upload',
    rows: providedRows, csv
  } = req.body;
  let rows = providedRows;
  if (csv !== undefined) rows = require('../services/importCsv').parseImportCsv(csv);
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    return res.status(400).json({
      error: 'No data rows provided for import.'
    });
  }
  try {
    const preview = await previewAndStageBatch(filename, sourceName, rows);
    res.json(preview);
  } catch (err) {
    res.status(400).json({
      error: "Import could not be processed. Check the selected rows and source data."
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
    const versions = req.body.rowVersions;
    if (!versions || approvedRowIds.some(rowId => !Number.isInteger(versions[rowId]))) return res.status(400).json({error:'Reload the preview before committing selected rows.'});
    const result = await commitStagedBatch(id, approvedRowIds, actor, versions);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      error: 'Import could not be committed. Existing data was preserved.'
    });
  }
});

router.post('/imports/:id/rows/:rowId/review', async (req,res) => {
  res.json(await require('../services/importService').reviewImportRow(req.params.id,req.params.rowId,req.body,req.admin.username));
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
  if(publication_status!==undefined&&!['draft','review','published','archived'].includes(publication_status))return res.status(400).json({error:'Invalid publication status.'});
  if(verification_status!==undefined&&!['unverified','research_checked','operator_confirmed','needs_review'].includes(verification_status))return res.status(400).json({error:'Invalid verification status.'});
  if(newSlug!==undefined&&(typeof newSlug!=='string'||newSlug.length>160||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)))return res.status(400).json({error:'Use a lowercase, hyphen-separated slug.'});
  for(const value of [name,municipality,area,category,description,owner_disclosure])if(value!==undefined&&(typeof value!=='string'||value.length>5000))return res.status(400).json({error:'Invalid editorial text.'});
  const current = await db.get("SELECT * FROM rinkcircuit.league_programmes WHERE id = ?", id);
  if (!current) {
    return res.status(404).json({
      error: 'League not found.'
    });
  }

  // Acceptance A21: Optimistic concurrency check
  if (!Number.isInteger(Number(version)) || Number(version) !== current.version) {
    return res.status(409).json({
      error: 'Conflict: This record was modified concurrently by another user or process.',
      code: 'STALE_WRITE_CONFLICT',
      currentRecord: current
    });
  }
  const now = new Date().toISOString();
  await db.transaction(async () => {
    if(newSlug&&newSlug!==current.slug){
      const reserved=await db.get('SELECT old_slug FROM rinkcircuit.slug_redirects WHERE old_slug=?',newSlug);
      const occupied=await db.get('SELECT id FROM rinkcircuit.league_programmes WHERE slug=? AND id!=?',newSlug,id);
      if(reserved||occupied){const error=new Error('Slug is already in use or reserved by redirect history.');error.status=409;throw error;}
      await db.run("UPDATE rinkcircuit.slug_redirects SET new_slug=? WHERE new_slug=? AND entity_type='league_programme'",newSlug,current.slug);
    }
    // Acceptance A18: If slug changed, insert redirect
    if (newSlug && newSlug !== current.slug) {
      await db.run(`
        INSERT INTO rinkcircuit.slug_redirects (old_slug, new_slug, entity_type, created_at)
        VALUES (?, ?, 'league_programme', ?)
        ON CONFLICT (old_slug) DO UPDATE SET new_slug = EXCLUDED.new_slug, created_at = EXCLUDED.created_at
      `, current.slug, newSlug, now);
    }
    const update = await db.run(`
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
      WHERE id = ? AND version = ?
    `, name, newSlug, municipality, area, category, description, publication_status, verification_status, owner_disclosure, last_checked_at, now, id, Number(version));
    if (!update.changes) { const error = new Error("This record was modified concurrently."); error.status = 409; throw error; }
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
  const backup=await exportBackup();
  await getDb().run("INSERT INTO rinkcircuit.audit_logs(id,actor,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,'backup_export','database','rinkcircuit','{}',?)",crypto.randomUUID(),req.admin.username,new Date().toISOString());
  res.set('Cache-Control','no-store').json(backup);
});

router.post('/restore', async (req, res) => {
  const { restoreBackup } = require('../db/backup');
  await restoreBackup(req.body.data);
  await getDb().run('DELETE FROM rinkcircuit.admin_sessions');
  res.json({ success: true, message: 'All application records and relationships restored.' });
});

module.exports = router;
