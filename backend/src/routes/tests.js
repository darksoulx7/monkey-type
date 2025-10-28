const express = require('express');
const { TestSession, TestResult } = require('../models/Test');
const WordList = require('../models/WordList');
const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/auth');
const { 
  validateTestStart, 
  validateTestSubmission,
  validateKeystroke,
  validatePagination,
  validateUUIDParam
} = require('../middleware/validation');
const { AppError, asyncHandler } = require('../middleware/error');
const logger = require('../config/logger');

const router = express.Router();

// Test routes allow optional authentication for guest users

// @route   POST /api/v1/tests/start
// @desc    Start a new typing test session
// @access  Public (with optional auth for logged users)
router.post('/start', optionalAuth, validateTestStart, asyncHandler(async (req, res, next) => {
  const { mode, duration, wordCount, wordListId, language = 'english' } = req.body;
  
  let words = [];
  let selectedWordList = null;
  
  // Get words from word list or use default
  if (wordListId) {
    const accessConditions = [
      { isPublic: true },
      { isSystem: true }
    ];

    // Add user-specific condition if user is authenticated
    if (req.user) {
      accessConditions.push({ createdBy: req.user._id });
    }

    selectedWordList = await WordList.findOne({
      _id: wordListId,
      $or: accessConditions
    });
    
    if (!selectedWordList) {
      return next(new AppError('Word list not found or not accessible', 404, 'WORDLIST_NOT_FOUND'));
    }
    
    // Generate words based on test mode
    const wordCountNeeded = mode === 'words' ? wordCount : Math.ceil(duration * 3); // Estimate 3 words per second
    words = selectedWordList.generateTestWords({ count: wordCountNeeded, mode });
    
  } else {
    // Use default word list based on language
    const defaultWordList = await WordList.findOne({
      category: 'common',
      language: language.toLowerCase(),
      isSystem: true,
      isActive: true
    });
    
    if (!defaultWordList) {
      // Fallback to English if requested language not available
      const fallbackWordList = await WordList.findOne({
        category: 'common',
        language: 'english',
        isSystem: true,
        isActive: true
      });
      
      if (!fallbackWordList) {
        return next(new AppError('No word lists available', 500, 'NO_WORDLISTS_AVAILABLE'));
      }
      
      selectedWordList = fallbackWordList;
      logger.warn(`Language ${language} not available, using English fallback`);
    } else {
      selectedWordList = defaultWordList;
    }
    
    const wordCountNeeded = mode === 'words' ? wordCount : Math.ceil(duration * 3);
    words = selectedWordList.generateTestWords({ count: wordCountNeeded, mode });
  }
  
  // Create test session
  const testSession = await TestSession.create({
    userId: req.user?._id || null, // Allow null for guest users
    mode,
    duration: mode === 'time' ? duration : undefined,
    wordCount: mode === 'words' ? wordCount : undefined,
    wordListId: selectedWordList._id,
    language,
    words
  });

  logger.info(`🧪 Test session started: ${testSession._id} by ${req.user?.username || 'guest'} (${mode})`);
  
  res.status(201).json({
    status: 'success',
    message: 'Test session created successfully',
    data: {
      testSession: testSession.toJSON()
    }
  });
}));

