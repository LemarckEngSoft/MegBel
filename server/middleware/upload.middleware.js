const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_request, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm']);
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(null, allowed.has(file.mimetype)) });
module.exports = { upload };
