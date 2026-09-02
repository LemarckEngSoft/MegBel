const express = require('express');
const { z } = require('zod');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');
const router = express.Router();
router.get('/', requireAuth, async (request, response, next) => { try { const result = await query('SELECT * FROM notifications WHERE recipient_id = $1 OR (recipient_id IS NULL AND pair_id = $2) ORDER BY created_at DESC LIMIT 30', [request.user.id, request.user.pair_id]); response.json({ notifications: result.rows }); } catch (error) { next(error); } });
router.patch('/:id/read', requireAuth, async (request, response, next) => { try { await query('UPDATE notifications SET read_at = NOW() WHERE id = $1 AND recipient_id = $2', [request.params.id, request.user.id]); response.status(204).end(); } catch (error) { next(error); } });
module.exports = router;
