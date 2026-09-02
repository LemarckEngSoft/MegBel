const { Pool } = require('pg');
const env = require('./env');

const pool = env.databaseUrl
  ? new Pool({ connectionString: env.databaseUrl, ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined })
  : null;

async function query(text, params) {
  if (!pool) throw new Error('DATABASE_URL nao configurada.');
  return pool.query(text, params);
}

async function withTransaction(callback) {
  if (!pool) throw new Error('DATABASE_URL nao configurada.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
