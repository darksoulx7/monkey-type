const Joi = require('joi');
const rateLimiter = require('../utils/rateLimiter');
const logger = require('../utils/logger');
const {
  generateSessionId,
  calculateTypingStats,
  validateKeystroke,
  emitError,
  emitRateLimitError,
  safeEmit,
  generateWords
} = require('../utils/socketHelpers');

// Joi schemas for validation
const testJoinSchema = Joi.object({
  testId: Joi.string().required(),
  mode: Joi.string().valid('time', 'words').optional(),
  duration: Joi.number().min(15).max(300).optional(),
  wordCount: Joi.number().min(10).max(200).optional(),
  wordListId: Joi.string().optional().default('common-words')
});

const keystrokeSchema = Joi.object({
  testId: Joi.string().required(),
  timestamp: Joi.number().min(0).required(),
  key: Joi.string().length(1).required(),
  correct: Joi.boolean().required(),
  position: Joi.number().min(0).required(),
  currentText: Joi.string().optional()
});

const testCompletedSchema = Joi.object({
  testId: Joi.string().required(),
  finalStats: Joi.object({
    wpm: Joi.number().min(0).required(),
    accuracy: Joi.number().min(0).max(100).required(),
    consistency: Joi.number().min(0).max(100).optional(),
    errors: Joi.number().min(0).required(),
    timeElapsed: Joi.number().min(0).required()
  }).required()
});

/**
 * Initialize typing test event handlers
 */
