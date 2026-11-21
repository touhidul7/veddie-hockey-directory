require('dotenv').config();
const { getDb, closeDb } = require('../server/db/database');
const { reviewImportRow } = require('../server/services/importService');

async function run() {
  const db = getDb();

  const row65 = await db.get("SELECT * FROM rinkcircuit.import_rows WHERE candidate_programme_name = ?", 'Scotiabank Pond adult hockey');
  if (row65 && row65.status === 'pending_review') {
    console.log('Rejecting row 65 as duplicate of row 26...');
    await reviewImportRow(row65.batch_id, row65.id, {
      action: 'reject',
      version: row65.review_version,
      reason: 'Consolidated into row 26 (Chesswood Arena Adult Hockey). Scotiabank Pond serves as auxiliary ice for the Chesswood adult league, not an independent standalone league operator.'
    }, 'editorial-reconciliation');
    console.log('Row 65 rejected successfully.');
  }

  const row70 = await db.get("SELECT * FROM rinkcircuit.import_rows WHERE candidate_programme_name = ?", 'Etobicoke Dolphins – Senior Ladies');
  if (row70 && row70.status === 'pending_review') {
    console.log('Correcting row 70 source...');
    await reviewImportRow(row70.batch_id, row70.id, {
      action: 'correct',
      version: row70.review_version,
      name: row70.candidate_programme_name,
      area: row70.candidate_area,
      category: row70.candidate_category,
      source: 'https://etobicokedolphins.ca/Pages/1810/Ladies_18_/',
      reason: 'Update source to official Etobicoke Dolphins Senior Ladies 18+ programme page, removing municipal allocation PDF.'
    }, 'editorial-reconciliation');
    
    let updated70 = await db.get("SELECT * FROM rinkcircuit.import_rows WHERE id = ?", row70.id);
    console.log('Classifying row 70 programme...');
    await reviewImportRow(updated70.batch_id, updated70.id, {
      action: 'classify_programme',
      version: updated70.review_version,
      evidenceReviewed: true,
      evidenceUrl: 'https://etobicokedolphins.ca/Pages/1810/Ladies_18_/',
      reason: 'Official programme site verifies adult women 18+ recreational division; not solely an allocation list applicant.'
    }, 'editorial-reconciliation');

    updated70 = await db.get("SELECT * FROM rinkcircuit.import_rows WHERE id = ?", row70.id);
    console.log('Resolving hold on row 70...');
    await reviewImportRow(updated70.batch_id, updated70.id, {
      action: 'resolve_hold',
      version: updated70.review_version,
      evidenceReviewed: true,
      evidenceUrl: 'https://etobicokedolphins.ca/Pages/1810/Ladies_18_/',
      programmeScope: 'Senior Ladies 18+ recreational adult division operated by Etobicoke Dolphins Girls Hockey League. Games hosted across Etobicoke municipal arenas. Retains publication hold for draft import.',
      reason: 'Official site resolves programme scope to Senior Ladies 18+ division in Etobicoke. Hold released to draft.'
    }, 'editorial-reconciliation');
    console.log('Row 70 hold resolved successfully.');
  }
}

run().catch(console.error).finally(closeDb);
