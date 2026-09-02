const bcrypt = require('bcryptjs');
const { withTransaction, pool } = require('../config/database');

async function seed() {
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const userName = process.env.USER_NAME || 'Usuario';
  const userEmail = process.env.USER_EMAIL;
  const userPassword = process.env.USER_PASSWORD;
  if (!adminEmail || !adminPassword || !userEmail || !userPassword) {
    throw new Error('Defina ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL e USER_PASSWORD apenas no ambiente local.');
  }

  await withTransaction(async (client) => {
    const pair = await client.query("INSERT INTO pairs (name) VALUES ('Nosso espaco') RETURNING id");
    const pairId = pair.rows[0].id;
    await client.query(
      'INSERT INTO users (name, email, password_hash, role, pair_id) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $5)',
      [adminName, adminEmail.toLowerCase(), await bcrypt.hash(adminPassword, 12), 'admin', pairId, userName, userEmail.toLowerCase(), await bcrypt.hash(userPassword, 12), 'user']
    );
  });
  await pool.end();
  console.log('Duo inicial criado com duas contas.');
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
