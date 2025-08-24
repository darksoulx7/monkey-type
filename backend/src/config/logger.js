const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Configure transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

// File transports for production
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE) {
  // General log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info',
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  );
}

// Add custom colors for log levels
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
});

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => {
    // Remove trailing newline
    logger.http(message.trim());
  }
};

// Performance logging helper
logger.performance = (operation, startTime) => {
  const duration = Date.now() - startTime;
  logger.debug(`⏱️  ${operation} completed in ${duration}ms`);
};

// Database operation logging helper
logger.database = (operation, collection, query = {}) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug(`📊 DB ${operation} on ${collection}:`, JSON.stringify(query));
  }
};

// WebSocket logging helper
logger.websocket = (event, userId, data = {}) => {
  logger.debug(`🔌 WebSocket [${event}] User: ${userId}`, JSON.stringify(data));
};

// Authentication logging helper
logger.auth = (action, userId, ip, userAgent) => {
  logger.info(`🔐 Auth [${action}] User: ${userId} IP: ${ip} UA: ${userAgent}`);
};

// Rate limiting logging helper
logger.rateLimit = (ip, endpoint, limit) => {
  logger.warn(`⚠️  Rate limit exceeded - IP: ${ip} Endpoint: ${endpoint} Limit: ${limit}`);
};

// Security logging helper
logger.security = (event, details) => {
  logger.warn(`🚨 Security [${event}]:`, JSON.stringify(details));
};

module.exports = logger;