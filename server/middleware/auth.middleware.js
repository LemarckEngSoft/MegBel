const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/database');

async function requireAuth(request, response, next) {
  const token = request.cookies.duo_session;
  if (!token) return response.status(401).json({ error: 'Autenticacao necessaria.' });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const result = await query('SELECT id, name, email, photo_url, role, pair_id, created_at FROM users WHERE id = $1', [payload.sub]);
    if (!result.rowCount) return response.status(401).json({ error: 'Sessao invalida.' });
    request.user = result.rows[0];
    next();
  } catch {
    response.clearCookie('duo_session');
    response.status(401).json({ error: 'Sessao expirada.' });
  }
}

function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') return response.status(403).json({ error: 'Acesso administrativo necessario.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
