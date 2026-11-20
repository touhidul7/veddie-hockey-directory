const express = require('express');
const crypto = require('node:crypto');
const { deliverBatch } = require('../services/smtpDelivery');
const router = express.Router();
router.get('/', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || '';
  if (!expected || !crypto.timingSafeEqual(crypto.createHash('sha256').update(supplied).digest(),
    crypto.createHash('sha256').update(`Bearer ${expected}`).digest())) return res.status(401).json({ error: 'Unauthorized' });
  res.set('Cache-Control', 'no-store');
  // One message per serverless call bounds connection time. CLI processes batches.
  res.json(await deliverBatch({ limit: 1 }));
});
module.exports = router;
