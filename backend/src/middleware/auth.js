const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('./error');
const logger = require('../config/logger');

// Generate JWT token
const generateToken = (userId, expiresIn = process.env.JWT_EXPIRES_IN) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );
};

// Verify JWT token
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  return jwt.verify(token, secret);
};

// Create and send token response
const createSendToken = async (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  
  // Add refresh token to user's token list
  await user.addRefreshToken(refreshToken);
  
  // Remove password from output
  user.password = undefined;
  
  const tokenResponse = {
    accessToken: token,
    refreshToken: refreshToken,
    expiresIn: jwt.decode(token).exp
  };
  
  res.status(statusCode).json({
    status: 'success',
    message,
    user: user.toJSON(),
    tokens: tokenResponse
  });
};

// Middleware to protect routes (require authentication)
const protect = asyncHandler(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }
  
  if (!token) {
    logger.security('auth_required', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    return next(new AppError('You are not logged in! Please log in to get access.', 401, 'AUTH_REQUIRED'));
  }
  
  try {
    // 2) Verification token
    const decoded = verifyToken(token);
    
    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.userId).select('+password');
    if (!currentUser) {
      logger.security('user_not_found', { 
        userId: decoded.userId,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return next(new AppError('The user belonging to this token does no longer exist.', 401, 'USER_NOT_FOUND'));
    }
    
    // 4) Check if user is active
    if (!currentUser.isActive) {
      logger.security('inactive_user', { 
        userId: decoded.userId,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      return next(new AppError('Your account has been deactivated. Please contact support.', 401, 'ACCOUNT_DEACTIVATED'));
    }
    
    // 5) Check if user changed password after the token was issued (optional enhancement)
    // This would require adding a passwordChangedAt field to the User model
    
    // Grant access to protected route
    req.user = currentUser;
    res.locals.user = currentUser;
    
    logger.debug(`🔐 User ${currentUser._id} authenticated for ${req.method} ${req.originalUrl}`);
    
    next();
  } catch (error) {
    logger.security('auth_failed', { 
      error: error.name,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });
    
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401, 'TOKEN_EXPIRED'));
    }
    
    return next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
  }
});

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }
  
  if (token) {
    try {
      const decoded = verifyToken(token);
      const currentUser = await User.findById(decoded.userId);
      
      if (currentUser && currentUser.isActive) {
        req.user = currentUser;
        res.locals.user = currentUser;
      }
    } catch (error) {
      // Silently fail for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
  }
  
  next();
});

// Middleware to restrict to certain roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logger.security('insufficient_permissions', {
        userId: req.user._id,
        requiredRoles: roles,
        userRole: req.user.role,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      return next(new AppError('You do not have permission to perform this action', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    next();
  };
};

// Middleware to check if user owns resource
const requireOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[resourceField] || req.body[resourceField] || req.resource?.[resourceField];
    
    if (!resourceUserId) {
      return next(new AppError('Resource owner not specified', 400, 'RESOURCE_OWNER_REQUIRED'));
    }
    
    // Allow if user is admin or owns the resource
    if (req.user.role === 'admin' || req.user._id === resourceUserId) {
      return next();
    }
    
    logger.security('ownership_violation', {
      userId: req.user._id,
      resourceUserId,
      endpoint: req.originalUrl,
      ip: req.ip
    });
    
    return next(new AppError('You can only access your own resources', 403, 'ACCESS_DENIED'));
  };
};

// Refresh token middleware
const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken: token } = req.body;
  
  if (!token) {
    return next(new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED'));
  }
  
  try {
    // Verify refresh token
    const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return next(new AppError('Invalid token type', 400, 'INVALID_TOKEN_TYPE'));
    }
    
    // Find user and check if refresh token exists
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(new AppError('User not found or inactive', 404, 'USER_NOT_FOUND'));
    }
    
    if (!user.hasValidRefreshToken(token)) {
      logger.security('invalid_refresh_token', {
        userId: user._id,
        ip: req.ip
      });
      return next(new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN'));
    }
    
    // Generate new tokens
    const newAccessToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    
    // Replace old refresh token with new one
    await user.removeRefreshToken(token);
    await user.addRefreshToken(newRefreshToken);
    
    logger.auth('token_refreshed', user._id, req.ip, req.get('User-Agent'));
    
    res.json({
      status: 'success',
      message: 'Token refreshed successfully',
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: jwt.decode(newAccessToken).exp
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Refresh token has expired', 401, 'REFRESH_TOKEN_EXPIRED'));
    }
    
    return next(error);
  }
});

// API Key authentication middleware (for service-to-service communication)
const apiKeyAuth = asyncHandler(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new AppError('API key is required', 401, 'API_KEY_REQUIRED'));
  }
  
  // In production, store API keys in database with proper permissions
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.security('invalid_api_key', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      endpoint: req.originalUrl
    });
    return next(new AppError('Invalid API key', 401, 'INVALID_API_KEY'));
  }
  
  // Set service flag
  req.isServiceRequest = true;
  
  next();
});

// Rate limiting per user (more granular than IP-based)
const createUserRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    if (userRequests.has(userId)) {
      const userRequestTimes = userRequests.get(userId).filter(time => time > windowStart);
      userRequests.set(userId, userRequestTimes);
    } else {
      userRequests.set(userId, []);
    }
    
    const currentRequests = userRequests.get(userId);
    
    if (currentRequests.length >= maxRequests) {
      logger.rateLimit(userId, req.originalUrl, maxRequests);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 60000} minutes.`,
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((currentRequests[0] + windowMs - now) / 1000)
      });
    }
    
    currentRequests.push(now);
    next();
  };
};

// Logout middleware
const logout = asyncHandler(async (req, res, next) => {
  const { refreshToken: token } = req.body;
  
  if (token && req.user) {
    // Remove refresh token from user
    await req.user.removeRefreshToken(token);
  }
  
  logger.auth('logout', req.user?._id, req.ip, req.get('User-Agent'));
  
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  createSendToken,
  protect,
  optionalAuth,
  restrictTo,
  requireOwnership,
  refreshToken,
  apiKeyAuth,
  createUserRateLimit,
  logout
};