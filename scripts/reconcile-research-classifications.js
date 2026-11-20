// Reviewed decisions only; default preview, explicit --apply for audited changes.
const { getDb, closeDb } = require('../server/db/database');
const { sourceReviewFor } = require('../server/services/sourceReview');
const { reviewImportRow } = require('../server/services/importService');
const report = require('../server/data/source-review-2026-11-16.json');
const classifications = {
  68: { evidenceUrl: 'https://whct.ca/', reason: 'Official WHCT page identifies an adult recreational league and its 2026/27 season. Allocation-list presence does not make this an applicant-only lead. Availability and publication remain unapproved.' },
  69: { evidenceUrl: 'https://gthla.ca/', reason: 'Official GTHLA site identifies league teams, divisions and a regular-season schedule. This supports programme identity beyond the allocation record; eligibility and publication still require review.' },
  71: { evidenceUrl: 'https://swhlwildcats.com/schedule.shtml', reason: 'Official SWHL schedule names the league and its five-team 2026/27 season. This supports programme identity beyond allocation; publication and availability remain unapproved.' }
};
async function run() {
  const apply = process.argv.includes('--apply');
  const rows = await getDb().all('SELECT * FROM rinkcircuit.import_rows');
  const results = [];
  for (const finding of report.rows) {
    const classification = classifications[finding.rowNumber];
    if (!classification && !['entity_split', 'unresolved'].includes(finding.result)) continue;
    const matches = rows.filter(row => row.candidate_programme_name === finding.name &&
      sourceReviewFor(row.candidate_programme_name, row.candidate_area, row.candidate_category, row.evidence_url));
    if (matches.length !== 1) { results.push({name:finding.name,outcome:'skipped_changed_or_ambiguous'}); continue; }
    const row = matches[0];
    const flags = JSON.parse(row.flags || '[]');
    if (row.status !== 'pending_review') { results.push({name:finding.name,outcome:'skipped_already_reviewed'}); continue; }
    if (!classification && flags.includes('scope_reviewed') && !flags.includes('editorial_hold')) {
      results.push({name:finding.name,outcome:'skipped_scope_resolved'}); continue;
    }
    const action = classification ? 'classify_programme' : 'hold';
    if ((classification && !flags.includes('applicant_lead') && flags.includes('publication_hold')) || (!classification && flags.includes('editorial_hold'))) {
      results.push({name:finding.name,outcome:'already_recorded'}); continue;
    }
    const input = {action,version:row.review_version,
      reason:classification ? classification.reason : `Source review ${report.reviewedOn}: ${finding.note} Resolve evidence and programme identity before import.`,
      ...(classification ? {evidenceUrl:classification.evidenceUrl,evidenceReviewed:true} : {})};
    if (apply) await reviewImportRow(row.batch_id,row.id,input,'research-classification-reconciliation');
    results.push({name:finding.name,action,outcome:apply?'recorded':'proposed'});
  }
  console.log(JSON.stringify({mode:apply?'apply':'preview',results},null,2));
}
run().catch(error=>{console.error('Classification reconciliation failed:',error.code||error.message);process.exitCode=1;}).finally(closeDb);
