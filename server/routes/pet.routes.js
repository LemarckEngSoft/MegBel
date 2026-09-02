const express = require('express');
const { z } = require('zod');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
const petSchema = z.object({ name: z.string().trim().min(1).max(40), expression: z.string().trim().min(1).max(40), speech_text: z.string().trim().min(1).max(140), appearance: z.record(z.string()).default({}) });

router.get('/', requireAuth, async (request, response, next) => {
  try { const result = await query('SELECT * FROM pet_state WHERE pair_id = $1', [request.user.pair_id]); response.json({ pet: result.rows[0] }); } catch (error) { next(error); }
});
router.patch('/', requireAuth, async (request, response, next) => {
  try {
    const pet = petSchema.parse(request.body);
    const result = await query(`UPDATE pet_state SET name=$1, expression=$2, speech_text=$3, appearance=$4, updated_by=$5, updated_at=NOW() WHERE pair_id=$6 RETURNING *`, [pet.name, pet.expression, pet.speech_text, pet.appearance, request.user.id, request.user.pair_id]);
    request.io.to(`pair:${request.user.pair_id}`).emit('pet:updated', result.rows[0]);
    response.json({ pet: result.rows[0] });
  } catch (error) { next(error); }
});
router.get('/items', requireAuth, async (request, response, next) => {
  try { const category = request.query.category; const result = await query('SELECT * FROM pet_items WHERE active = TRUE AND ($1::text IS NULL OR category = $1) ORDER BY sort_order, name', [category || null]); response.json({ items: result.rows }); } catch (error) { next(error); }
});
module.exports = router;
