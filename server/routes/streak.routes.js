const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { query } = require('../config/database');
const { recordParticipation, today } = require('../services/streak.service');

const router = express.Router();
router.get('/', requireAuth, async (request, response, next) => {
  try {
    const state = await query('SELECT * FROM streak_state WHERE pair_id = $1', [request.user.pair_id]);
    const users = await query('SELECT id, name FROM users WHERE pair_id = $1 ORDER BY created_at', [request.user.pair_id]);
    const activity = await query('SELECT * FROM daily_activity WHERE pair_id = $1 AND activity_date = $2', [request.user.pair_id, today()]);
    response.json({ streak: state.rows[0], users: users.rows, today: activity.rows[0] || null });
  } catch (error) { next(error); }
});
router.get('/history', requireAuth, async (request, response, next) => {
  try {
    const result = await query(`SELECT day_number, activity_date, completed FROM daily_activity WHERE pair_id = $1 ORDER BY activity_date DESC LIMIT 180`, [request.user.pair_id]);
    response.json({ days: result.rows });
  } catch (error) { next(error); }
});
router.post('/participate', requireAuth, async (request, response, next) => {
  try { const result = await recordParticipation(request.user.pair_id, request.user.id); request.io.to(`pair:${request.user.pair_id}`).emit('streak:updated', result); response.json(result); } catch (error) { next(error); }
});
module.exports = router;
