const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { query } = require('../config/database');
const { recordParticipation, today } = require('../services/streak.service');

const router = express.Router();
router.get('/', requireAuth, async (request, response, next) => {
  try {
    const state = await query('SELECT * FROM streak_state WHERE pair_id = $1', [request.user.pair_id]);
    const users = await query('SELECT id, name, nickname, photo_url FROM users WHERE pair_id = $1 ORDER BY created_at', [request.user.pair_id]);
    const activity = await query('SELECT * FROM daily_activity WHERE pair_id = $1 AND activity_date = $2', [request.user.pair_id, today()]);
    response.json({ streak: state.rows[0], users: users.rows, today: activity.rows[0] || null });
  } catch (error) { next(error); }
});
router.get('/history', requireAuth, async (request, response, next) => {
  try {
    const result = await query(`SELECT day_number, activity_date, completed, user_a_completed, user_b_completed FROM daily_activity WHERE pair_id = $1 AND activity_date >= '2026-01-01' AND activity_date < '2027-01-01' ORDER BY activity_date`, [request.user.pair_id]);
    const skipped = await query(`SELECT DISTINCT to_char(punishment.punishment_date, 'YYYY-MM-DD') AS punishment_date FROM punishments punishment
      LEFT JOIN daily_activity activity ON activity.pair_id = punishment.pair_id AND activity.activity_date = punishment.punishment_date
      WHERE punishment.pair_id = $1 AND punishment.status = 'restored' AND punishment.punishment_date >= '2026-01-01' AND punishment.punishment_date < '2027-01-01' AND COALESCE(activity.completed, FALSE) = FALSE`, [request.user.pair_id]);
    response.json({ days: result.rows, skipped: skipped.rows.map((row) => row.punishment_date) });
  } catch (error) { next(error); }
});
router.post('/participate', requireAuth, async (request, response, next) => {
  try { const result = await recordParticipation(request.user.pair_id, request.user.id); if (result.loss) return response.status(409).json({ error: 'A sequência foi perdida. Registre as punições necessárias na aba Punição.', loss: result.loss }); request.io.to(`pair:${request.user.pair_id}`).emit('streak:updated', result); response.json(result); } catch (error) { next(error); }
});
module.exports = router;
