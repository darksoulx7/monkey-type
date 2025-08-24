const express = require('express');
const router = express.Router();
const { protect: authenticateToken } = require('../middleware/auth');
const Race = require('../models/Race');
const WordList = require('../models/WordList');

// Get available races
router.get('/', async (req, res) => {
  try {
    const { status = 'waiting', limit = 20, offset = 0 } = req.query;
    
    const filters = { status };
    if (status === 'waiting') {
      // Only show public races that aren't full
      filters.isPrivate = false;
      filters.$expr = { $lt: [{ $size: '$players' }, '$maxPlayers'] };
    }

    const races = await Race.find(filters)
      .populate('createdBy', 'username')
      .populate('players.user', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Race.countDocuments(filters);

    const raceSummaries = races.map(race => ({
      id: race._id,
      name: race.name,
      status: race.status,
      maxPlayers: race.maxPlayers,
      currentPlayers: race.players.length,
      mode: race.mode,
      duration: race.duration,
      wordCount: race.wordCount,
      createdAt: race.createdAt,
      createdBy: race.createdBy.username
    }));

    res.json({
      races: raceSummaries,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch races', message: error.message });
  }
});

// Create new race
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      mode, 
      duration, 
      wordCount, 
      maxPlayers = 5, 
      wordListId, 
      isPrivate = false 
    } = req.body;

    if (!name || !mode) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'Name and mode are required'
      });
    }

    if (mode === 'time' && !duration) {
      return res.status(400).json({ 
        error: 'Duration required for time mode'
      });
    }

    if (mode === 'words' && !wordCount) {
      return res.status(400).json({ 
        error: 'Word count required for words mode'
      });
    }

    // Get words for the race
    let words = [];
    if (wordListId) {
      const wordList = await WordList.findById(wordListId);
      if (wordList) {
        words = wordList.words;
      }
    }

    // Default to common words if no word list specified
    if (words.length === 0) {
      const commonWords = await WordList.findOne({ category: 'common', language: 'english' });
      if (commonWords) {
        words = commonWords.words;
      } else {
        // Fallback words
        words = [
          'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog',
          'typing', 'speed', 'test', 'keyboard', 'computer', 'practice', 'words'
        ];
      }
    }

    // Shuffle and select appropriate number of words
    const shuffled = words.sort(() => 0.5 - Math.random());
    const selectedWords = mode === 'words' ? 
      shuffled.slice(0, wordCount) : 
      shuffled.slice(0, Math.min(200, shuffled.length));

    const race = new Race({
      name,
      description,
      mode,
      duration: mode === 'time' ? duration : undefined,
      wordCount: mode === 'words' ? wordCount : undefined,
      maxPlayers,
      words: selectedWords,
      isPrivate,
      createdBy: req.user.id,
      players: [{
        user: req.user.id,
        joinedAt: new Date()
      }]
    });

    await race.save();
    await race.populate([
      { path: 'createdBy', select: 'username' },
      { path: 'players.user', select: 'username' }
    ]);

    res.status(201).json(race);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create race', message: error.message });
  }
});

// Get race details
router.get('/:raceId', async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId)
      .populate('createdBy', 'username')
      .populate('players.user', 'username');

    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    res.json(race);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch race', message: error.message });
  }
});

// Join a race
router.post('/:raceId/join', authenticateToken, async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    if (race.status !== 'waiting') {
      return res.status(400).json({ error: 'Cannot join race that has started or finished' });
    }

    if (race.players.length >= race.maxPlayers) {
      return res.status(400).json({ error: 'Race is full' });
    }

    // Check if user already joined
    const alreadyJoined = race.players.some(player => 
      player.user.toString() === req.user.id
    );

    if (alreadyJoined) {
      return res.status(400).json({ error: 'Already joined this race' });
    }

    race.players.push({
      user: req.user.id,
      joinedAt: new Date()
    });

    await race.save();
    await race.populate([
      { path: 'createdBy', select: 'username' },
      { path: 'players.user', select: 'username' }
    ]);

    res.json(race);
  } catch (error) {
    res.status(500).json({ error: 'Failed to join race', message: error.message });
  }
});

// Leave a race
router.post('/:raceId/leave', authenticateToken, async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    if (race.status !== 'waiting') {
      return res.status(400).json({ error: 'Cannot leave race that has started' });
    }

    const playerIndex = race.players.findIndex(player => 
      player.user.toString() === req.user.id
    );

    if (playerIndex === -1) {
      return res.status(400).json({ error: 'Not in this race' });
    }

    race.players.splice(playerIndex, 1);

    // Delete race if creator leaves and no other players
    if (race.createdBy.toString() === req.user.id && race.players.length === 0) {
      await Race.findByIdAndDelete(req.params.raceId);
      return res.status(200).json({ message: 'Left race and deleted empty race' });
    }

    await race.save();
    res.status(200).json({ message: 'Left race successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave race', message: error.message });
  }
});

module.exports = router;