const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');
const { previousDay } = require('../services/streak.service');

const router = express.Router();
const punishmentSchema = z.object({ punished_user_id: z.string().uuid(), punishment_text: z.string().trim().min(1).max(300), details: z.string().max(1000).optional().default('') });

async function getLoss(client, pairId) {
  const state = await client.query('SELECT * FROM streak_state WHERE pair_id = $1 FOR UPDATE', [pairId]);
  const users = await client.query('SELECT id FROM users WHERE pair_id = $1 ORDER BY created_at', [pairId]);
  if (!state.rowCount || users.rowCount !== 2) return null;
  const currentDate = previousDay();
  const activity = await client.query('SELECT * FROM daily_activity WHERE pair_id = $1 AND activity_date = $2', [pairId, currentDate]);
  if (activity.rowCount && activity.rows[0].completed) return null;
  const stateRow = state.rows[0];
  if ((stateRow.last_completed_on && stateRow.last_completed_on >= currentDate) || stateRow.pending_loss_date === currentDate) return null;
  const missing = activity.rows[0] ? users.rows.filter((user, index) => !activity.rows[0][index === 0 ? 'user_a_completed' : 'user_b_completed']) : users.rows;
  if (!missing.length) return null;
  await client.query('UPDATE streak_state SET pending_loss_date = $1, pending_loss_day = current_streak, lost_on = $1, updated_at = NOW() WHERE pair_id = $2', [currentDate, pairId]);
  await client.query(`INSERT INTO notifications (pair_id, recipient_id, type, title, body)
    SELECT $1, id, 'streak_lost', 'Sequência perdida', 'A sequência foi perdida. Atribua as punições necessárias na aba Punição para restaurar.'
    FROM users WHERE pair_id = $1 AND NOT EXISTS (SELECT 1 FROM notifications WHERE pair_id = $1 AND type = 'streak_lost' AND created_at::date = $2)`, [pairId, currentDate]);
  return { date: currentDate, day: stateRow.current_streak, missing: missing.map((user) => user.id) };
}

router.get('/', requireAuth, async (request, response, next) => {
  try {
    const loss = await withTransaction((client) => getLoss(client, request.user.pair_id));
    const result = await query(`SELECT p.*, u.name AS punished_name, c.name AS creator_name FROM punishments p JOIN users u ON u.id = p.punished_user_id JOIN users c ON c.id = p.created_by WHERE p.pair_id = $1 ORDER BY p.punishment_date DESC, p.created_at DESC`, [request.user.pair_id]);
    const pending = await query('SELECT * FROM streak_state WHERE pair_id = $1', [request.user.pair_id]);
    response.json({ punishments: result.rows, loss, restoration: { required: pending.rows[0]?.pending_loss_date ? true : false, date: pending.rows[0]?.pending_loss_date || null, day: pending.rows[0]?.pending_loss_day || null } });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = punishmentSchema.parse(request.body);
    if (input.punished_user_id === request.user.id) return response.status(400).json({ error: 'Voce nao pode atribuir uma punicao a si mesmo.' });
    const result = await withTransaction(async (client) => {
      const loss = await getLoss(client, request.user.pair_id);
      if (!loss) throw Object.assign(new Error('Nao existe uma perda de sequencia que exija punicao.'), { status: 409 });
      if (!loss.missing.includes(input.punished_user_id)) throw Object.assign(new Error('Este participante nao faltou neste dia.'), { status: 400 });
      const target = await client.query('SELECT id, name FROM users WHERE id = $1 AND pair_id = $2', [input.punished_user_id, request.user.pair_id]);
      if (!target.rowCount) throw Object.assign(new Error('Participante invalido.'), { status: 400 });
      const inserted = await client.query(`INSERT INTO punishments (pair_id, punishment_date, streak_day, punished_user_id, created_by, punishment_text, details) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [request.user.pair_id, loss.date, loss.day, input.punished_user_id, request.user.id, input.punishment_text, input.details]);
      const counts = await client.query('SELECT count(*) FILTER (WHERE punished_user_id = ANY($1::uuid[])) AS total FROM punishments WHERE pair_id = $2 AND punishment_date = $3', [loss.missing, request.user.pair_id, loss.date]);
      if (Number(counts.rows[0].total) >= loss.missing.length) {
        await client.query('UPDATE punishments SET status = $1, restored_at = NOW() WHERE pair_id = $2 AND punishment_date = $3', ['restored', request.user.pair_id, loss.date]);
        await client.query('UPDATE streak_state SET pending_loss_date = NULL, pending_loss_day = NULL, updated_at = NOW() WHERE pair_id = $1', [request.user.pair_id]);
      }
      return inserted.rows[0];
    });
    request.io.to(`pair:${request.user.pair_id}`).emit('streak:restored', { day: result.streak_day });
    response.status(201).json({ punishment: result });
  } catch (error) { next(error); }
});
module.exports = router;
