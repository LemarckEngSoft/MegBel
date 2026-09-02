const express = require('express');
const { z } = require('zod');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
const eventSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(1000).optional().default(''), event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), event_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')) });

router.get('/', requireAuth, async (request, response, next) => {
  try { const result = await query('SELECT id, title, description, event_date, event_time, created_by FROM calendar_events WHERE pair_id = $1 ORDER BY event_date, event_time NULLS LAST', [request.user.pair_id]); response.json({ events: result.rows }); } catch (error) { next(error); }
});
router.post('/', requireAuth, async (request, response, next) => {
  try { const event = eventSchema.parse(request.body); const result = await query(`INSERT INTO calendar_events (pair_id, created_by, title, description, event_date, event_time) VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::time) RETURNING *`, [request.user.pair_id, request.user.id, event.title, event.description, event.event_date, event.event_time || '']); response.status(201).json({ event: result.rows[0] }); } catch (error) { next(error); }
});
router.delete('/:id', requireAuth, async (request, response, next) => {
  try { await query('DELETE FROM calendar_events WHERE id = $1 AND pair_id = $2', [request.params.id, request.user.pair_id]); response.status(204).end(); } catch (error) { next(error); }
});
module.exports = router;
