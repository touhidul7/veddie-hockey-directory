const express = require('express');
const router = express.Router();
const {
  getDb
} = require('../db/database');

/**
 * GET /api/events
 * Published events and tournaments
 */
router.get('/', async (req, res) => {
  const db = getDb();
  const {
    type,
    state
  } = req.query;
  if(Object.values(req.query).some(value=>typeof value!=='string'||value.length>200))return res.status(400).json({error:'Invalid event filters.'});
  let whereClauses = ["lifecycle_state IN ('interest-only','announced','registration-open','registration-closed','completed','cancelled')"];
  let params = [];
  if (type) {
    whereClauses.push('event_type = ?');
    params.push(type);
  }
  if (state) {
    whereClauses.push('lifecycle_state = ?');
    params.push(state);
  }
  const events = await db.all(`
    SELECT
      id, title, slug, event_type, lifecycle_state, start_date, end_date, timezone,
      location_name, city, divisions, price_amount, price_currency, price_unit,
      guaranteed_games, registration_deadline, format, policy_url, registration_url,
      description
    FROM rinkcircuit.events
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY start_date ASC
  `, ...params);
  res.json({
    data: events
  });
}); /**
    * GET /api/events/:slug
    * Event detail view (Acceptance A14: honest interest-only vs open registration)
    */
router.get('/:slug', async (req, res) => {
  const db = getDb();
  const {
    slug
  } = req.params;
  const event = await db.get(`
    SELECT
      id, title, slug, event_type, lifecycle_state, start_date, end_date, timezone,
      location_name, city, divisions, price_amount, price_currency, price_unit,
      guaranteed_games, registration_deadline, format, policy_url, registration_url,
      description
    FROM rinkcircuit.events
    WHERE slug = ? AND lifecycle_state IN ('interest-only','announced','registration-open','registration-closed','completed','cancelled')
  `, slug);
  if (!event) {
    return res.status(404).json({
      error: 'Event not found'
    });
  }
  res.json({
    data: event
  });
});
module.exports = router;
