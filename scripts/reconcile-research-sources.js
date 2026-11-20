// Applies only reviewed URL corrections. Never approves or publishes content.
// Default is read-only; use --apply after inspecting the proposed changes.
const crypto = require('node:crypto');
const { getDb, closeDb } = require('../server/db/database');
const { reviewImportRow } = require('../server/services/importService');
const report = require('../server/data/source-review-2026-11-16.json');
const fingerprint = fields => crypto.createHash('sha256').update(JSON.stringify(fields.map(v => String(v || '').trim()))).digest('hex');

async function run() {
  const apply = process.argv.includes('--apply');
  const db = getDb();
  const rows = await db.all('SELECT * FROM rinkcircuit.import_rows');
  const results = [];
  for (const finding of report.rows.filter(row => row.result === 'source_update')) {
    const url = new URL(finding.recommendedSource);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe reviewed source');
    const matches = rows.filter(row => {
      const raw = JSON.parse(row.raw_data_json);
      return fingerprint([raw.League || raw.name || raw['Programme Name'], raw.Area || raw.area || raw.City,
        raw.Category || raw.category, raw.Source || raw.source || raw.url]) === finding.fingerprint;
    });
    if (matches.length !== 1) {
      results.push({ name: finding.name, outcome: 'skipped', reason: 'Original candidate missing or present in multiple batches' });
      continue;
    }
    const row = matches[0];
    const currentFields = [row.candidate_programme_name, row.candidate_area, row.candidate_category, row.evidence_url];
    const raw = JSON.parse(row.raw_data_json);
    const originalSource = raw.Source || raw.source || raw.url;
    const correctedMatch = row.evidence_url === finding.recommendedSource &&
      fingerprint([...currentFields.slice(0, 3), originalSource]) === finding.fingerprint;
    if (correctedMatch) {
      results.push({ name: finding.name, outcome: 'already_corrected' });
      continue;
    }
    if (row.status !== 'pending_review' || fingerprint(currentFields) !== finding.fingerprint) {
      results.push({ name: finding.name, outcome: 'skipped', reason: 'Candidate changed or already reviewed' });
      continue;
    }
    if (apply) await reviewImportRow(row.batch_id, row.id, {
      action: 'correct', version: row.review_version,
      name: row.candidate_programme_name, area: row.candidate_area, category: row.candidate_category,
      source: finding.recommendedSource,
      reason: `Public-source review ${report.reviewedOn}: ${finding.note} URL correction only; publication and remaining field review are pending.`
    }, 'research-source-reconciliation');
    results.push({ name: finding.name, outcome: apply ? 'corrected' : 'proposed', source: finding.recommendedSource });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', results }, null, 2));
}
run().catch(error => { console.error('Source reconciliation failed:', error.code || error.message); process.exitCode = 1; })
  .finally(closeDb);
