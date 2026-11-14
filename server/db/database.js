const path = require('path');
const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
types.setTypeParser(20, value => {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value;
});
const transactions = new AsyncLocalStorage();
let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    if (!connectionString) throw new Error('SUPABASE_DATABASE_URL is required.');
    pool = new Pool({
      connectionString, max: 3, connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000, allowExitOnIdle: true,
      ssl: /[?&]sslmode=/.test(connectionString) ? undefined
        : ['localhost', '127.0.0.1', '::1'].includes(new URL(connectionString).hostname)
          ? false : { rejectUnauthorized: true },
    });
    pool.on('error', error => console.error('Database pool error:', error.code || 'CONNECTION_ERROR'));
  }
  return pool;
}
// Bind values, never interpolate them. Ignore placeholders inside SQL strings.
function parameters(sql) {
  let index = 0, quoted = false, result = '';
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      if (quoted && sql[i + 1] === "'") { result += "''"; i++; continue; }
      quoted = !quoted;
    }
    result += char === '?' && !quoted ? `$${++index}` : char;
  }
  return result;
}
async function query(sql, values = []) {
  const client = transactions.getStore() || getPool();
  // Unnamed queries support Supabase's transaction pooler.
  return client.query(parameters(sql), values.map(value => value === undefined ? null : value));
}
const db = {
  async all(sql, ...values) { return (await query(sql, values)).rows; },
  async get(sql, ...values) { return (await query(sql, values)).rows[0]; },
  async run(sql, ...values) { const result = await query(sql, values); return { changes: result.rowCount }; },
  async exec(sql) { return query(sql); },
  async transaction(callback) {
    if (transactions.getStore()) return callback();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await transactions.run(client, callback);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
};
function getDb() { return db; }
async function closeDb() { if (pool) { await pool.end(); pool = undefined; } }
module.exports = { getDb, closeDb, parameters };
