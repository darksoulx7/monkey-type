const express = require('express');
const router = express.Router();
const { protect: authenticateToken } = require('../middleware/auth');
const Test = require('../models/Test');

// Get global leaderboard
router.get('/global', async (req, res) => {
  try {
    const { mode = 'time', duration, wordCount, period = 'allTime', limit = 20, offset = 0 } = req.query;
    
    // Build query filters
    const filters = { mode };
    if (mode === 'time' && duration) filters.duration = parseInt(duration);
    if (mode === 'words' && wordCount) filters.wordCount = parseInt(wordCount);
    
    // Period filtering
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
      if (startDate) filters.completedAt = { $gte: startDate };
    }

    const entries = await Test.find(filters)
      .populate('userId', 'username')
      .sort({ wpm: -1, accuracy: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('wpm accuracy consistency completedAt userId');

    const total = await Test.countDocuments(filters);

    const leaderboard = {
      entries: entries.map((test, index) => ({
        rank: parseInt(offset) + index + 1,
        user: {
          id: test.userId._id,
          username: test.userId.username
        },
        wpm: test.wpm,
        accuracy: test.accuracy,
        consistency: test.consistency,
        testDate: test.completedAt
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      filters: { mode, duration, wordCount, period }
    };

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard', message: error.message });
  }
});

// Get friends leaderboard
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const { mode = 'time', duration, wordCount, period = 'allTime', limit = 20 } = req.query;
    
    // Get user's friends
    const Friendship = require('../models/Friendship');
    const friendships = await Friendship.find({
      $or: [
        { requester: req.user.id, status: 'accepted' },
        { recipient: req.user.id, status: 'accepted' }
      ]
    });

    const friendIds = friendships.map(friendship => 
      friendship.requester.toString() === req.user.id ? 
      friendship.recipient : friendship.requester
    );
    friendIds.push(req.user.id); // Include current user

    // Build query filters
    const filters = { mode, userId: { $in: friendIds } };
    if (mode === 'time' && duration) filters.duration = parseInt(duration);
    if (mode === 'words' && wordCount) filters.wordCount = parseInt(wordCount);
    
    // Period filtering (same as global)
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
      if (startDate) filters.completedAt = { $gte: startDate };
    }

    const entries = await Test.find(filters)
      .populate('userId', 'username')
      .sort({ wpm: -1, accuracy: -1 })
      .limit(parseInt(limit))
      .select('wpm accuracy consistency completedAt userId');

    const leaderboard = {
      entries: entries.map((test, index) => ({
        rank: index + 1,
        user: {
          id: test.userId._id,
          username: test.userId.username
        },
        wpm: test.wpm,
        accuracy: test.accuracy,
        consistency: test.consistency,
        testDate: test.completedAt
      })),
      pagination: {
        total: entries.length,
        limit: parseInt(limit),
        offset: 0,
        hasMore: false
      },
      filters: { mode, duration, wordCount, period }
    };

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends leaderboard', message: error.message });
  }
});

module.exports = router;