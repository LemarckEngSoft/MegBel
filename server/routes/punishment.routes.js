const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');
const { ensureLoss } = require('../services/streak-loss.service');

const router = express.Router();
const punishmentSchema = z.object({ punished_user_id: z.string().uuid(), punishment_text: z.string().trim().min(1).max(300), details: z.string().max(1000).optional().default('') });

router.get('/', requireAuth, async (request, response, next) => {
  try {
    const loss = await withTransaction((client) => ensureLoss(client, request.user.pair_id));
    if (loss) request.io.to(`pair:${request.user.pair_id}`).emit('notification:new');
    const result = await query(`SELECT p.*, u.name AS punished_name, c.name AS creator_name
      FROM punishments p JOIN users u ON u.id = p.punished_user_id JOIN users c ON c.id = p.created_by
      WHERE p.pair_id = $1 ORDER BY p.punishment_date DESC, p.created_at DESC`, [request.user.pair_id]);
    const state = await query(`SELECT to_char(pending_loss_date, 'YYYY-MM-DD') AS pending_loss_date, pending_loss_day FROM streak_state WHERE pair_id = $1`, [request.user.pair_id]);
    response.json({ punishments: result.rows, loss, restoration: { required: Boolean(state.rows[0]?.pending_loss_date), date: state.rows[0]?.pending_loss_date || null, day: state.rows[0]?.pending_loss_day || null } });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = punishmentSchema.parse(request.body);
    if (input.punished_user_id === request.user.id) return response.status(400).json({ error: 'Voce nao pode atribuir uma punicao a si mesmo.' });
    const result = await withTransaction(async (client) => {
      const loss = await ensureLoss(client, request.user.pair_id);
      if (!loss) throw Object.assign(new Error('Nao existe uma perda de sequencia que exija punicao.'), { status: 409 });
      if (!loss.missing.includes(input.punished_user_id)) throw Object.assign(new Error('Este participante nao faltou neste dia.'), { status: 400 });
      if (loss.missing.length === 1 && loss.missing.includes(request.user.id)) throw Object.assign(new Error('Somente quem participou pode atribuir a punicao.'), { status: 403 });
      const existing = await client.query('SELECT 1 FROM punishments WHERE pair_id = $1 AND punishment_date = $2 AND punished_user_id = $3', [request.user.pair_id, loss.date, input.punished_user_id]);
      if (existing.rowCount) throw Object.assign(new Error('A punicao obrigatoria para este participante ja foi atribuida.'), { status: 409 });

      const target = await client.query('SELECT id, name FROM users WHERE id = $1 AND pair_id = $2', [input.punished_user_id, request.user.pair_id]);
      if (!target.rowCount) throw Object.assign(new Error('Participante invalido.'), { status: 400 });
      const inserted = await client.query(`INSERT INTO punishments (pair_id, punishment_date, streak_day, punished_user_id, created_by, punishment_text, details)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [request.user.pair_id, loss.date, loss.day, input.punished_user_id, request.user.id, input.punishment_text, input.details]);
      const required = await client.query(`SELECT COUNT(DISTINCT punished_user_id)::int AS count FROM punishments
        WHERE pair_id = $1 AND punishment_date = $2 AND punished_user_id = ANY($3::uuid[])`, [request.user.pair_id, loss.date, loss.missing]);
      const restored = required.rows[0].count === loss.missing.length;

      const punishmentBody = `${request.user.name} atribuiu uma punicao a ${target.rows[0].name}: ${input.punishment_text}`;
      await client.query(`INSERT INTO notifications (pair_id, recipient_id, actor_id, type, title, body)
        SELECT $1, id, $2, 'punishment', 'Punicao atribuida', $3 FROM users WHERE pair_id = $1`, [request.user.pair_id, request.user.id, punishmentBody]);

      if (restored) {
        const previous = new Date(`${loss.date}T12:00:00Z`);
        previous.setUTCDate(previous.getUTCDate() - 1);
        const previousDate = previous.toISOString().slice(0, 10);
        await client.query('UPDATE punishments SET status = $1, restored_at = NOW() WHERE pair_id = $2 AND punishment_date = $3', ['restored', request.user.pair_id, loss.date]);
        await client.query(`UPDATE streak_state SET current_streak = $1, last_completed_on = $2, pending_loss_date = NULL, pending_loss_day = NULL, updated_at = NOW() WHERE pair_id = $3`, [loss.day, previousDate, request.user.pair_id]);
        await client.query(`INSERT INTO notifications (pair_id, recipient_id, type, title, body)
          SELECT $1, id, 'streak_restored', 'Sequencia restaurada', $2 FROM users WHERE pair_id = $1`, [request.user.pair_id, `A sequencia foi restaurada para ${loss.day} dias. O dia perdido nao foi contado.`]);
      }
      return { punishment: inserted.rows[0], restored, streak: loss.day, required: loss.missing.length, assigned: required.rows[0].count };
    });

    request.io.to(`pair:${request.user.pair_id}`).emit(result.restored ? 'streak:restored' : 'notification:new', result);
    response.status(201).json(result);
  } catch (error) { next(error); }
});

module.exports = router;
