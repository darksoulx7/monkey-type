const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const friendshipSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  requester: {
    type: String,
    ref: 'User',
    required: [true, 'Requester is required'],
    index: true
  },
  recipient: {
    type: String,
    ref: 'User',
    required: [true, 'Recipient is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending',
    index: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Notes cannot exceed 200 characters']
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

// Compound indexes for better query performance
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ status: 1, requestedAt: -1 });

// Validation to prevent self-friendship
friendshipSchema.pre('save', function(next) {
  if (this.requester === this.recipient) {
    return next(new Error('Cannot send friend request to yourself'));
  }
  next();
});

// Update respondedAt when status changes
friendshipSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.respondedAt) {
    this.respondedAt = new Date();
  }
  next();
});

// Instance method to accept friend request
friendshipSchema.methods.accept = function() {
  if (this.status !== 'pending') {
    throw new Error('Can only accept pending friend requests');
  }
  
  this.status = 'accepted';
  this.respondedAt = new Date();
  
  return this.save();
};

// Instance method to decline friend request
friendshipSchema.methods.decline = function() {
  if (this.status !== 'pending') {
    throw new Error('Can only decline pending friend requests');
  }
  
  this.status = 'declined';
  this.respondedAt = new Date();
  
  return this.save();
};

// Instance method to block user
friendshipSchema.methods.block = function() {
  this.status = 'blocked';
  this.respondedAt = new Date();
  
  return this.save();
};

// Static method to send friend request
friendshipSchema.statics.sendRequest = async function(requesterId, recipientId, notes = '') {
  // Check if friendship already exists
  const existingFriendship = await this.findOne({
    $or: [
      { requester: requesterId, recipient: recipientId },
      { requester: recipientId, recipient: requesterId }
    ]
  });
  
  if (existingFriendship) {
    if (existingFriendship.status === 'pending') {
      throw new Error('Friend request already sent');
    } else if (existingFriendship.status === 'accepted') {
      throw new Error('Already friends with this user');
    } else if (existingFriendship.status === 'blocked') {
      throw new Error('Cannot send friend request to this user');
    } else if (existingFriendship.status === 'declined') {
      // Allow resending after decline, but update the existing record
      existingFriendship.status = 'pending';
      existingFriendship.requester = requesterId;
      existingFriendship.recipient = recipientId;
      existingFriendship.requestedAt = new Date();
      existingFriendship.respondedAt = undefined;
      existingFriendship.notes = notes;
      
      return await existingFriendship.save();
    }
  }
  
  // Create new friend request
  const friendship = new this({
    requester: requesterId,
    recipient: recipientId,
    notes: notes,
    status: 'pending'
  });
  
  return await friendship.save();
};

// Static method to get user's friends
friendshipSchema.statics.getFriends = function(userId, options = {}) {
  const { limit = 20, offset = 0, status = 'accepted' } = options;
  
  return this.find({
    $or: [
      { requester: userId, status: status },
      { recipient: userId, status: status }
    ]
  })
  .populate('requester', 'username createdAt stats.bestWpm stats.averageAccuracy stats.totalTests')
  .populate('recipient', 'username createdAt stats.bestWpm stats.averageAccuracy stats.totalTests')
  .sort({ respondedAt: -1, requestedAt: -1 })
  .limit(limit)
  .skip(offset);
};

// Static method to get pending friend requests (received)
friendshipSchema.statics.getPendingRequests = function(userId, options = {}) {
  const { limit = 20, offset = 0 } = options;
  
  return this.find({
    recipient: userId,
    status: 'pending'
  })
  .populate('requester', 'username createdAt stats.bestWpm stats.averageAccuracy stats.totalTests')
  .sort({ requestedAt: -1 })
  .limit(limit)
  .skip(offset);
};

// Static method to get sent friend requests
friendshipSchema.statics.getSentRequests = function(userId, options = {}) {
  const { limit = 20, offset = 0 } = options;
  
  return this.find({
    requester: userId,
    status: 'pending'
  })
  .populate('recipient', 'username createdAt')
  .sort({ requestedAt: -1 })
  .limit(limit)
  .skip(offset);
};

// Static method to check if users are friends
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
  
  return !!friendship;
};

