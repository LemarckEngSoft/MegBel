const express = require('express');
const { z } = require('zod');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();
const profileSchema = z.object({ name: z.string().trim().min(1).max(80) });

router.patch('/me', requireAuth, upload.single('photo'), async (request, response, next) => {
  try {
    const { name } = profileSchema.parse(request.body);
    if (request.file && !request.file.mimetype.startsWith('image/')) return response.status(400).json({ error: 'A foto de perfil precisa ser uma imagem.' });
    const photoUrl = request.file ? `/uploads/${request.file.filename}` : request.user.photo_url;
    const result = await query('UPDATE users SET name = $1, photo_url = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, email, photo_url, role, pair_id, created_at', [name, photoUrl, request.user.id]);
    request.io.to(`pair:${request.user.pair_id}`).emit('profile:updated', result.rows[0]);
    response.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
