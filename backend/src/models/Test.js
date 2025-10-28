const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const keystrokeSchema = new mongoose.Schema({
  timestamp: {
    type: Number,
    required: true,
    min: 0
  },
  key: {
    type: String,
    required: true,
    maxlength: 10
  },
  correct: {
    type: Boolean,
    required: true
  },
  position: {
    type: Number,
    required: true,
    min: 0
  },
  wpm: {
    type: Number,
    min: 0
  },
  accuracy: {
    type: Number,
    min: 0,
    max: 100
  }
}, { _id: false });

const testSessionSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  userId: {
    type: String,
    ref: 'User',
    required: false, // Allow null for guest users
    index: true,
    default: null
  },
  mode: {
    type: String,
    enum: ['time', 'words'],
    required: true
  },
  duration: {
    type: Number,
    validate: {
      validator: function(v) {
        if (this.mode === 'time') {
          return [15, 30, 60, 120].includes(v);
        }
        return true;
      },
      message: 'Invalid duration for time mode. Must be 15, 30, 60, or 120 seconds'
    }
  },
  wordCount: {
    type: Number,
    validate: {
      validator: function(v) {
        if (this.mode === 'words') {
          return [10, 25, 50, 100].includes(v);
        }
        return true;
      },
      message: 'Invalid word count for words mode. Must be 10, 25, 50, or 100 words'
    }
  },
  wordListId: {
    type: String,
    ref: 'WordList',
    index: true
  },
  language: {
    type: String,
    default: 'english'
  },
  words: [{
    type: String,
    required: true
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Sessions expire after 10 minutes
      return new Date(Date.now() + 10 * 60 * 1000);
    },
    index: { expireAfterSeconds: 0 }
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired'],
    default: 'active'
  },
  keystrokes: [keystrokeSchema],
  completedText: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

const testResultSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  testSessionId: {
    type: String,
    ref: 'TestSession',
    required: true
  },
  userId: {
    type: String,
    ref: 'User',
    required: false, // Allow null for guest users
    index: true,
    default: null
  },
  mode: {
    type: String,
    enum: ['time', 'words'],
    required: true,
    index: true
  },
  duration: {
    type: Number,
    required: true
  },
  wordCount: {
    type: Number
  },
  wpm: {
    type: Number,
    required: true,
    min: 0,
    index: -1
  },
  accuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  consistency: {
    type: Number,
    min: 0,
    max: 100
  },
  errors: {
    type: Number,
    default: 0,
    min: 0
  },
  correctChars: {
    type: Number,
    default: 0,
    min: 0
  },
  incorrectChars: {
    type: Number,
    default: 0,
    min: 0
  },
  totalChars: {
    type: Number,
    default: 0,
    min: 0
  },
  keystrokes: [keystrokeSchema],
  completedText: {
    type: String,
    required: true
  },
  targetText: {
    type: String,
    required: true
  },
  wordListId: {
    type: String,
    ref: 'WordList'
  },
  language: {
    type: String,
    default: 'english'
  },
  rank: {
    type: Number,
    min: 1
  },
  percentile: {
    type: Number,
    min: 0,
    max: 100
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPersonalBest: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      ret.completedAt = ret.createdAt;
      delete ret._id;
      delete ret.__v;
      delete ret.testSessionId;
      return ret;
    }
  }
});

// Indexes for better query performance
testSessionSchema.index({ userId: 1, status: 1 });
testSessionSchema.index({ expiresAt: 1 });
testSessionSchema.index({ createdAt: -1 });

testResultSchema.index({ userId: 1, createdAt: -1 });
testResultSchema.index({ mode: 1, wpm: -1 });
testResultSchema.index({ mode: 1, duration: 1, wpm: -1 });
testResultSchema.index({ mode: 1, wordCount: 1, wpm: -1 });
testResultSchema.index({ createdAt: -1 });
testResultSchema.index({ wpm: -1, accuracy: -1 });
testResultSchema.index({ isPersonalBest: 1 });

// Pre-save middleware to calculate statistics
testResultSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Calculate total characters
    this.totalChars = this.correctChars + this.incorrectChars;
    
    // Calculate accuracy if not provided
    if (this.accuracy === undefined && this.totalChars > 0) {
      this.accuracy = (this.correctChars / this.totalChars) * 100;
    }
    
    // Calculate consistency if keystrokes are provided
    if (this.keystrokes && this.keystrokes.length > 0 && this.consistency === undefined) {
      this.consistency = this.calculateConsistency();
    }
    
    // Check if this is a personal best
    await this.checkPersonalBest();
    
    // Calculate global rank
    await this.calculateRank();
  }
  
  next();
});