// Static method to get friendship status between two users
friendshipSchema.statics.getFriendshipStatus = async function(userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 }
    ]
  });
  
  if (!friendship) {
    return 'none';
  }
  
  return {
    status: friendship.status,
    requester: friendship.requester,
    recipient: friendship.recipient,
    requestedAt: friendship.requestedAt,
    respondedAt: friendship.respondedAt
  };
};

// Static method to remove friendship
friendshipSchema.statics.removeFriendship = async function(userId1, userId2) {
  const result = await this.deleteOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
  
  return result.deletedCount > 0;
};

// Static method to get friends leaderboard
friendshipSchema.statics.getFriendsLeaderboard = async function(userId, filters = {}) {
  const { mode = 'time', duration, wordCount, period = 'allTime', limit = 20 } = filters;
  
  // First get all friends
  const friendships = await this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' }
    ]
  }).lean();
  
  // Extract friend user IDs
  const friendIds = friendships.map(f => 
    f.requester === userId ? f.recipient : f.requester
  );
  
  // Include the user themselves
  friendIds.push(userId);
  
  // Import TestResult model (avoiding circular dependency)
  const TestResult = mongoose.model('TestResult');
  
  // Build match criteria for test results
  const match = {
    userId: { $in: friendIds }
  };
  
  if (mode) match.mode = mode;
  if (duration) match.duration = duration;
  if (wordCount) match.wordCount = wordCount;
  
  // Add period filter
  if (period && period !== 'allTime') {
    const periodStart = new Date();
    switch (period) {
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
  
  // Aggregate to get best results for each friend
  return TestResult.aggregate([
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
        rank: 0, // Will be added after sorting
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
    { $sort: { wpm: -1, accuracy: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get mutual friends
friendshipSchema.statics.getMutualFriends = async function(userId1, userId2) {
  // Get friends of both users
  const [user1Friends, user2Friends] = await Promise.all([
    this.getFriends(userId1),
    this.getFriends(userId2)
  ]);
  
  // Extract friend IDs
  const user1FriendIds = user1Friends.map(f => 
    f.requester._id === userId1 ? f.recipient._id : f.requester._id
  );
  
  const user2FriendIds = user2Friends.map(f => 
    f.requester._id === userId2 ? f.recipient._id : f.requester._id
  );
  
  // Find intersection
  const mutualFriendIds = user1FriendIds.filter(id => user2FriendIds.includes(id));
  
  // Get full user details for mutual friends
  const User = mongoose.model('User');
  return User.find({ _id: { $in: mutualFriendIds } })
    .select('username createdAt stats.bestWpm stats.averageAccuracy stats.totalTests')
    .lean();
};

// Static method to get friend suggestions
friendshipSchema.statics.getFriendSuggestions = async function(userId, limit = 10) {
  // Get user's current friends and sent/received requests
  const [friends, sentRequests, receivedRequests] = await Promise.all([
    this.getFriends(userId),
    this.getSentRequests(userId),
    this.getPendingRequests(userId)
  ]);
  
  // Extract all user IDs to exclude
  const excludeIds = new Set([userId]);
  
  friends.forEach(f => {
    excludeIds.add(f.requester._id === userId ? f.recipient._id : f.requester._id);
  });
  
  sentRequests.forEach(r => excludeIds.add(r.recipient._id));
  receivedRequests.forEach(r => excludeIds.add(r.requester._id));
  
  // Find users with similar typing stats (simple suggestion algorithm)
  const User = mongoose.model('User');
  const currentUser = await User.findById(userId).select('stats').lean();
  
  if (!currentUser) return [];
  
  const suggestions = await User.find({
    _id: { $nin: Array.from(excludeIds) },
    isActive: true,
    'stats.totalTests': { $gt: 0 }
  })
  .select('username createdAt stats.bestWpm stats.averageAccuracy stats.totalTests')
  .limit(limit * 2) // Get more to filter better matches
  .lean();
  
  // Sort by similarity in WPM (simple algorithm)
  const userWpm = currentUser.stats.bestWpm || 0;
  
  const sortedSuggestions = suggestions
    .map(user => ({
      ...user,
      wpmDifference: Math.abs((user.stats.bestWpm || 0) - userWpm)
    }))
    .sort((a, b) => a.wpmDifference - b.wpmDifference)
    .slice(0, limit)
    .map(({ wpmDifference, ...user }) => user);
  
  return sortedSuggestions;
};

module.exports = mongoose.model('Friendship', friendshipSchema);