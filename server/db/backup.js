const { getDb } = require('./database');
const tables = require('./tables.json');

async function exportBackup() {
  const db = getDb();
  return db.transaction(async () => {
    await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const backup = { format: 'rinkcircuit-postgres-v1', exported_at: new Date().toISOString() };
    for (const table of tables) backup[table] = await db.all(`SELECT * FROM rinkcircuit.${table}`);
    return backup;
  });
}

async function restoreBackup(data) {
  if (!data || data.format !== 'rinkcircuit-postgres-v1' || tables.some(table => !Array.isArray(data[table]))) {
    const error = new Error('A complete RinkCircuit PostgreSQL backup is required.');
    error.status = 400;
    throw error;
  }
  const db = getDb();
  await db.transaction(async () => {
    await db.exec(`LOCK TABLE ${tables.map(table => `rinkcircuit.${table}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);
    const columns = {};
    for (const table of tables) {
      columns[table] = (await db.all(`SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'rinkcircuit' AND table_name = ? ORDER BY ordinal_position`, table)).map(row => row.column_name);
      for (const row of data[table]) {
        if (!row || typeof row !== 'object' || Array.isArray(row) ||
          Object.keys(row).some(key => !columns[table].includes(key))) throw new Error('Invalid backup row.');
      }
    }
    for (const table of [...tables].reverse()) await db.run(`DELETE FROM rinkcircuit.${table}`);
    for (const table of tables) {
      const names = columns[table];
      for (const row of data[table]) await db.run(
        `INSERT INTO rinkcircuit.${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
        ...names.map(name => row[name] ?? null));
    }
  });
}
module.exports = { exportBackup, restoreBackup };
