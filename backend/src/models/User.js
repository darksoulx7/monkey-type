const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userPreferencesSchema = new mongoose.Schema({
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'dark'
  },
  soundEnabled: {
    type: Boolean,
    default: false
  },
  blindMode: {
    type: Boolean,
    default: false
  },
  smoothCaret: {
    type: Boolean,
    default: true
  },
  confidenceMode: {
    type: String,
    enum: ['off', 'on', 'max'],
    default: 'off'
  }
}, { _id: false });

const userStatsSchema = new mongoose.Schema({
  totalTests: {
    type: Number,
    default: 0,
    min: 0
  },
  averageWpm: {
    type: Number,
    default: 0,
    min: 0
  },
  bestWpm: {
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
  totalTimeTyped: {
    type: Number,
    default: 0,
    min: 0
  },
  consistency: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '7d' // Auto-delete after 7 days
    }
  }],
  stats: {
    type: userStatsSchema,
    default: () => ({})
  },
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'stats.bestWpm': -1 });
userSchema.index({ 'stats.totalTests': -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only run if password is modified
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Update lastLogin on successful authentication
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update user statistics
userSchema.methods.updateStats = function(testResult) {
  const stats = this.stats;
  
  // Increment total tests
  stats.totalTests += 1;
  
  // Update best WPM
  if (testResult.wpm > stats.bestWpm) {
    stats.bestWpm = testResult.wpm;
  }
  
  // Calculate new averages
  const totalWpm = (stats.averageWpm * (stats.totalTests - 1)) + testResult.wpm;
  stats.averageWpm = totalWpm / stats.totalTests;
  
  const totalAccuracy = (stats.averageAccuracy * (stats.totalTests - 1)) + testResult.accuracy;
  stats.averageAccuracy = totalAccuracy / stats.totalTests;
  
  // Update total time typed (convert to seconds)
  stats.totalTimeTyped += Math.floor(testResult.duration / 1000);
  
  // Update consistency (simple rolling average for now)
  if (testResult.consistency !== undefined) {
    const totalConsistency = (stats.consistency * (stats.totalTests - 1)) + testResult.consistency;
    stats.consistency = totalConsistency / stats.totalTests;
  }
  
  stats.lastUpdated = new Date();
  
  return this.save();
};

// Get public profile information
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    createdAt: this.createdAt,
    publicStats: {
      totalTests: this.stats.totalTests,
      bestWpm: this.stats.bestWpm,
      averageAccuracy: this.stats.averageAccuracy
    }
  };
};

// Add refresh token
userSchema.methods.addRefreshToken = function(token) {
  // Limit to 5 refresh tokens per user
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift(); // Remove oldest token
  }
  
  this.refreshTokens.push({
    token: token,
    createdAt: new Date()
  });
  
  return this.save({ validateBeforeSave: false });
};

// Remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
  return this.save({ validateBeforeSave: false });
};

// Check if refresh token is valid
userSchema.methods.hasValidRefreshToken = function(token) {
  return this.refreshTokens.some(t => t.token === token);
};

// Static method to find by email or username
userSchema.statics.findByIdentifier = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ],
    isActive: true
  });
};

// Static method to get leaderboard
userSchema.statics.getLeaderboard = function(filters = {}) {
  const match = { isActive: true, 'stats.totalTests': { $gt: 0 } };
  
  // Add period filter if specified
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
    match['stats.lastUpdated'] = { $gte: periodStart };
  }
  
  return this.find(match)
    .select('username stats.bestWpm stats.averageAccuracy stats.consistency stats.totalTests createdAt')
    .sort({ 'stats.bestWpm': -1, 'stats.averageAccuracy': -1 })
    .lean();
};

module.exports = mongoose.model('User', userSchema);