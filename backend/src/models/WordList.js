const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const wordListSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  name: {
    type: String,
    required: [true, 'Word list name is required'],
    trim: true,
    minlength: [1, 'Name must be at least 1 character long'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['common', 'technical', 'coding', 'quotes', 'custom'],
    default: 'common',
    index: true
  },
  language: {
    type: String,
    required: [true, 'Language is required'],
    default: 'english',
    lowercase: true,
    index: true
  },
  words: [{
    type: String,
    required: true,
    trim: true,
    minlength: [1, 'Word cannot be empty'],
    maxlength: [200, 'Word/quote cannot exceed 200 characters']
  }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
    index: true
  },
  isCustom: {
    type: Boolean,
    default: false,
    index: true
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  isSystem: {
    type: Boolean,
    default: false,
    index: true
  },
  createdBy: {
    type: String,
    ref: 'User',
    required: function() {
      return this.isCustom;
    },
    index: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  averageWpm: {
    type: Number,
    default: 0,
    min: 0
  },
  averageAccuracy: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      ret.wordCount = ret.words ? ret.words.length : 0;
      delete ret._id;
      delete ret.__v;
      // Don't include all words in list response by default
      if (ret.words && ret.words.length > 50) {
        ret.wordsPreview = ret.words.slice(0, 50);
        delete ret.words;
      }
      return ret;
    }
  }
});

// Indexes for better query performance
wordListSchema.index({ category: 1, language: 1, isActive: 1 });
wordListSchema.index({ isPublic: 1, isActive: 1 });
wordListSchema.index({ createdBy: 1, isActive: 1 });
wordListSchema.index({ usageCount: -1 });
wordListSchema.index({ name: 'text', description: 'text', tags: 'text' });
wordListSchema.index({ createdAt: -1 });

// Validation for words array
wordListSchema.pre('save', function(next) {
  if (this.words && this.words.length > 0) {
    // Remove empty words and duplicates
    this.words = [...new Set(this.words.filter(word => word && word.trim().length > 0))];
    
    // Validate minimum number of words
    if (this.words.length < 10) {
      return next(new Error('Word list must contain at least 10 words'));
    }
    
    // Validate maximum number of words
    if (this.words.length > 1000) {
      return next(new Error('Word list cannot contain more than 1000 words'));
    }
    
    // Convert to lowercase for consistency
    this.words = this.words.map(word => word.toLowerCase());
  }
  
  next();
});

// Update usage statistics
wordListSchema.methods.updateUsageStats = function(wpm, accuracy) {
  this.usageCount += 1;
  
  // Calculate rolling average
  this.averageWpm = ((this.averageWpm * (this.usageCount - 1)) + wpm) / this.usageCount;
  this.averageAccuracy = ((this.averageAccuracy * (this.usageCount - 1)) + accuracy) / this.usageCount;
  
  return this.save();
};

// Get random words from the list
wordListSchema.methods.getRandomWords = function(count) {
  if (!this.words || this.words.length === 0) {
    return [];
  }
  
  const shuffled = [...this.words];
  const result = [];
  
  // If we need more words than available, repeat the list
  while (result.length < count) {
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const needed = count - result.length;
    result.push(...shuffled.slice(0, Math.min(needed, shuffled.length)));
  }
  
  return result.slice(0, count);
};

// Get words for typing test
wordListSchema.methods.generateTestWords = function(options = {}) {
  const { count = 50, mode = 'random', difficulty } = options;
  
  if (mode === 'random') {
    return this.getRandomWords(count);
  }
  
  // Future: implement other modes like 'sequential', 'difficulty-based', etc.
  return this.getRandomWords(count);
};

// Static method to get available word lists
wordListSchema.statics.getAvailable = function(filters = {}) {
  const match = { isActive: true };
  
  // Add category filter
  if (filters.category) {
    match.category = filters.category;
  }
  
  // Add language filter
  if (filters.language) {
    match.language = filters.language;
  }
  
  // Add public/custom filter
  if (filters.userId) {
    // User can see public lists and their own custom lists
    match.$or = [
      { isPublic: true },
      { isSystem: true },
      { createdBy: filters.userId }
    ];
  } else {
    // Anonymous users can only see public and system lists
    match.$or = [
      { isPublic: true },
      { isSystem: true }
    ];
  }
  
  return this.find(match)
    .select('-words') // Don't include words in list view
    .sort({ usageCount: -1, createdAt: -1 });
};

// Static method to search word lists
wordListSchema.statics.search = function(query, filters = {}) {
  const match = { 
    isActive: true,
    $text: { $search: query }
  };
  
  // Add filters
  if (filters.category) {
    match.category = filters.category;
  }
  
  if (filters.language) {
    match.language = filters.language;
  }
  
  if (filters.userId) {
    match.$or = [
      { isPublic: true },
      { isSystem: true },
      { createdBy: filters.userId }
    ];
  } else {
    match.$or = [
      { isPublic: true },
      { isSystem: true }
    ];
  }
  
  return this.find(match, { score: { $meta: 'textScore' } })
    .select('-words')
    .sort({ score: { $meta: 'textScore' }, usageCount: -1 });
};

// Static method to get popular word lists
wordListSchema.statics.getPopular = function(limit = 10, filters = {}) {
  const match = { 
    isActive: true,
    usageCount: { $gt: 0 }
  };
  
  if (filters.category) {
    match.category = filters.category;
  }
  
  if (filters.language) {
    match.language = filters.language;
  }
  
  if (filters.userId) {
    match.$or = [
      { isPublic: true },
      { isSystem: true },
      { createdBy: filters.userId }
    ];
  } else {
    match.$or = [
      { isPublic: true },
      { isSystem: true }
    ];
  }
  
  return this.find(match)
    .select('-words')
    .sort({ usageCount: -1, averageWpm: -1 })
    .limit(limit);
};

// Static method to get categories
wordListSchema.statics.getCategories = function() {
  return this.distinct('category', { isActive: true });
};

// Static method to get languages
wordListSchema.statics.getLanguages = function() {
  return this.distinct('language', { isActive: true });
};

module.exports = mongoose.model('WordList', wordListSchema);