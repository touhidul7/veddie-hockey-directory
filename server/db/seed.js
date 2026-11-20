const crypto = require('crypto');
const { getDb, closeDb } = require('./database');
const { previewAndStageBatch } = require('../services/importService');
const rows = require('../data/extracted_leagues.json');
async function seedDatabase() {
  const db = getDb();
  return db.transaction(async () => {
    await db.get('SELECT pg_advisory_xact_lock(826412907)');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    const source = `research-workbook:${fingerprint}`;
    const existing = await db.get('SELECT id FROM rinkcircuit.import_batches WHERE source_name = ?',source);
    if (existing) { console.log('Research workbook is already staged; existing data preserved.'); return existing.id; }
    const result = await previewAndStageBatch('Men_s Hockey Leagues to Add.xlsx',source,rows);
    console.log(`Staged ${result.totalRows} research rows for admin review. No public listings or demo data were created.`);
    return result.batchId;
  });
}
if (require.main === module) seedDatabase().catch(error=>{console.error('Research staging failed:',error.code||error.message);process.exitCode=1;}).finally(closeDb);
module.exports = { seedDatabase };
