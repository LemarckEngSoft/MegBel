const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../config/database');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

router.post('/login', async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const result = await query('SELECT id, name, email, password_hash, photo_url, role, pair_id, created_at FROM users WHERE email = $1', [input.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) return response.status(401).json({ error: 'E-mail ou senha incorretos.' });
    const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: '8h' });
    response.cookie('duo_session', token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      signed: false,
      maxAge: 8 * 60 * 60 * 1000
    });
    delete user.password_hash;
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (request, response) => {
  response.clearCookie('duo_session');
  response.status(204).end();
});

router.get('/me', requireAuth, (request, response) => response.json({ user: request.user }));

module.exports = router;