// Calculate consistency based on WPM variance
testResultSchema.methods.calculateConsistency = function() {
  if (!this.keystrokes || this.keystrokes.length < 10) {
    return 0;
  }
  
  const wpmSamples = this.keystrokes
    .filter(k => k.wpm && k.wpm > 0)
    .map(k => k.wpm);
    
  if (wpmSamples.length < 5) {
    return 0;
  }
  
  const mean = wpmSamples.reduce((sum, wpm) => sum + wpm, 0) / wpmSamples.length;
  const variance = wpmSamples.reduce((sum, wpm) => sum + Math.pow(wpm - mean, 2), 0) / wpmSamples.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Convert to consistency score (lower deviation = higher consistency)
  const consistency = Math.max(0, 100 - (standardDeviation / mean) * 100);
  
  return Math.round(consistency * 100) / 100;
};

// Check if this result is a personal best
testResultSchema.methods.checkPersonalBest = async function() {
  const TestResult = this.constructor;
  
  const bestResult = await TestResult.findOne({
    userId: this.userId,
    mode: this.mode,
    ...(this.mode === 'time' ? { duration: this.duration } : { wordCount: this.wordCount }),
    wpm: { $gt: this.wpm }
  }).sort({ wpm: -1 });
  
  this.isPersonalBest = !bestResult;
  
  // Update previous personal best if this is better
  if (this.isPersonalBest) {
    await TestResult.updateMany({
      userId: this.userId,
      mode: this.mode,
      ...(this.mode === 'time' ? { duration: this.duration } : { wordCount: this.wordCount }),
      _id: { $ne: this._id },
      isPersonalBest: true
    }, {
      $set: { isPersonalBest: false }
    });
  }
};

// Calculate global rank
testResultSchema.methods.calculateRank = async function() {
  const TestResult = this.constructor;
  
  const betterResults = await TestResult.countDocuments({
    mode: this.mode,
    ...(this.mode === 'time' ? { duration: this.duration } : { wordCount: this.wordCount }),
    wpm: { $gt: this.wpm }
  });
  
  this.rank = betterResults + 1;
  
  // Calculate percentile
  const totalResults = await TestResult.countDocuments({
    mode: this.mode,
    ...(this.mode === 'time' ? { duration: this.duration } : { wordCount: this.wordCount })
  });
  
  if (totalResults > 0) {
    this.percentile = Math.round(((totalResults - betterResults) / totalResults) * 100);
  }
};

// Static method to get leaderboard
testResultSchema.statics.getLeaderboard = function(filters = {}) {
  const match = {};
  
  // Add mode filter
  if (filters.mode) {
    match.mode = filters.mode;
  }
  
  // Add duration/word count filter
  if (filters.duration) {
    match.duration = filters.duration;
  }
  
  if (filters.wordCount) {
    match.wordCount = filters.wordCount;
  }
  
  // Add period filter
  if (filters.period && filters.period !== 'allTime') {
    const periodStart = new Date();
    switch (filters.period) {
      case 'daily':
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case 'weekly':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case 'monthly':
        periodStart.setMonth(periodStart.getMonth() - 1);
        break;
    }
    match.createdAt = { $gte: periodStart };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.isActive': true
      }
    },
    {
      $group: {
        _id: '$userId',
        bestWpm: { $max: '$wpm' },
        bestAccuracy: { $first: '$accuracy' },
        bestConsistency: { $first: '$consistency' },
        testDate: { $first: '$createdAt' },
        user: { $first: '$user' }
      }
    },
    {
      $project: {
        _id: 0,
        user: {
          id: '$user._id',
          username: '$user.username',
          createdAt: '$user.createdAt'
        },
        wpm: '$bestWpm',
        accuracy: '$bestAccuracy',
        consistency: '$bestConsistency',
        testDate: '$testDate'
      }
    },
    { $sort: { wpm: -1, accuracy: -1 } }
  ]);
};

// Static method to get user's test history
testResultSchema.statics.getUserHistory = function(userId, filters = {}) {
  const match = { userId };
  
  // Add filters
  if (filters.mode) {
    match.mode = filters.mode;
  }
  
  if (filters.from || filters.to) {
    match.createdAt = {};
    if (filters.from) {
      match.createdAt.$gte = new Date(filters.from);
    }
    if (filters.to) {
      match.createdAt.$lte = new Date(filters.to);
    }
  }
  
  return this.find(match)
    .sort({ createdAt: -1 })
    .select('-keystrokes -targetText -completedText');
};

const TestSession = mongoose.model('TestSession', testSessionSchema);
const TestResult = mongoose.model('TestResult', testResultSchema);

module.exports = {
  TestSession,
  TestResult
};