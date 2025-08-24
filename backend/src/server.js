const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import configurations and utilities
const { connectDB } = require('./config/database');
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const testRoutes = require('./routes/tests');
const leaderboardRoutes = require('./routes/leaderboard');
const wordlistRoutes = require('./routes/wordlists');
const statsRoutes = require('./routes/stats');
const raceRoutes = require('./routes/races');

// Import socket handlers and performance monitor
const setupSocketIO = require('./sockets');
const performanceMonitor = require('./utils/performanceMonitor');

const app = express();
const httpServer = createServer(app);

// Initialize database connection
connectDB();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Request logging
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

// Compression middleware
if (process.env.ENABLE_COMPRESSION === 'true') {
  app.use(compression());
}

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting for HTTP endpoints
if (process.env.ENABLE_RATE_LIMITING === 'true') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
    message: {
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      code: 429
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', limiter);
}

// Body parsing middleware
app.use(express.json({ 
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));

// Health check endpoint with performance monitoring
app.get('/health', (req, res) => {
  const health = performanceMonitor.getHealthStatus();
  res.status(health.status === 'healthy' ? 200 : 503).json({
    status: health.status === 'healthy' ? 'OK' : 'DEGRADED',
    ...health,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Performance metrics endpoint (for monitoring/debugging)
app.get('/metrics', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  res.json(metrics);
});

// WebSocket statistics endpoint
app.get('/ws-stats', (req, res) => {
  const { activeConnections, activeTestSessions, activeRaces } = require('./sockets');
  
  res.json({
    connections: {
      active: activeConnections.size,
      details: Array.from(activeConnections.values()).map(conn => ({
        userId: conn.userId,
        username: conn.userInfo.username,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity
      }))
    },
    sessions: {
      activeTests: activeTestSessions.size,
      activeRaces: activeRaces.size,
      testDetails: Array.from(activeTestSessions.values()).map(session => ({
        testId: session.testId,
        userId: session.userId,
        mode: session.mode,
        startTime: session.startTime,
        isCompleted: session.isCompleted
      })),
      raceDetails: Array.from(activeRaces.values()).map(race => ({
        id: race.id,
        name: race.name,
        status: race.status,
        playerCount: race.players.size,
        createdAt: race.createdAt
      }))
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes
const apiVersion = process.env.API_VERSION || 'v1';
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/tests`, testRoutes);
app.use(`/api/${apiVersion}/leaderboard`, leaderboardRoutes);
app.use(`/api/${apiVersion}/wordlists`, wordlistRoutes);
app.use(`/api/${apiVersion}/stats`, statsRoutes);
app.use(`/api/${apiVersion}/races`, raceRoutes);

// Socket.IO server setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
});

// Initialize Socket.IO handlers
setupSocketIO(io);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

httpServer.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
  logger.info(`🔌 WebSocket server ready for connections`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🛡️  Security features: ${JSON.stringify({
    helmet: true,
    cors: true,
    rateLimit: process.env.ENABLE_RATE_LIMITING === 'true',
    compression: process.env.ENABLE_COMPRESSION === 'true'
  })}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n🛑 Graceful shutdown initiated...');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = { app, httpServer, io };