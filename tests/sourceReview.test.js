const assert = require('node:assert/strict');
const { sourceReviewFor } = require('../server/services/sourceReview');
const rows = require('../server/data/extracted_leagues.json');
const report = require('../server/data/source-review-2026-11-16.json');
assert.equal(report.rows.length, 79);
assert.equal(new Set(report.rows.map(row => row.fingerprint)).size, 79);
for (const row of rows) {
  const args = [row.League, row.Area, row.Category, row.Source];
  const review = sourceReviewFor(...args);
  assert.ok(review);
  assert.equal(review.publicationApproved, false);
  assert.equal(review.Email, undefined);
  for (let index = 0; index < 4; index++) {
    const changed = [...args]; changed[index] = String(changed[index]) + ' changed';
    assert.equal(sourceReviewFor(...changed), null, 'Changed fields must invalidate the assessment');
  }
  if (review.recommendedSource) {
    const url = new URL(review.recommendedSource);
    assert.ok(['http:', 'https:'].includes(url.protocol));
    assert.equal(url.username + url.password, '');
  }
}
assert.equal(report.rows.filter(row => row.result === 'allocation_only').length, 17);
console.log('Source review: 79 candidates covered; changed-field invalidation and safe evidence links passed.');
