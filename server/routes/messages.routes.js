const express = require('express');
const { z } = require('zod');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { recordParticipation } = require('../services/streak.service');

const router = express.Router();
const messageSchema = z.object({ content: z.string().trim().min(1).max(4000) });

router.get('/', requireAuth, async (request, response, next) => {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit) || 40, 1), 100);
    const result = await query(`SELECT m.id, m.content, m.message_type, m.media_url, m.created_at, m.sender_id, u.name AS sender_name, u.nickname AS sender_nickname, u.photo_url AS sender_photo
      FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.pair_id = $1
      ORDER BY m.created_at DESC LIMIT $2`, [request.user.pair_id, limit]);
    const nominations = await query(`SELECT n.id, n.nickname, u.name AS nominator_name
      FROM nominations n JOIN users u ON u.id = n.nominator_id
      WHERE n.nominee_id = $1 AND n.status = 'pending' ORDER BY n.created_at DESC`, [request.user.id]);
    response.json({ messages: result.rows.reverse(), nominations: nominations.rows });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, upload.single('media'), async (request, response, next) => {
  try {
    const content = request.body.content?.trim() || null;
    const messageType = request.file ? (request.file.mimetype.startsWith('audio/') ? 'audio' : 'image') : 'text';
    if (messageType === 'text') messageSchema.parse({ content });
    const mediaUrl = request.file ? `/uploads/${request.file.filename}` : null;
    const result = await query(`INSERT INTO messages (pair_id, sender_id, message_type, content, media_url) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, content, message_type, media_url, created_at, sender_id`, [request.user.pair_id, request.user.id, messageType, content, mediaUrl]);
    const message = { ...result.rows[0], media_url: mediaUrl, sender_name: request.user.name };
    const participation = await recordParticipation(request.user.pair_id, request.user.id);
    await query(`INSERT INTO notifications (pair_id, recipient_id, actor_id, type, title, body)
      SELECT $1, id, $2, 'message', 'Nova atividade', $3 FROM users WHERE pair_id = $1 AND id <> $2`, [request.user.pair_id, request.user.id, `${request.user.name} enviou uma nova ${messageType === 'text' ? 'mensagem' : messageType === 'image' ? 'foto' : 'mensagem de audio'}.`]);
    request.io.to(`pair:${request.user.pair_id}`).emit('message:new', message);
    request.io.to(`pair:${request.user.pair_id}`).emit('streak:updated', participation);
    response.status(201).json({ message });
  } catch (error) { next(error); }
});

module.exports = router;
