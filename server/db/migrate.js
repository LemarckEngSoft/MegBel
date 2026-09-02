const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/database');

async function migrate() {
  if (!pool) throw new Error('Configure DATABASE_URL antes de executar as migrations.');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for (const filename of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
    if (applied.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`Migration aplicada: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

migrate().catch((error) => { console.error(error.message); process.exitCode = 1; });
