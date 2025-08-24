const authMiddleware = require('./middleware');
const testEvents = require('./testEvents');
const raceEvents = require('./raceEvents');
const friendEvents = require('./friendEvents');
const logger = require('../utils/logger');
const performanceMonitor = require('../utils/performanceMonitor');

// Store active connections and sessions
const activeConnections = new Map();
const activeTestSessions = new Map();
const activeRaces = new Map();

function setupSocketIO(io) {
  // Apply authentication middleware
  io.use(authMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userInfo = socket.userInfo;
    
    // Record performance metrics
    performanceMonitor.recordConnection();
    
    logger.info(`User connected: ${userInfo.username} (${userId})`, {
      socketId: socket.id,
      userId
    });

    // Store connection info
    activeConnections.set(socket.id, {
      userId,
      userInfo,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    // Update user's online status
    socket.broadcast.emit('friend:online', {
      userId,
      username: userInfo.username,
      avatar: userInfo.avatar
    });

    // Join user to their personal room for targeted messages
    socket.join(`user:${userId}`);

    // Handle connection events
    socket.on('disconnect', async (reason) => {
      // Record performance metrics
      performanceMonitor.recordDisconnection();
      
      logger.info(`User disconnected: ${userInfo.username} (${userId})`, {
        socketId: socket.id,
        reason,
        userId
      });

      // Clean up active sessions
      await cleanupUserSessions(userId, socket);

      // Remove from active connections
      activeConnections.delete(socket.id);

      // Broadcast offline status after a brief delay
      // (in case user reconnects quickly)
      setTimeout(() => {
        const stillConnected = Array.from(activeConnections.values())
          .some(conn => conn.userId === userId);
        
        if (!stillConnected) {
          socket.broadcast.emit('friend:offline', {
            userId,
            username: userInfo.username
          });
        }
      }, 5000);
    });

    // Update last activity on any event and record metrics
    socket.use((packet, next) => {
      const startTime = Date.now();
      
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
      }
      
      // Record event metrics
      const eventName = packet[0];
      performanceMonitor.recordEvent(eventName);
      
      // Measure latency for event processing
      const originalNext = next;
      next = (...args) => {
        const latency = Date.now() - startTime;
        performanceMonitor.recordLatency(latency);
        originalNext.apply(this, args);
      };
      
      next();
    });

    // Initialize event handlers
    testEvents(socket, io, activeTestSessions);
    raceEvents(socket, io, activeRaces);
    friendEvents(socket, io, activeConnections);

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Generic error handler
    socket.on('error', (error) => {
      logger.error('Socket error:', {
        socketId: socket.id,
        userId,
        error: error.message
      });
      
      socket.emit('error', {
        code: 5001,
        type: 'SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    });
  });

  // Monitor connection health
  setInterval(() => {
    const now = new Date();
    let staleConnections = 0;

    for (const [socketId, connection] of activeConnections) {
      const timeSinceActivity = now - connection.lastActivity;
      
      // Mark connections stale after 5 minutes of inactivity
      if (timeSinceActivity > 5 * 60 * 1000) {
        staleConnections++;
      }
    }

    logger.info(`Connection health check`, {
      totalConnections: activeConnections.size,
      staleConnections,
      activeTests: activeTestSessions.size,
      activeRaces: activeRaces.size
    });
  }, 60000); // Check every minute

  logger.info('Socket.IO server initialized successfully');
}

async function cleanupUserSessions(userId, socket) {
  try {
    // Clean up test sessions
    for (const [testId, session] of activeTestSessions) {
      if (session.userId === userId) {
        activeTestSessions.delete(testId);
        socket.leave(`test:${testId}`);
      }
    }

    // Clean up race sessions
    for (const [raceId, race] of activeRaces) {
      if (race.players.has(userId)) {
        race.players.delete(userId);
        socket.leave(`race:${raceId}`);
        
        // Notify other players
        socket.to(`race:${raceId}`).emit('race:player_left', {
          playerId: userId,
          username: socket.userInfo.username
        });

        // Remove empty races
        if (race.players.size === 0) {
          activeRaces.delete(raceId);
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up user sessions:', {
      userId,
      error: error.message
    });
  }
}

// Export for external access
module.exports = setupSocketIO;
module.exports.activeConnections = activeConnections;
module.exports.activeTestSessions = activeTestSessions;
module.exports.activeRaces = activeRaces;