// @route   POST /api/v1/tests/:testId/submit
// @desc    Submit typing test results
// @access  Private
router.post('/:testId/submit', validateTestSubmission, asyncHandler(async (req, res, next) => {
  const { testId } = req.params;
  const {
    completedText,
    keystrokes,
    duration,
    wpm,
    accuracy,
    consistency,
    errors
  } = req.body;
  
  // Find and validate test session
  const testSession = await TestSession.findById(testId);
  
  if (!testSession) {
    return next(new AppError('Test session not found', 404, 'TEST_SESSION_NOT_FOUND'));
  }
  
  if (testSession.userId !== req.user._id) {
    return next(new AppError('You can only submit your own test results', 403, 'TEST_OWNERSHIP_ERROR'));
  }
  
  if (testSession.status !== 'active') {
    return next(new AppError('Test session is not active', 400, 'TEST_SESSION_INACTIVE'));
  }
  
  // Check if test session has expired
  if (testSession.expiresAt < new Date()) {
    testSession.status = 'expired';
    await testSession.save();
    return next(new AppError('Test session has expired', 400, 'TEST_SESSION_EXPIRED'));
  }
  
  // Validate test duration (basic sanity check)
  const maxAllowedDuration = testSession.mode === 'time' 
    ? (testSession.duration * 1000) + 5000 // Allow 5 seconds buffer
    : 10 * 60 * 1000; // Max 10 minutes for word mode
    
  if (duration > maxAllowedDuration) {
    logger.security('test_duration_anomaly', {
      userId: req.user._id,
      testId,
      reportedDuration: duration,
      maxAllowed: maxAllowedDuration
    });
    return next(new AppError('Test duration exceeds allowed limit', 400, 'INVALID_TEST_DURATION'));
  }
  
  // Calculate character counts
  const targetText = testSession.words.join(' ');
  const correctChars = completedText.split('').filter((char, index) => char === targetText[index]).length;
  const incorrectChars = completedText.length - correctChars;
  
  // Basic validation of reported stats
  const calculatedAccuracy = completedText.length > 0 ? (correctChars / completedText.length) * 100 : 0;
  
  // Allow some tolerance for accuracy calculation differences
  if (Math.abs(accuracy - calculatedAccuracy) > 5) {
    logger.security('accuracy_mismatch', {
      userId: req.user._id,
      testId,
      reportedAccuracy: accuracy,
      calculatedAccuracy
    });
  }
  
  // Create test result
  const testResult = await TestResult.create({
    testSessionId: testId,
    userId: req.user._id,
    mode: testSession.mode,
    duration: testSession.duration,
    wordCount: testSession.wordCount,
    wpm,
    accuracy: Math.min(accuracy, calculatedAccuracy), // Use the more conservative accuracy
    consistency,
    errors: errors || incorrectChars,
    correctChars,
    incorrectChars,
    keystrokes,
    completedText,
    targetText,
    wordListId: testSession.wordListId,
    language: testSession.language
  });
  
  // Update test session
  testSession.status = 'completed';
  testSession.completedAt = new Date();
  testSession.keystrokes = keystrokes;
  testSession.completedText = completedText;
  await testSession.save();
  
  // Update user statistics
  await req.user.updateStats(testResult);
  
  // Update word list usage statistics if custom list was used
  if (testSession.wordListId) {
    const wordList = await WordList.findById(testSession.wordListId);
    if (wordList) {
      await wordList.updateUsageStats(wpm, accuracy);
    }
  }
  
  logger.performance('test_submission', Date.now() - new Date(testSession.startedAt).getTime());
  logger.info(`🎯 Test completed: ${req.user.username} - ${wpm} WPM, ${accuracy.toFixed(1)}% accuracy`);
  
  res.json({
    status: 'success',
    message: 'Test results submitted successfully',
    data: {
      result: testResult.toJSON()
    }
  });
}));

// @route   POST /api/v1/tests/:testId/keystroke
// @desc    Record keystroke data (backup to WebSocket)
// @access  Private
router.post('/:testId/keystroke', validateKeystroke, asyncHandler(async (req, res, next) => {
  const { testId } = req.params;
  const keystrokeData = req.body;
  
  // Find test session
  const testSession = await TestSession.findById(testId);
  
  if (!testSession) {
    return next(new AppError('Test session not found', 404, 'TEST_SESSION_NOT_FOUND'));
  }
  
  if (testSession.userId !== req.user._id) {
    return next(new AppError('You can only submit keystrokes for your own tests', 403, 'TEST_OWNERSHIP_ERROR'));
  }
  
  if (testSession.status !== 'active') {
    return next(new AppError('Test session is not active', 400, 'TEST_SESSION_INACTIVE'));
  }
  
  // Add keystroke to session (optional - mainly for backup)
  testSession.keystrokes.push(keystrokeData);
  
  // Limit keystroke history to prevent memory issues
  if (testSession.keystrokes.length > 10000) {
    testSession.keystrokes = testSession.keystrokes.slice(-5000);
  }
  
  await testSession.save();
  
  res.json({
    status: 'success',
    message: 'Keystroke recorded'
  });
}));

// @route   GET /api/v1/tests/history
// @desc    Get user's test history
// @access  Private
router.get('/history', validatePagination, [
  require('express-validator').query('mode')
    .optional()
    .isIn(['time', 'words'])
    .withMessage('Mode must be either time or words'),
  require('express-validator').query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),
  require('express-validator').query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date'),
  require('../middleware/validation').handleValidationErrors
], asyncHandler(async (req, res, next) => {
  const { limit = 20, offset = 0, mode, from, to } = req.query;
  
  const filters = {};
  if (mode) filters.mode = mode;
  if (from) filters.from = from;
  if (to) filters.to = to;
  
  const tests = await TestResult.getUserHistory(req.user._id, filters)
    .limit(parseInt(limit))
    .skip(parseInt(offset));
  
  // Get summary statistics for the filtered results
  const summaryPipeline = [
    { $match: { userId: req.user._id, ...filters } },
    {
      $group: {
        _id: null,
        totalTests: { $sum: 1 },
        averageWpm: { $avg: '$wpm' },
        bestWpm: { $max: '$wpm' },
        averageAccuracy: { $avg: '$accuracy' }
      }
    }
  ];
  
  const summaryResult = await TestResult.aggregate(summaryPipeline);
  const summary = summaryResult[0] || {
    totalTests: 0,
    averageWpm: 0,
    bestWpm: 0,
    averageAccuracy: 0
  };
  
  // Get total count for pagination
  const totalCount = await TestResult.countDocuments({
    userId: req.user._id,
    ...filters
  });
  
  res.json({
    status: 'success',
    data: {
      tests: tests.map(test => test.toJSON()),
      summary: {
        totalTests: summary.totalTests,
        averageWpm: Math.round(summary.averageWpm * 10) / 10,
        bestWpm: Math.round(summary.bestWpm * 10) / 10,
        averageAccuracy: Math.round(summary.averageAccuracy * 10) / 10
      },
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + tests.length < totalCount
      }
    }
  });
}));

