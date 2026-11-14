const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb, closeDb } = require('./database');

async function migrate() {
  const db = getDb();
  await db.transaction(async () => {
    await db.get('SELECT pg_advisory_xact_lock(826412905)');
    await db.exec(`CREATE SCHEMA IF NOT EXISTS rinkcircuit;
      REVOKE ALL ON SCHEMA rinkcircuit FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS rinkcircuit.schema_migrations (
        name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    const directory = path.join(__dirname, 'migrations');
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existing = await db.get('SELECT checksum FROM rinkcircuit.schema_migrations WHERE name = ?', name);
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await db.exec(sql);
      await db.run('INSERT INTO rinkcircuit.schema_migrations (name, checksum) VALUES (?, ?)', name, checksum);
      console.log(`Applied ${name}`);
    }
  });
  console.log('Database migrations are up to date.');
}

if (require.main === module) migrate()
  .catch(error => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; })
  .finally(closeDb);
module.exports = { migrate };
