const express = require('express');
const router = express.Router();
const { protect: authenticateToken } = require('../middleware/auth');
const WordList = require('../models/WordList');

// Get available word lists
router.get('/', async (req, res) => {
  try {
    const { category, language = 'english' } = req.query;
    
    const filters = { language };
    if (category) filters.category = category;

    const wordLists = await WordList.find(filters)
      .populate('createdBy', 'username')
      .select('-words') // Don't send full word arrays in list view
      .sort({ category: 1, name: 1 });

    const wordListSummaries = wordLists.map(list => ({
      id: list._id,
      name: list.name,
      description: list.description,
      category: list.category,
      language: list.language,
      wordCount: list.wordCount,
      difficulty: list.difficulty,
      isCustom: list.isCustom,
      createdBy: list.isCustom ? list.createdBy?.username : undefined
    }));

    const categories = [...new Set(wordLists.map(list => list.category))];

    res.json({
      wordLists: wordListSummaries,
      categories
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch word lists', message: error.message });
  }
});

// Get specific word list
router.get('/:listId', async (req, res) => {
  try {
    const wordList = await WordList.findById(req.params.listId)
      .populate('createdBy', 'username');

    if (!wordList) {
      return res.status(404).json({ error: 'Word list not found' });
    }

    res.json(wordList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch word list', message: error.message });
  }
});

// Create custom word list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, words, difficulty = 'medium', isPublic = false } = req.body;

    if (!name || !words || words.length < 10) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'Name and at least 10 words are required'
      });
    }

    const wordList = new WordList({
      name,
      description,
      words,
      difficulty,
      category: 'custom',
      language: 'english',
      isCustom: true,
      isPublic,
      createdBy: req.user.id,
      wordCount: words.length
    });

    await wordList.save();
    await wordList.populate('createdBy', 'username');

    res.status(201).json(wordList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create word list', message: error.message });
  }
});

// Update custom word list
router.put('/:listId', authenticateToken, async (req, res) => {
  try {
    const { name, description, words, difficulty, isPublic } = req.body;

    const wordList = await WordList.findById(req.params.listId);
    if (!wordList) {
      return res.status(404).json({ error: 'Word list not found' });
    }

    if (wordList.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this word list' });
    }

    if (name) wordList.name = name;
    if (description) wordList.description = description;
    if (words && words.length >= 10) {
      wordList.words = words;
      wordList.wordCount = words.length;
    }
    if (difficulty) wordList.difficulty = difficulty;
    if (typeof isPublic === 'boolean') wordList.isPublic = isPublic;

    await wordList.save();
    await wordList.populate('createdBy', 'username');

    res.json(wordList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update word list', message: error.message });
  }
});

// Delete custom word list
router.delete('/:listId', authenticateToken, async (req, res) => {
  try {
    const wordList = await WordList.findById(req.params.listId);
    if (!wordList) {
      return res.status(404).json({ error: 'Word list not found' });
    }

    if (wordList.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this word list' });
    }

    await WordList.findByIdAndDelete(req.params.listId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete word list', message: error.message });
  }
});

module.exports = router;