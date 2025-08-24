const jwt = require('jsonwebtoken');
const rateLimit = require('../utils/rateLimiter');
const logger = require('../utils/logger');

// JWT secret - in production this should be from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

/**
 * Socket.IO authentication middleware
 * Validates JWT tokens and rate limits connections
 */
async function authMiddleware(socket, next) {
  try {
    // Extract token from auth object or query params
    const token = socket.handshake.auth?.token || 
                 socket.handshake.query?.token;

    if (!token) {
      logger.warn('WebSocket connection attempted without token', {
        ip: socket.handshake.address,
        socketId: socket.id
      });
      
      return next(new Error('AUTH_REQUIRED'));
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      logger.warn('Invalid JWT token provided', {
        ip: socket.handshake.address,
        socketId: socket.id,
        error: jwtError.message
      });
      
      return next(new Error('AUTH_INVALID'));
    }

    // Check if token has required fields
    if (!decoded.userId || !decoded.username) {
      logger.warn('JWT token missing required fields', {
        decoded,
        socketId: socket.id
      });
      
      return next(new Error('AUTH_INVALID'));
    }

    // Rate limiting per IP address
    const clientIP = socket.handshake.address;
    const rateLimitResult = await rateLimit.checkConnectionRate(clientIP);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Connection rate limit exceeded', {
        ip: clientIP,
        socketId: socket.id,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      });
      
      return next(new Error('RATE_LIMITED'));
    }

    // Check for duplicate connections (optional - you might want to allow multiple tabs)
    const maxConnectionsPerUser = parseInt(process.env.MAX_CONNECTIONS_PER_USER) || 5;
    const existingConnections = await countUserConnections(decoded.userId);
    
    if (existingConnections >= maxConnectionsPerUser) {
      logger.warn('Maximum connections per user exceeded', {
        userId: decoded.userId,
        username: decoded.username,
        existingConnections,
        maxAllowed: maxConnectionsPerUser
      });
      
      return next(new Error('TOO_MANY_CONNECTIONS'));
    }

    // Attach user info to socket
    socket.userId = decoded.userId;
    socket.userInfo = {
      username: decoded.username,
      avatar: decoded.avatar || null,
      premium: decoded.premium || false,
      role: decoded.role || 'user'
    };

    // Log successful authentication
    logger.info('WebSocket authentication successful', {
      userId: decoded.userId,
      username: decoded.username,
      socketId: socket.id,
      ip: clientIP
    });

    next();
    
  } catch (error) {
    logger.error('WebSocket authentication error', {
      socketId: socket.id,
      error: error.message,
      stack: error.stack
    });
    
    next(new Error('SERVER_ERROR'));
  }
}

/**
 * Count existing connections for a user
 * In a production environment, this might use Redis or a database
 */
async function countUserConnections(userId) {
  // This is a simple in-memory implementation
  // In production, you'd use Redis or similar for distributed systems
  const { activeConnections } = require('./index');
  
  let count = 0;
  for (const connection of activeConnections.values()) {
    if (connection.userId === userId) {
      count++;
    }
  }
  
  return count;
}

/**
 * Middleware to check if user has required permissions for an action
 */
function requirePermission(permission) {
  return (socket, next) => {
    const userRole = socket.userInfo?.role;
    
    // Simple role-based permissions
    const permissions = {
      admin: ['admin', 'moderate', 'user'],
      moderator: ['moderate', 'user'], 
      user: ['user']
    };
    
    if (!userRole || !permissions[userRole]?.includes(permission)) {
      logger.warn('Insufficient permissions for action', {
        userId: socket.userId,
        userRole,
        requiredPermission: permission,
        socketId: socket.id
      });
      
      return next(new Error('INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
}

/**
 * Middleware to validate event payload against schema
 */
function validatePayload(schema) {
  return (socket, data, next) => {
    const { error, value } = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      logger.warn('Payload validation failed', {
        userId: socket.userId,
        socketId: socket.id,
        validationErrors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
      
      socket.emit('validation_error', {
        field: error.details[0].path.join('.'),
        message: error.details[0].message
      });
      
      return;
    }
    
    // Replace original data with validated/sanitized version
    next(value);
  };
}

module.exports = authMiddleware;
module.exports.requirePermission = requirePermission;
module.exports.validatePayload = validatePayload;