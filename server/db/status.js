const { getDb, closeDb } = require('./database');
const tables = require('./tables.json');
async function status() {
  const db = getDb();
  const counts = {};
  for (const table of tables) counts[table] = (await db.get(`SELECT count(*) AS count FROM rinkcircuit.${table}`)).count;
  console.log(JSON.stringify({ database:'Supabase PostgreSQL', schema:'rinkcircuit', counts },null,2));
}
if (require.main === module) status().catch(error=>{console.error('Database status failed:',error.code||error.message);process.exitCode=1;}).finally(closeDb);
module.exports = { status };
