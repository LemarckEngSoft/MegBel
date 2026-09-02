const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
const nominationSchema = z.object({ nickname: z.string().trim().min(1).max(50) });

router.get('/', requireAuth, async (request, response, next) => {
  try { const result = await query('SELECT id, name, nickname, email, photo_url, created_at FROM users WHERE pair_id = $1 AND id <> $2', [request.user.pair_id, request.user.id]); response.json({ participants: result.rows }); } catch (error) { next(error); }
});

router.get('/nominations/pending', requireAuth, async (request, response, next) => {
  try { const result = await query('SELECT n.*, u.name AS nominator_name FROM nominations n JOIN users u ON u.id = n.nominator_id WHERE n.nominee_id = $1 AND n.status = $2 ORDER BY n.created_at DESC', [request.user.id, 'pending']); response.json({ nominations: result.rows }); } catch (error) { next(error); }
});

router.patch('/nominations/:id', requireAuth, async (request, response, next) => {
  try {
    const status = z.enum(['accepted', 'rejected']).parse(request.body.status);
    const result = await query('UPDATE nominations SET status = $1, responded_at = NOW() WHERE id = $2 AND nominee_id = $3 AND status = $4 RETURNING *', [status, request.params.id, request.user.id, 'pending']);
    if (!result.rowCount) return response.status(404).json({ error: 'Nomeacao nao encontrada.' });
    if (status === 'accepted') await query('UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2', [result.rows[0].nickname, request.user.id]);
    request.io.to(`pair:${request.user.pair_id}`).emit('notification:new');
    response.json({ nomination: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/:id', requireAuth, async (request, response, next) => {
  try { const result = await query('SELECT id, name, nickname, email, photo_url, created_at FROM users WHERE pair_id = $1 AND id = $2 AND id <> $3', [request.user.pair_id, request.params.id, request.user.id]); if (!result.rowCount) return response.status(404).json({ error: 'Participante nao encontrado.' }); response.json({ participant: result.rows[0] }); } catch (error) { next(error); }
});

router.post('/:id/nominations', requireAuth, async (request, response, next) => {
  try {
    const { nickname } = nominationSchema.parse(request.body);
    if (request.params.id === request.user.id) return response.status(400).json({ error: 'Voce nao pode nomear a si mesmo.' });
    const result = await withTransaction(async (client) => {
      const target = await client.query('SELECT id FROM users WHERE id = $1 AND pair_id = $2 AND id <> $3', [request.params.id, request.user.pair_id, request.user.id]);
      if (!target.rowCount) throw Object.assign(new Error('Participante nao encontrado.'), { status: 404 });
      const nomination = await client.query('INSERT INTO nominations (pair_id, nominator_id, nominee_id, nickname) VALUES ($1,$2,$3,$4) ON CONFLICT (pair_id, nominator_id, nominee_id) DO NOTHING RETURNING *', [request.user.pair_id, request.user.id, request.params.id, nickname]);
      if (!nomination.rowCount) throw Object.assign(new Error('Este participante ja recebeu uma nomeacao sua.'), { status: 409 });
      await client.query('INSERT INTO notifications (pair_id, recipient_id, actor_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [request.user.pair_id, request.params.id, request.user.id, 'nomination', 'Uma nomeacao chegou', `${request.user.name} dedicou uma nomeacao a voce.`]);
      return nomination.rows[0];
    });
    request.io.to(`pair:${request.user.pair_id}`).emit('notification:new');
    response.status(201).json({ nomination: result });
  } catch (error) { next(error); }
});

module.exports = router;
