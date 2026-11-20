const crypto = require('crypto');
const report = require('../data/source-review-2026-11-16.json');
const byFingerprint = new Map(report.rows.map(row => [row.fingerprint, row]));

// Advisory research only. Exact field matching prevents an old assessment from
// appearing to verify a corrected candidate or a different programme.
function sourceReviewFor(name, area, category, source) {
  const fields = [name, area, category, source].map(value => String(value || '').trim());
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  const row = byFingerprint.get(fingerprint);
  if (!row) return null;
  return { reviewedOn: report.reviewedOn, result: row.result, note: row.note,
    recommendedSource: row.recommendedSource, publicationApproved: false };
}

module.exports = { sourceReviewFor };
