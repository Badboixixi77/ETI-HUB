import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import http from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { appRouter } from './routers';
import { createContext } from './_core/context';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

// ── Security middleware ──────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: isProd ? [CLIENT_URL] : ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply login rate limit only to login endpoint
app.use('/api/trpc/auth.login', loginLimiter);

// General API rate limit
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── HTTPS redirect in production ─────────────────────────────────────

if (isProd) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ── tRPC ─────────────────────────────────────────────────────────────

app.use(
  '/api/trpc',
  createExpressMiddleware({ router: appRouter, createContext }),
);

// ── WebSocket (Socket.IO) ────────────────────────────────────────────

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: isProd ? [CLIENT_URL] : ['http://localhost:5173'],
    credentials: true,
  },
});

// Track online users
const onlineUsers = new Map<string, string>(); // userId -> socketId

// Extend Socket to carry userId
interface AuthenticatedSocket extends Socket {
  userId?: string;
}

io.on('connection', (socket: AuthenticatedSocket) => {
  // Client sends their userId after connecting
  socket.on('auth', (userId: string) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    io.emit('presence', { userId, online: true });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('presence', { userId: socket.userId, online: false });
    }
  });

  // Join a channel room
  socket.on('join_channel', (channelId: string) => {
    socket.join(`channel:${channelId}`);
  });

  // Leave a channel room
  socket.on('leave_channel', (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  // Broadcast new message to channel members
  socket.on('message_sent', (data: { channelId: string; message: unknown }) => {
    socket.to(`channel:${data.channelId}`).emit('new_message', data.message);
  });

  // Broadcast typing indicator
  socket.on('typing', (data: { channelId: string; userName: string; isTyping: boolean }) => {
    socket.to(`channel:${data.channelId}`).emit('typing', data);
  });
});

// ── Serve static client in production ────────────────────────────────

if (isProd) {
  // When compiled: dist/server/server/index.js → go up 3 levels to reach dist/client
  const clientPath = path.join(__dirname, '..', '..', 'client');
  app.use(express.static(clientPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`ETI Hub server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { io };
