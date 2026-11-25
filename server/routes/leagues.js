const express = require('express');
const router = express.Router();
const {
  getDb
} = require('../db/database');

/**
 * GET /api/leagues
 * Public search & filtering with strict public projection
 */
router.get('/', async (req, res) => {
  const db = getDb();
  if (Object.values(req.query).some(value => typeof value !== 'string' || value.length > 500)) return res.status(400).json({ error: 'Invalid search parameters.' });
  const {
    q,
    city,
    category,
    season,
    age,
    night,
    level,
    reg,
    sport,
    sort = 'relevance',
    limit = 50,
    offset = 0
  } = req.query;

  // Acceptance A04: Only PUBLISHED records are returned publicly.
  let whereClauses = ["p.publication_status = 'published'"];
  let params = [];

  // Text search (name, aliases, area, municipality)
  if (q && q.trim()) {
    const term = `%${q.trim().toLowerCase()}%`;
    whereClauses.push(`(
      lower(p.name) LIKE ? OR
      lower(COALESCE(o.aliases, '')) LIKE ? OR
      lower(p.area) LIKE ? OR
      lower(p.municipality) LIKE ? OR
      lower(COALESCE(p.description, '')) LIKE ? OR
      EXISTS (
        SELECT 1 FROM rinkcircuit.season_offerings so
        JOIN rinkcircuit.offering_arenas oa ON so.id = oa.offering_id
        JOIN rinkcircuit.arenas a ON oa.arena_id = a.id
        WHERE so.programme_id = p.id AND lower(a.name) LIKE ?
      )
    )`);
    params.push(term, term, term, term, term, term);
  }

  // Municipality filter (OR logic for multiple selections, e.g. "Toronto,Vaughan")
  if (city && city.trim()) {
    const cities = city.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    if (cities.length > 0) {
      const cityPlaceholders = cities.map(() => 'lower(p.municipality) = ?').join(' OR ');
      whereClauses.push(`(${cityPlaceholders})`);
      params.push(...cities);
    }
  }

  // Category filter
  if (category && category.trim()) {
    whereClauses.push('lower(p.category) LIKE ?');
    params.push(`%${category.trim().toLowerCase()}%`);
  }

  // Sport type filter (Ice hockey default vs Ball hockey)
  if (sport && sport.trim() !== 'all') {
    if (!['ice_hockey', 'ball_hockey'].includes(sport.trim().toLowerCase())) return res.status(400).json({ error: 'Choose a valid sport type.' });
    whereClauses.push('p.sport_type = ?');
    params.push(sport.trim().toLowerCase());
  }

  // All offering filters must match the SAME season offering.
  const offeringFilters = [];
  for (const [value, column] of [[season, 'season_label'], [age, 'age_eligibility'], [level, 'skill_labels'], [reg, 'registration_modes']]) {
    if (value?.trim()) { offeringFilters.push(`lower(so.${column}) LIKE ?`); params.push(`%${value.trim().toLowerCase()}%`); }
  }
  if (night?.trim()) {
    if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(night.toLowerCase())) return res.status(400).json({ error: 'Choose a valid night.' });
    offeringFilters.push('lower(so.nights) LIKE ?'); params.push(`%"${night.toLowerCase()}"%`);
  }
  if (offeringFilters.length) whereClauses.push(`EXISTS (SELECT 1 FROM rinkcircuit.season_offerings so WHERE so.programme_id=p.id AND ${offeringFilters.join(' AND ')})`);

  // Sorting
  const countParams = [...params];
  let orderBy = 'p.name ASC';
  if (sort === 'name') {
    orderBy = 'p.name ASC';
  } else if (sort === 'city') {
    orderBy = 'p.municipality ASC, p.name ASC';
  } else if (sort === 'relevance' && q) {
    orderBy = 'p.is_sponsored DESC, (CASE WHEN lower(p.name) LIKE ? THEN 1 ELSE 2 END), p.name ASC';
    params.push(`%${q.trim().toLowerCase()}%`);
  }
  const query = `
    SELECT
      p.id, p.name, p.slug, p.area, p.municipality, p.category, p.sport_type,
      p.description, p.verification_status, p.owner_disclosure, p.is_sponsored,
      p.last_checked_at,
      o.name as organisation_name, o.operator_type, o.is_plaionn_owned,
      (SELECT url FROM rinkcircuit.source_evidence WHERE programme_id = p.id ORDER BY created_at ASC LIMIT 1) as website_url
    FROM rinkcircuit.league_programmes p
    LEFT JOIN rinkcircuit.organisations o ON p.organisation_id = o.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const pageLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const pageOffset = Math.max(0, Number.parseInt(offset, 10) || 0);
  const finalParams = [...params, pageLimit, pageOffset];
  const leagues = await db.all(query, ...finalParams);

  // Fetch offerings and arenas in two bounded queries, not per result.
  const offeringsByProgramme = await require('../services/publicOfferings').forProgrammes(leagues.map(l => l.id));
  const enrichedLeagues = leagues.map(league => ({ ...league, offerings: offeringsByProgramme.get(league.id) || [] }));

  // Count total matches
  const countQuery = `
    SELECT count(DISTINCT p.id) as total
    FROM rinkcircuit.league_programmes p
    LEFT JOIN rinkcircuit.organisations o ON p.organisation_id = o.id
    WHERE ${whereClauses.join(' AND ')}
  `;

  const total = (await db.get(countQuery, ...countParams))?.total || 0;
  res.json({
    data: enrichedLeagues,
    pagination: {
      total,
      limit: pageLimit,
      offset: pageOffset
    }
  });
});

/**
 * GET /api/leagues/:slug
 * League profile detail, with slug redirect support (Acceptance A18)
 */
router.get('/:slug', async (req, res) => {
  const db = getDb();
  const {
    slug
  } = req.params;

  // 1. Check if slug exists directly in published league_programmes
  let programme = await db.get(`
    SELECT
      p.id, p.name, p.slug, p.area, p.municipality, p.category, p.sport_type,
      p.description, p.publication_status, p.verification_status, p.claimed_status,
      p.owner_disclosure, p.is_sponsored, p.last_checked_at, p.created_at, p.updated_at,
      o.name as organisation_name, o.official_domain, o.operator_type, o.is_plaionn_owned
    FROM rinkcircuit.league_programmes p
    LEFT JOIN rinkcircuit.organisations o ON p.organisation_id = o.id
    WHERE p.slug = ? AND p.publication_status = 'published'
  `, slug); // 2. If not found, check slug_redirects (Acceptance A18: "Old slug redirects")
  if (!programme) {
    const resolved = await require('../services/slugResolver').resolveLeagueSlug(slug);
    const redirect = resolved && resolved.slug !== slug ? { new_slug: resolved.slug } : null;
    if (redirect) {
      return res.status(301).json({
        redirect: true,
        new_slug: redirect.new_slug,
        location: `/leagues/${redirect.new_slug}`
      });
    }
    return res.status(404).json({
      error: 'League not found or listing not published'
    });
  }

  const offerings = (await require('../services/publicOfferings').forProgrammes([programme.id])).get(programme.id) || [];
  // Fetch source evidence citations (Acceptance A03)
  const evidence = await db.all(`
    SELECT id, url, source_type, retrieved_at, checked_at, evidence_summary
    FROM rinkcircuit.source_evidence
    WHERE programme_id = ?
  `, programme.id); // Fetch related local leagues in the same municipality
  const related = await db.all(`
    SELECT id, name, slug, municipality, category
    FROM rinkcircuit.league_programmes
    WHERE municipality = ? AND id != ? AND publication_status = 'published'
    LIMIT 3
  `, programme.municipality, programme.id);
  res.json({
    data: {
      ...programme,
      offerings,
      evidence: evidence.map(item => ({ ...item, url: require('../services/publicOfferings').safeUrl(item.url) })),
      related
    }
  });
});
module.exports = router;