// @route   GET /api/v1/tests/:testId
// @desc    Get test details
// @access  Private (or public for specific test results)
router.get('/:testId', optionalAuth, validateUUIDParam('testId'), asyncHandler(async (req, res, next) => {
  const { testId } = req.params;
  
  // Find test result
  const testResult = await TestResult.findById(testId)
    .populate('userId', 'username createdAt')
    .lean();
  
  if (!testResult) {
    return next(new AppError('Test not found', 404, 'TEST_NOT_FOUND'));
  }
  
  // Check if user can access this test
  const canAccess = !req.user || 
    req.user._id === testResult.userId._id ||
    req.user.role === 'admin';
  
  if (!canAccess) {
    // Return limited public info for non-owners
    const publicResult = {
      id: testResult._id,
      mode: testResult.mode,
      duration: testResult.duration,
      wordCount: testResult.wordCount,
      wpm: testResult.wpm,
      accuracy: testResult.accuracy,
      consistency: testResult.consistency,
      completedAt: testResult.createdAt,
      user: {
        id: testResult.userId._id,
        username: testResult.userId.username
      },
      rank: testResult.rank,
      percentile: testResult.percentile,
      isPersonalBest: testResult.isPersonalBest
    };
    
    return res.json({
      status: 'success',
      data: {
        result: publicResult
      }
    });
  }
  
  // Return full test details for owner
  res.json({
    status: 'success',
    data: {
      result: {
        ...testResult,
        userId: testResult.userId._id,
        user: testResult.userId,
        completedAt: testResult.createdAt
      }
    }
  });
}));

// @route   GET /api/v1/tests/session/:testId
// @desc    Get active test session details
// @access  Private
router.get('/session/:testId', validateUUIDParam('testId'), asyncHandler(async (req, res, next) => {
  const { testId } = req.params;
  
  const testSession = await TestSession.findById(testId);
  
  if (!testSession) {
    return next(new AppError('Test session not found', 404, 'TEST_SESSION_NOT_FOUND'));
  }
  
  if (testSession.userId !== req.user._id) {
    return next(new AppError('You can only access your own test sessions', 403, 'TEST_OWNERSHIP_ERROR'));
  }
  
  res.json({
    status: 'success',
    data: {
      testSession: testSession.toJSON()
    }
  });
}));

// @route   DELETE /api/v1/tests/:testId
// @desc    Delete test result (soft delete by marking as inactive)
// @access  Private
router.delete('/:testId', validateUUIDParam('testId'), asyncHandler(async (req, res, next) => {
  const { testId } = req.params;
  
  const testResult = await TestResult.findById(testId);
  
  if (!testResult) {
    return next(new AppError('Test not found', 404, 'TEST_NOT_FOUND'));
  }
  
  if (testResult.userId !== req.user._id && req.user.role !== 'admin') {
    return next(new AppError('You can only delete your own tests', 403, 'TEST_OWNERSHIP_ERROR'));
  }
  
  // Instead of deleting, we could mark as deleted or actually delete
  await TestResult.findByIdAndDelete(testId);
  
  // Also delete associated test session
  await TestSession.findByIdAndDelete(testResult.testSessionId);
  
  logger.info(`🗑️  Test deleted: ${testId} by ${req.user.username}`);
  
  res.json({
    status: 'success',
    message: 'Test deleted successfully'
  });
}));

// @route   GET /api/v1/tests/stats/recent
// @desc    Get recent test statistics
// @access  Private
router.get('/stats/recent', asyncHandler(async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  
  // Get recent tests with basic stats
  const recentTests = await TestResult.find({ userId: req.user._id })
    .select('wpm accuracy consistency createdAt mode duration wordCount')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  
  // Calculate trends
  let wpmTrend = 0;
  let accuracyTrend = 0;
  
  if (recentTests.length >= 5) {
    const recent5 = recentTests.slice(0, 5);
    const previous5 = recentTests.slice(5, 10);
    
    if (previous5.length > 0) {
      const recentAvgWpm = recent5.reduce((sum, test) => sum + test.wpm, 0) / recent5.length;
      const previousAvgWpm = previous5.reduce((sum, test) => sum + test.wpm, 0) / previous5.length;
      wpmTrend = recentAvgWpm - previousAvgWpm;
      
      const recentAvgAcc = recent5.reduce((sum, test) => sum + test.accuracy, 0) / recent5.length;
      const previousAvgAcc = previous5.reduce((sum, test) => sum + test.accuracy, 0) / previous5.length;
      accuracyTrend = recentAvgAcc - previousAvgAcc;
    }
  }
  
  res.json({
    status: 'success',
    data: {
      recentTests: recentTests.map(test => ({
        ...test,
        id: test._id,
        completedAt: test.createdAt
      })),
      trends: {
        wpmTrend: Math.round(wpmTrend * 10) / 10,
        accuracyTrend: Math.round(accuracyTrend * 10) / 10
      }
    }
  });
}));

module.exports = router;