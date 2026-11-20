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
      const normalizedSql = sql.replace(/\r\n/g, '\n');
      const hash = value => crypto.createHash('sha256').update(value).digest('hex');
      const checksum = hash(normalizedSql);
      const existing = await db.get('SELECT checksum FROM rinkcircuit.schema_migrations WHERE name = ?', name);
      if (existing) {
        // Accept legacy Windows checksums while keeping future hashes portable.
        if (![checksum, hash(sql), hash(normalizedSql.replace(/\n/g, '\r\n'))].includes(existing.checksum)) throw new Error(`Applied migration changed: ${name}`);
        if (existing.checksum !== checksum) await db.run('UPDATE rinkcircuit.schema_migrations SET checksum = ? WHERE name = ?', checksum, name);
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
