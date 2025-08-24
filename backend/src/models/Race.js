const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const racePlayerSchema = new mongoose.Schema({
  userId: {
    type: String,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  position: {
    type: Number,
    default: 0,
    min: 0
  },
  wpm: {
    type: Number,
    default: 0,
    min: 0
  },
  accuracy: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isFinished: {
    type: Boolean,
    default: false
  },
  finishTime: {
    type: Number,
    min: 0
  },
  rank: {
    type: Number,
    min: 1
  },
  errors: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const raceSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  name: {
    type: String,
    required: [true, 'Race name is required'],
    trim: true,
    minlength: [1, 'Name must be at least 1 character long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['waiting', 'countdown', 'active', 'completed', 'cancelled'],
    default: 'waiting',
    index: true
  },
  mode: {
    type: String,
    enum: ['time', 'words'],
    required: [true, 'Race mode is required']
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
  maxPlayers: {
    type: Number,
    required: true,
    min: [2, 'Race must allow at least 2 players'],
    max: [10, 'Race cannot have more than 10 players'],
    default: 5
  },
  minPlayers: {
    type: Number,
    default: 2,
    min: 2
  },
  players: [racePlayerSchema],
  words: [{
    type: String,
    required: true
  }],
  wordListId: {
    type: String,
    ref: 'WordList'
  },
  language: {
    type: String,
    default: 'english'
  },
  isPrivate: {
    type: Boolean,
    default: false,
    index: true
  },
  password: {
    type: String,
    select: false
  },
  createdBy: {
    type: String,
    ref: 'User',
    required: true,
    index: true
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  countdownStartedAt: {
    type: Date
  },
  countdownDuration: {
    type: Number,
    default: 5000, // 5 seconds countdown
    min: 3000,
    max: 10000
  },
  autoStart: {
    type: Boolean,
    default: true
  },
  autoStartDelay: {
    type: Number,
    default: 10000, // 10 seconds after minimum players join
    min: 5000,
    max: 60000
  },
  winner: {
    userId: {
      type: String,
      ref: 'User'
    },
    username: String,
    wpm: Number,
    accuracy: Number,
    finishTime: Number
  },
  settings: {
    allowSpectators: {
      type: Boolean,
      default: true
    },
    showLiveWPM: {
      type: Boolean,
      default: true
    },
    showProgress: {
      type: Boolean,
      default: true
    }
  },
  spectators: [{
    userId: {
      type: String,
      ref: 'User'
    },
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  expiresAt: {
    type: Date,
    default: function() {
      // Races expire after 1 hour if not completed
      return new Date(Date.now() + 60 * 60 * 1000);
    },
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      ret.currentPlayers = ret.players ? ret.players.length : 0;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for better query performance
raceSchema.index({ status: 1, isPrivate: 1, createdAt: -1 });
raceSchema.index({ createdBy: 1, status: 1 });
raceSchema.index({ 'players.userId': 1 });
raceSchema.index({ expiresAt: 1 });

// Validate race configuration
raceSchema.pre('save', function(next) {
  // Ensure proper mode configuration
  if (this.mode === 'time' && !this.duration) {
    return next(new Error('Duration is required for time mode'));
  }
  
  if (this.mode === 'words' && !this.wordCount) {
    return next(new Error('Word count is required for words mode'));
  }
  
  // Ensure minimum players is not greater than maximum
  if (this.minPlayers > this.maxPlayers) {
    return next(new Error('Minimum players cannot exceed maximum players'));
  }
  
  // Generate words if not provided
  if ((!this.words || this.words.length === 0) && this.isNew) {
    // This will be handled by the controller using WordList
    // For now, we'll just ensure words exist before starting
  }
  
  next();
});

// Add a player to the race
raceSchema.methods.addPlayer = function(userId, username) {
  // Check if race is full
  if (this.players.length >= this.maxPlayers) {
    throw new Error('Race is full');
  }
  
  // Check if player is already in the race
  if (this.players.some(p => p.userId === userId)) {
    throw new Error('Player already in race');
  }
  
  // Check if race has started
  if (this.status !== 'waiting') {
    throw new Error('Cannot join race that has already started');
  }
  
  this.players.push({
    userId,
    username,
    joinedAt: new Date()
  });
  
  return this.save();
};

// Remove a player from the race
raceSchema.methods.removePlayer = function(userId) {
  // Check if race has started
  if (this.status === 'active') {
    throw new Error('Cannot leave race that is active');
  }
  
  const playerIndex = this.players.findIndex(p => p.userId === userId);
  if (playerIndex === -1) {
    throw new Error('Player not found in race');
  }
  
  this.players.splice(playerIndex, 1);
  
  // Cancel race if no players left
  if (this.players.length === 0) {
    this.status = 'cancelled';
  }
  
  return this.save();
};

// Update player progress
raceSchema.methods.updatePlayerProgress = function(userId, progress) {
  const player = this.players.find(p => p.userId === userId);
  if (!player) {
    throw new Error('Player not found in race');
  }
  
  if (this.status !== 'active') {
    throw new Error('Race is not active');
  }
  
  // Update player stats
  player.position = progress.position || player.position;
  player.wpm = progress.wpm || player.wpm;
  player.accuracy = progress.accuracy || player.accuracy;
  player.errors = progress.errors || player.errors;
  player.progress = progress.progress || player.progress;
  player.lastUpdate = new Date();
  
  // Check if player finished
  if (progress.isFinished && !player.isFinished) {
    player.isFinished = true;
    player.finishTime = Date.now() - this.startedAt.getTime();
    
    // Calculate rank
    const finishedPlayers = this.players.filter(p => p.isFinished);
    player.rank = finishedPlayers.length;
    
    // Check if this is the winner (first to finish)
    if (player.rank === 1) {
      this.winner = {
        userId: player.userId,
        username: player.username,
        wpm: player.wpm,
        accuracy: player.accuracy,
        finishTime: player.finishTime
      };
    }
    
    // Check if race is complete (all players finished or time limit reached)
    if (this.checkRaceComplete()) {
      this.completeRace();
    }
  }
  
  return this.save();
};

// Check if race should be completed
raceSchema.methods.checkRaceComplete = function() {
  if (this.status !== 'active') {
    return false;
  }
  
  // All players finished
  if (this.players.every(p => p.isFinished)) {
    return true;
  }
  
  // Time limit reached (for time mode)
  if (this.mode === 'time' && this.startedAt) {
    const elapsed = Date.now() - this.startedAt.getTime();
    return elapsed >= (this.duration * 1000);
  }
  
  // At least one player finished (for words mode)
  if (this.mode === 'words' && this.players.some(p => p.isFinished)) {
    return true;
  }
  
  return false;
};

// Complete the race
raceSchema.methods.completeRace = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Assign ranks to all players
  const sortedPlayers = [...this.players].sort((a, b) => {
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;
    if (a.isFinished && b.isFinished) {
      return a.finishTime - b.finishTime;
    }
    return b.wpm - a.wpm; // Sort by WPM for unfinished players
  });
  
  sortedPlayers.forEach((player, index) => {
    const originalPlayer = this.players.find(p => p.userId === player.userId);
    if (originalPlayer) {
      originalPlayer.rank = index + 1;
    }
  });
  
  return this.save();
};

// Start the race countdown
raceSchema.methods.startCountdown = function() {
  if (this.status !== 'waiting') {
    throw new Error('Race must be in waiting status to start countdown');
  }
  
  if (this.players.length < this.minPlayers) {
    throw new Error(`Need at least ${this.minPlayers} players to start race`);
  }
  
  this.status = 'countdown';
  this.countdownStartedAt = new Date();
  
  return this.save();
};

// Start the race
raceSchema.methods.startRace = function() {
  if (this.status !== 'countdown') {
    throw new Error('Race must be in countdown status to start');
  }
  
  this.status = 'active';
  this.startedAt = new Date();
  
  // Reset all player progress
  this.players.forEach(player => {
    player.position = 0;
    player.wpm = 0;
    player.accuracy = 0;
    player.progress = 0;
    player.errors = 0;
    player.isFinished = false;
    player.lastUpdate = new Date();
  });
  
  return this.save();
};

// Cancel the race
raceSchema.methods.cancelRace = function() {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel completed race');
  }
  
  this.status = 'cancelled';
  this.completedAt = new Date();
  
  return this.save();
};

// Add spectator
raceSchema.methods.addSpectator = function(userId, username) {
  if (!this.settings.allowSpectators) {
    throw new Error('Spectators not allowed in this race');
  }
  
  // Check if user is already a spectator
  if (this.spectators.some(s => s.userId === userId)) {
    return this; // Already spectating
  }
  
  // Check if user is a player
  if (this.players.some(p => p.userId === userId)) {
    throw new Error('Players cannot spectate their own race');
  }
  
  this.spectators.push({
    userId,
    username,
    joinedAt: new Date()
  });
  
  return this.save();
};

// Remove spectator
raceSchema.methods.removeSpectator = function(userId) {
  const spectatorIndex = this.spectators.findIndex(s => s.userId === userId);
  if (spectatorIndex === -1) {
    throw new Error('Spectator not found');
  }
  
  this.spectators.splice(spectatorIndex, 1);
  
  return this.save();
};

// Get race summary
raceSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    status: this.status,
    maxPlayers: this.maxPlayers,
    currentPlayers: this.players.length,
    mode: this.mode,
    duration: this.duration,
    wordCount: this.wordCount,
    isPrivate: this.isPrivate,
    createdAt: this.createdAt
  };
};

// Static method to get available races
raceSchema.statics.getAvailable = function(filters = {}) {
  const match = { 
    isPrivate: false,
    status: filters.status || 'waiting',
    expiresAt: { $gt: new Date() }
  };
  
  return this.find(match)
    .select('-words -password')
    .populate('createdBy', 'username')
    .sort({ createdAt: -1 });
};

// Static method to cleanup expired races
raceSchema.statics.cleanupExpired = function() {
  const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  
  return this.updateMany({
    status: { $in: ['waiting', 'countdown'] },
    createdAt: { $lt: cutoffTime }
  }, {
    $set: { 
      status: 'cancelled',
      completedAt: new Date()
    }
  });
};

module.exports = mongoose.model('Race', raceSchema);