function initializeTestEvents(socket, io, activeTestSessions) {
  
  // Handle test join
  socket.on('test:join', async (data) => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // Validate payload
      const { error, value } = testJoinSchema.validate(data);
      if (error) {
        return emitError(socket, 3001, 'VALIDATION_ERROR', 
          'Invalid test join data', error.details[0].message);
      }

      const { testId } = value;
      
      // Check if test session already exists
      let testSession = activeTestSessions.get(testId);
      
      if (!testSession) {
        // Create new test session
        testSession = {
          testId,
          userId: socket.userId,
          userInfo: socket.userInfo,
          mode: value.mode || 'time',
          duration: value.duration || 60,
          wordCount: value.wordCount || 50,
          words: generateWords(value.wordCount || 50),
          keystrokes: [],
          startTime: null,
          endTime: null,
          isCompleted: false,
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        activeTestSessions.set(testId, testSession);
        
        logger.info('New test session created', {
          testId,
          userId: socket.userId,
          mode: testSession.mode
        });
      } else if (testSession.userId !== socket.userId) {
        return emitError(socket, 3002, 'ACCESS_DENIED', 
          'Cannot join another user\'s test session');
      }

      // Join the test room
      socket.join(`test:${testId}`);
      
      // Send confirmation
      safeEmit(socket, 'test:joined', {
        testId,
        words: testSession.words,
        mode: testSession.mode,
        duration: testSession.duration,
        wordCount: testSession.wordCount,
        isActive: !!testSession.startTime && !testSession.endTime
      });

      logger.info('User joined test session', {
        testId,
        userId: socket.userId,
        username: socket.userInfo.username
      });

    } catch (error) {
      logger.error('Error handling test:join', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to join test session');
    }
  });

  // Handle keystroke events
  socket.on('test:keystroke', async (data) => {
    try {
      // Rate limiting for keystrokes (20 per second)
      const rateLimitResult = await rateLimiter.checkKeystrokeRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // Validate payload
      const { error, value } = keystrokeSchema.validate(data);
      if (error) {
        return emitError(socket, 3001, 'VALIDATION_ERROR', 
          'Invalid keystroke data', error.details[0].message);
      }

      const { testId, timestamp, key, correct, position, currentText } = value;
      
      // Get test session
      const testSession = activeTestSessions.get(testId);
      if (!testSession) {
        return emitError(socket, 3001, 'TEST_NOT_FOUND', 'Test session not found');
      }

      // Verify ownership
      if (testSession.userId !== socket.userId) {
        return emitError(socket, 3002, 'ACCESS_DENIED', 'Not your test session');
      }

      // Check if test is completed
      if (testSession.isCompleted) {
        return emitError(socket, 3003, 'TEST_COMPLETED', 'Test session is already completed');
      }

      // Set start time on first keystroke
      if (!testSession.startTime) {
        testSession.startTime = new Date();
        logger.info('Test session started', { testId, userId: socket.userId });
      }

      // Add keystroke to session
      const keystrokeData = {
        timestamp,
        key,
        correct,
        position,
        currentText: currentText || '',
        serverTimestamp: Date.now()
      };
      
      testSession.keystrokes.push(keystrokeData);
      testSession.lastActivity = new Date();

      // Calculate current stats
      const timeElapsed = Date.now() - testSession.startTime.getTime();
      const stats = calculateTypingStats(testSession.keystrokes, testSession.words, timeElapsed);

      // Create stats update
      const statsUpdate = {
        testId,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        consistency: stats.consistency,
        errors: stats.errors,
        position: stats.position,
        timeElapsed,
        correctChars: stats.correctChars,
        incorrectChars: stats.incorrectChars
      };

      // Send real-time stats update
      safeEmit(socket, 'test:stats_update', statsUpdate);

      // Check for auto-completion conditions
      let shouldComplete = false;
      
      if (testSession.mode === 'time' && timeElapsed >= testSession.duration * 1000) {
        shouldComplete = true;
      } else if (testSession.mode === 'words' && position >= testSession.words.length) {
        shouldComplete = true;
      }

      if (shouldComplete) {
        await completeTestSession(socket, testSession, io);
      }

    } catch (error) {
      logger.error('Error handling test:keystroke', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to process keystroke');
    }
  });

  // Handle test completion
  socket.on('test:completed', async (data) => {
    try {
      // Validate payload
      const { error, value } = testCompletedSchema.validate(data);
      if (error) {
        return emitError(socket, 3001, 'VALIDATION_ERROR', 
          'Invalid test completion data', error.details[0].message);
      }

      const { testId, finalStats } = value;
      
      // Get test session
      const testSession = activeTestSessions.get(testId);
      if (!testSession) {
        return emitError(socket, 3001, 'TEST_NOT_FOUND', 'Test session not found');
      }

      // Verify ownership
      if (testSession.userId !== socket.userId) {
        return emitError(socket, 3002, 'ACCESS_DENIED', 'Not your test session');
      }

      // Complete the test session
      await completeTestSession(socket, testSession, io, finalStats);

    } catch (error) {
      logger.error('Error handling test:completed', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to complete test');
    }
  });

  // Handle leaving test session
  socket.on('test:leave', async (data) => {
    try {
      const testId = data?.testId;
      if (!testId) {
        return emitError(socket, 3001, 'VALIDATION_ERROR', 'testId is required');
      }

      // Leave the room
      socket.leave(`test:${testId}`);

      // Clean up session if it belongs to this user
      const testSession = activeTestSessions.get(testId);
      if (testSession && testSession.userId === socket.userId) {
        activeTestSessions.delete(testId);
        
        logger.info('Test session cleaned up', {
          testId,
          userId: socket.userId
        });
      }

    } catch (error) {
      logger.error('Error handling test:leave', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    }
  });
}

/**
 * Complete a test session and send results
 */
async function completeTestSession(socket, testSession, io, providedStats = null) {
  try {
    if (testSession.isCompleted) {
      return; // Already completed
    }

    testSession.endTime = new Date();
    testSession.isCompleted = true;

    const totalTime = testSession.endTime.getTime() - testSession.startTime.getTime();
    
    // Calculate final stats
    const finalStats = providedStats || calculateTypingStats(
      testSession.keystrokes, 
      testSession.words, 
      totalTime
    );

    // TODO: Save to database here
    // await saveTestResult(testSession, finalStats);

    // Create test result
    const result = {
      testId: testSession.testId,
      wpm: finalStats.wpm,
      accuracy: finalStats.accuracy,
      consistency: finalStats.consistency || 0,
      errors: finalStats.errors,
      timeElapsed: totalTime,
      mode: testSession.mode,
      wordCount: testSession.mode === 'words' ? testSession.wordCount : null,
      duration: testSession.mode === 'time' ? testSession.duration : null,
      completedAt: testSession.endTime.toISOString(),
      // TODO: Add ranking/percentile data
      globalRank: null,
      percentile: null,
      improvement: null
    };

    // Send result to user
    safeEmit(socket, 'test:result', result);

    // Notify friends about test completion
    io.emit('friend:test_completed', {
      userId: socket.userId,
      username: socket.userInfo.username,
      wpm: finalStats.wpm,
      accuracy: finalStats.accuracy,
      testResult: result
    });

    logger.info('Test session completed', {
      testId: testSession.testId,
      userId: socket.userId,
      wpm: finalStats.wpm,
      accuracy: finalStats.accuracy
    });

    // Clean up session after a delay
    setTimeout(() => {
      activeTestSessions.delete(testSession.testId);
    }, 30000); // Keep for 30 seconds for any final requests

  } catch (error) {
    logger.error('Error completing test session', {
      testId: testSession.testId,
      userId: socket.userId,
      error: error.message
    });
    
    emitError(socket, 5001, 'SERVER_ERROR', 'Failed to complete test session');
  }
}

module.exports = initializeTestEvents;