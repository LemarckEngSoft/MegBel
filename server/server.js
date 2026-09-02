const path = require('node:path');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('./config/database');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const messagesRoutes = require('./routes/messages.routes');
const calendarRoutes = require('./routes/calendar.routes');
const petRoutes = require('./routes/pet.routes');
const streakRoutes = require('./routes/streak.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const participantsRoutes = require('./routes/participants.routes');
const punishmentRoutes = require('./routes/punishment.routes');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: env.corsOrigin, credentials: true } });

if (env.nodeEnv === 'production') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(env.cookieSecret));
app.use((request, _response, next) => { request.io = io; next(); });
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'duo-days' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/streak', streakRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/participants', participantsRoutes);
app.use('/api/punishments', punishmentRoutes);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.headers.cookie?.match(/(?:^|; )duo_session=([^;]+)/)?.[1];
    if (!token) return next(new Error('Autenticacao necessaria.'));
    const payload = jwt.verify(token, env.jwtSecret);
    const result = await query('SELECT id, name, pair_id FROM users WHERE id = $1', [payload.sub]);
    if (!result.rowCount) return next(new Error('Sessao invalida.'));
    socket.data.room = `pair:${result.rows[0].pair_id}`;
    socket.data.name = result.rows[0].name;
    socket.join(socket.data.room);
    next();
  } catch { next(new Error('Sessao invalida.')); }
});

io.on('connection', (socket) => {
  socket.on('typing:start', () => socket.to(socket.data.room).emit('typing:start', { name: socket.data.name }));
  socket.on('typing:stop', () => socket.to(socket.data.room).emit('typing:stop'));
});

app.use((error, _request, response, _next) => {
  if (error.name === 'ZodError') return response.status(400).json({ error: 'Dados invalidos.' });
  if (error.status) return response.status(error.status).json({ error: error.message });
  if (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_UNEXPECTED_FILE') return response.status(400).json({ error: 'Arquivo invalido ou muito grande.' });
  console.error(error);
  response.status(500).json({ error: 'Nao foi possivel concluir a operacao.' });
});

app.get('*', (_request, response) => response.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

httpServer.listen(env.port, () => console.log(`Duo Days rodando em http://localhost:${env.port}`));
module.exports = { app, httpServer, io };
