const express = require('express');
const router = express.Router();
const { protect: authenticateToken } = require('../middleware/auth');
const Test = require('../models/Test');
const User = require('../models/User');

// Get user statistics overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { period = 'allTime' } = req.query;
    
    // Period filtering
    let dateFilter = {};
    if (period !== 'allTime') {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'weekly':
          const weekStart = now.getDate() - now.getDay();
          startDate = new Date(now.getFullYear(), now.getMonth(), weekStart);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      if (startDate) dateFilter.completedAt = { $gte: startDate };
    }

    const filters = { userId: req.user.id, ...dateFilter };

    // Get user summary stats
    const user = await User.findById(req.user.id);
    const tests = await Test.find(filters).sort({ completedAt: -1 });
    
    const summary = {
      totalTests: tests.length,
      averageWpm: tests.length > 0 ? tests.reduce((sum, test) => sum + test.wpm, 0) / tests.length : 0,
      bestWpm: tests.length > 0 ? Math.max(...tests.map(test => test.wpm)) : 0,
      averageAccuracy: tests.length > 0 ? tests.reduce((sum, test) => sum + test.accuracy, 0) / tests.length : 0,
      totalTimeTyped: tests.reduce((sum, test) => sum + (test.duration || 0), 0),
      consistency: tests.length > 0 ? tests.reduce((sum, test) => sum + test.consistency, 0) / tests.length : 0
    };

    // Get recent tests (last 10)
    const recentTests = tests.slice(0, 10);

    // Mock achievements for now
    const achievements = [
      {
        id: 'first_test',
        name: 'First Steps',
        description: 'Complete your first typing test',
        icon: '🎯',
        unlockedAt: user.createdAt
      }
    ];

    // Calculate streaks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let checkDate = new Date(today);

    // Simple streak calculation
    const testDates = tests.map(test => {
      const date = new Date(test.completedAt);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    const uniqueDates = [...new Set(testDates)].sort((a, b) => b - a);
    
    for (let i = 0; i < uniqueDates.length; i++) {
      const testDate = new Date(uniqueDates[i]);
      if (i === 0) {
        if (testDate.getTime() === today.getTime() || 
            testDate.getTime() === today.getTime() - 24 * 60 * 60 * 1000) {
          currentStreak = 1;
          tempStreak = 1;
        }
      } else {
        const prevDate = new Date(uniqueDates[i - 1]);
        if (prevDate.getTime() - testDate.getTime() === 24 * 60 * 60 * 1000) {
          tempStreak++;
          if (currentStreak > 0) currentStreak++;
        } else {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 1;
          if (currentStreak === 0) currentStreak = 0;
        }
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;

    res.json({
      summary,
      recentTests,
      achievements,
      streaks: {
        current: currentStreak,
        longest: Math.max(longestStreak, currentStreak)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics overview', message: error.message });
  }
});

// Get user progress over time
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', metric = 'wpm' } = req.query;
    
    const now = new Date();
    let startDate;
    let groupBy;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dayOfYear: '$completedAt' };
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = { $dayOfYear: '$completedAt' };
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        groupBy = { $month: '$completedAt' };
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = { $dayOfYear: '$completedAt' };
    }

    const pipeline = [
      {
        $match: {
          userId: req.user.id,
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            ...groupBy,
            year: { $year: '$completedAt' }
          },
          averageWpm: { $avg: '$wpm' },
          averageAccuracy: { $avg: '$accuracy' },
          averageConsistency: { $avg: '$consistency' },
          testCount: { $sum: 1 },
          date: { $first: '$completedAt' }
        }
      },
      {
        $sort: { 'date': 1 }
      }
    ];

    const results = await Test.aggregate(pipeline);
    
    const dataPoints = results.map(result => ({
      date: result.date.toISOString().split('T')[0],
      value: result[`average${metric.charAt(0).toUpperCase() + metric.slice(1)}`] || 0,
      testCount: result.testCount
    }));

    res.json({
      metric,
      period,
      dataPoints
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress data', message: error.message });
  }
});

// Export user statistics
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const { format, period = 'all', includeKeystrokes = false } = req.body;
    
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
    }

    // Period filtering
    let dateFilter = {};
    if (period !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      if (startDate) dateFilter.completedAt = { $gte: startDate };
    }

    const filters = { userId: req.user.id, ...dateFilter };
    const tests = await Test.find(filters).sort({ completedAt: -1 });

    if (format === 'csv') {
      const { stringify } = require('csv-stringify');
      
      const records = tests.map(test => ({
        date: test.completedAt.toISOString(),
        mode: test.mode,
        duration: test.duration,
        wordCount: test.wordCount,
        wpm: test.wpm,
        accuracy: test.accuracy,
        consistency: test.consistency,
        errors: test.errors,
        correctChars: test.correctChars,
        incorrectChars: test.incorrectChars
      }));

      stringify(records, { header: true }, (err, output) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to generate CSV', message: err.message });
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=typing-stats-${Date.now()}.csv`);
        res.send(output);
      });
    } else {
      // JSON format
      const exportData = {
        exportedAt: new Date().toISOString(),
        period,
        totalTests: tests.length,
        tests: tests.map(test => ({
          id: test._id,
          date: test.completedAt,
          mode: test.mode,
          duration: test.duration,
          wordCount: test.wordCount,
          wpm: test.wpm,
          accuracy: test.accuracy,
          consistency: test.consistency,
          errors: test.errors,
          correctChars: test.correctChars,
          incorrectChars: test.incorrectChars,
          ...(includeKeystrokes && test.keystrokes ? { keystrokes: test.keystrokes } : {})
        }))
      };

      res.json(exportData);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to export statistics', message: error.message });
  }
});

module.exports = router;