const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * WebSocket utility functions for common operations
 */

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return uuidv4();
}

/**
 * Calculate typing statistics from keystroke data
 */
function calculateTypingStats(keystrokes, text, timeElapsed) {
  if (!keystrokes.length || timeElapsed <= 0) {
    return {
      wpm: 0,
      accuracy: 100,
      consistency: 0,
      errors: 0,
      correctChars: 0,
      incorrectChars: 0
    };
  }

  const totalKeystrokes = keystrokes.length;
  const correctKeystrokes = keystrokes.filter(k => k.correct).length;
  const incorrectKeystrokes = totalKeystrokes - correctKeystrokes;
  
  // Calculate WPM (Words Per Minute)
  // Standard: 1 word = 5 characters, including spaces
  const charactersTyped = Math.max(keystrokes.length, 1);
  const minutes = timeElapsed / (1000 * 60);
  const wpm = Math.round((charactersTyped / 5) / minutes);
  
  // Calculate accuracy
  const accuracy = Math.round((correctKeystrokes / totalKeystrokes) * 100);
  
  // Calculate consistency (based on WPM variance over time)
  const consistency = calculateConsistency(keystrokes, timeElapsed);
  
  return {
    wpm: Math.max(0, wpm),
    accuracy: Math.max(0, Math.min(100, accuracy)),
    consistency: Math.max(0, Math.min(100, consistency)),
    errors: incorrectKeystrokes,
    correctChars: correctKeystrokes,
    incorrectChars: incorrectKeystrokes,
    position: keystrokes.length
  };
}

/**
 * Calculate typing consistency based on WPM variance over time windows
 */
function calculateConsistency(keystrokes, timeElapsed) {
  if (keystrokes.length < 10) return 0; // Need minimum keystrokes for consistency
  
  const windowSize = 2000; // 2-second windows
  const windows = [];
  
  // Split keystrokes into time windows
  for (let windowStart = 0; windowStart < timeElapsed; windowStart += windowSize) {
    const windowEnd = windowStart + windowSize;
    const windowKeystrokes = keystrokes.filter(k => 
      k.timestamp >= windowStart && k.timestamp < windowEnd
    );
    
    if (windowKeystrokes.length > 0) {
      const windowWpm = (windowKeystrokes.length / 5) / (windowSize / (1000 * 60));
      windows.push(windowWpm);
    }
  }
  
  if (windows.length < 2) return 0;
  
  // Calculate coefficient of variation (lower = more consistent)
  const mean = windows.reduce((a, b) => a + b, 0) / windows.length;
  const variance = windows.reduce((acc, wpm) => acc + Math.pow(wpm - mean, 2), 0) / windows.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  // Convert to consistency percentage (100 - CV * 100, capped at 0-100)
  return Math.max(0, Math.min(100, Math.round(100 - coefficientOfVariation * 100)));
}

/**
 * Validate keystroke event data
 */
function validateKeystroke(keystroke) {
  const required = ['testId', 'timestamp', 'key', 'correct', 'position'];
  
  for (const field of required) {
    if (keystroke[field] === undefined || keystroke[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  
  // Type validations
  if (typeof keystroke.testId !== 'string') {
    return { valid: false, error: 'testId must be a string' };
  }
  
  if (typeof keystroke.timestamp !== 'number' || keystroke.timestamp < 0) {
    return { valid: false, error: 'timestamp must be a positive number' };
  }
  
  if (typeof keystroke.key !== 'string' || keystroke.key.length !== 1) {
    return { valid: false, error: 'key must be a single character string' };
  }
  
  if (typeof keystroke.correct !== 'boolean') {
    return { valid: false, error: 'correct must be a boolean' };
  }
  
  if (typeof keystroke.position !== 'number' || keystroke.position < 0) {
    return { valid: false, error: 'position must be a non-negative number' };
  }
  
  return { valid: true };
}

/**
 * Create error response for WebSocket events
 */
function createErrorResponse(code, type, message, details = null) {
  return {
    code,
    type,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Emit error to socket with logging
 */
function emitError(socket, code, type, message, details = null) {
  const error = createErrorResponse(code, type, message, details);
  
  logger.warn('Socket error emitted', {
    socketId: socket.id,
    userId: socket.userId,
    error
  });
  
  socket.emit('error', error);
}

/**
 * Emit rate limit error
 */
function emitRateLimitError(socket, retryAfter = null) {
  emitError(socket, 4001, 'RATE_LIMITED', 'Rate limit exceeded', {
    retryAfter: retryAfter ? Math.ceil(retryAfter / 1000) : null
  });
}

/**
 * Safe emit that catches errors
 */
function safeEmit(socket, event, data) {
  try {
    socket.emit(event, data);
  } catch (error) {
    logger.error('Error emitting socket event', {
      socketId: socket.id,
      userId: socket.userId,
      event,
      error: error.message
    });
  }
}

/**
 * Safe broadcast that catches errors
 */
function safeBroadcast(io, room, event, data, excludeSocket = null) {
  try {
    const emitter = excludeSocket ? 
      excludeSocket.to(room) : 
      io.to(room);
    emitter.emit(event, data);
  } catch (error) {
    logger.error('Error broadcasting socket event', {
      room,
      event,
      error: error.message
    });
  }
}

/**
 * Get user's socket instances
 */
function getUserSockets(io, userId) {
  const sockets = [];
  
  for (const [socketId, socket] of io.sockets.sockets) {
    if (socket.userId === userId) {
      sockets.push(socket);
    }
  }
  
  return sockets;
}

/**
 * Check if user is online
 */
function isUserOnline(io, userId) {
  return getUserSockets(io, userId).length > 0;
}

/**
 * Generate race room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate race configuration
 */
function validateRaceConfig(config) {
  const errors = [];
  
  if (!config.name || typeof config.name !== 'string' || config.name.length > 50) {
    errors.push('Race name must be a string (max 50 characters)');
  }
  
  if (!['time', 'words'].includes(config.mode)) {
    errors.push('Race mode must be either "time" or "words"');
  }
  
  if (config.mode === 'time') {
    if (!config.duration || config.duration < 15 || config.duration > 300) {
      errors.push('Race duration must be between 15 and 300 seconds');
    }
  }
  
  if (config.mode === 'words') {
    if (!config.wordCount || config.wordCount < 10 || config.wordCount > 200) {
      errors.push('Word count must be between 10 and 200');
    }
  }
  
  if (!config.maxPlayers || config.maxPlayers < 2 || config.maxPlayers > 20) {
    errors.push('Max players must be between 2 and 20');
  }
  
  return errors;
}

/**
 * Generate random word sequence
 * TODO: Replace with actual word list integration
 */
function generateWords(count = 50) {
  const commonWords = [
    'the', 'of', 'and', 'to', 'a', 'in', 'is', 'it', 'you', 'that',
    'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'I',
    'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word',
    'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said',
    'there', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up'
  ];
  
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(commonWords[Math.floor(Math.random() * commonWords.length)]);
  }
  
  return words.join(' ');
}

module.exports = {
  generateSessionId,
  calculateTypingStats,
  validateKeystroke,
  createErrorResponse,
  emitError,
  emitRateLimitError,
  safeEmit,
  safeBroadcast,
  getUserSockets,
  isUserOnline,
  generateRoomCode,
  validateRaceConfig,
  generateWords
};