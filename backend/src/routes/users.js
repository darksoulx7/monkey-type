const express = require('express');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { protect, optionalAuth, restrictTo } = require('../middleware/auth');
const { 
  validateUserProfileUpdate, 
  validatePagination,
  validateFriendRequest,
  validateUUIDParam
} = require('../middleware/validation');
const { AppError, asyncHandler } = require('../middleware/error');
const logger = require('../config/logger');

const router = express.Router();

// All routes require authentication except public profile view
router.use('/profile', protect);
router.use('/friends*', protect);

// @route   GET /api/v1/users/profile
// @desc    Get current user's profile
// @access  Private
router.get('/profile', asyncHandler(async (req, res, next) => {
  res.json({
    status: 'success',
    data: {
      user: req.user.toJSON()
    }
  });
}));

// @route   PUT /api/v1/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', validateUserProfileUpdate, asyncHandler(async (req, res, next) => {
  const updates = {};
  const allowedUpdates = ['username', 'preferences'];
  
  // Filter allowed updates
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });
  
  // Check if username is taken (if updating username)
  if (updates.username && updates.username !== req.user.username) {
    const existingUser = await User.findOne({ username: updates.username });
    if (existingUser) {
      logger.security('username_update_conflict', {
        userId: req.user._id,
        attemptedUsername: updates.username,
        ip: req.ip
      });
      return next(new AppError('Username is already taken', 409, 'USERNAME_TAKEN'));
    }
  }
  
  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  );
  
  logger.info(`👤 User ${req.user._id} updated profile:`, Object.keys(updates));
  
  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: updatedUser.toJSON()
    }
  });
}));

// @route   DELETE /api/v1/users/profile
// @desc    Deactivate user account
// @access  Private
router.delete('/profile', asyncHandler(async (req, res, next) => {
  // Deactivate account instead of deleting
  await User.findByIdAndUpdate(req.user._id, { 
    isActive: false,
    refreshTokens: [] // Clear all sessions
  });
  
  logger.auth('account_deactivated', req.user._id, req.ip, req.get('User-Agent'));
  
  res.json({
    status: 'success',
    message: 'Account has been deactivated successfully'
  });
}));

// @route   GET /api/v1/users/:userId
// @desc    Get public user profile
// @access  Public
router.get('/:userId', optionalAuth, validateUUIDParam('userId'), asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  
  const user = await User.findOne({ 
    _id: userId, 
    isActive: true 
  });
  
  if (!user) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }
  
  // Get public profile
  const publicProfile = user.getPublicProfile();
  
  // Add additional info if users are friends or if it's the same user
  if (req.user) {
    if (req.user._id === userId) {
      // Return full profile for own account
      return res.json({
        status: 'success',
        data: {
          user: user.toJSON()
        }
      });
    }
    
    // Check friendship status
    const friendshipStatus = await Friendship.getFriendshipStatus(req.user._id, userId);
    publicProfile.friendshipStatus = friendshipStatus;
  }
  
  res.json({
    status: 'success',
    data: {
      user: publicProfile
    }
  });
}));

// @route   GET /api/v1/users/friends
// @desc    Get user's friends list
// @access  Private
router.get('/friends', validatePagination, asyncHandler(async (req, res, next) => {
  const { limit = 20, offset = 0 } = req.query;
  
  const friendships = await Friendship.getFriends(req.user._id, { limit, offset });
  
  // Transform to expected format
  const friends = friendships.map(friendship => {
    const friend = friendship.requester._id === req.user._id 
      ? friendship.recipient 
      : friendship.requester;
    
    return {
      id: friend._id,
      username: friend.username,
      createdAt: friend.createdAt,
      publicStats: {
        totalTests: friend.stats?.totalTests || 0,
        bestWpm: friend.stats?.bestWpm || 0,
        averageAccuracy: friend.stats?.averageAccuracy || 0
      },
      friendedAt: friendship.respondedAt || friendship.requestedAt
    };
  });
  
  // Get total count for pagination
  const totalFriends = await Friendship.countDocuments({
    $or: [
      { requester: req.user._id, status: 'accepted' },
      { recipient: req.user._id, status: 'accepted' }
    ]
  });
  
  res.json({
    status: 'success',
    data: {
      friends,
      pagination: {
        total: totalFriends,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + friends.length < totalFriends
      }
    }
  });
}));

// @route   POST /api/v1/users/friends
// @desc    Send friend request
// @access  Private
router.post('/friends', validateFriendRequest, asyncHandler(async (req, res, next) => {
  const { userId: recipientId } = req.body;
  const requesterId = req.user._id;
  
  // Check if trying to add self
  if (requesterId === recipientId) {
    return next(new AppError('Cannot send friend request to yourself', 400, 'SELF_FRIEND_REQUEST'));
  }
  
  // Check if recipient exists and is active
  const recipient = await User.findOne({ _id: recipientId, isActive: true });
  if (!recipient) {
    return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
  }
  
  try {
    // Send friend request
    const friendship = await Friendship.sendRequest(requesterId, recipientId);
    
    logger.info(`👥 Friend request sent: ${req.user.username} -> ${recipient.username}`);
    
    res.status(201).json({
      status: 'success',
      message: 'Friend request sent successfully',
      data: {
        friendship: friendship.toJSON()
      }
    });
  } catch (error) {
    if (error.message.includes('already')) {
      return next(new AppError(error.message, 409, 'FRIENDSHIP_EXISTS'));
    }
    throw error;
  }
}));

// @route   GET /api/v1/users/friends/requests
// @desc    Get pending friend requests (received)
// @access  Private
router.get('/friends/requests', validatePagination, asyncHandler(async (req, res, next) => {
  const { limit = 20, offset = 0 } = req.query;
  
  const requests = await Friendship.getPendingRequests(req.user._id, { limit, offset });
  
  // Transform to expected format
  const friendRequests = requests.map(request => ({
    id: request._id,
    requester: {
      id: request.requester._id,
      username: request.requester.username,
      createdAt: request.requester.createdAt,
      publicStats: {
        totalTests: request.requester.stats?.totalTests || 0,
        bestWpm: request.requester.stats?.bestWpm || 0,
        averageAccuracy: request.requester.stats?.averageAccuracy || 0
      }
    },
    requestedAt: request.requestedAt,
    notes: request.notes
  }));
  
  // Get total count
  const totalRequests = await Friendship.countDocuments({
    recipient: req.user._id,
    status: 'pending'
  });
  
  res.json({
    status: 'success',
    data: {
      requests: friendRequests,
      pagination: {
        total: totalRequests,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + friendRequests.length < totalRequests
      }
    }
  });
}));

// @route   GET /api/v1/users/friends/sent
// @desc    Get sent friend requests
// @access  Private
router.get('/friends/sent', validatePagination, asyncHandler(async (req, res, next) => {
  const { limit = 20, offset = 0 } = req.query;
  
  const requests = await Friendship.getSentRequests(req.user._id, { limit, offset });
  
  const sentRequests = requests.map(request => ({
    id: request._id,
    recipient: {
      id: request.recipient._id,
      username: request.recipient.username,
      createdAt: request.recipient.createdAt
    },
    requestedAt: request.requestedAt,
    notes: request.notes
  }));
  
  const totalSentRequests = await Friendship.countDocuments({
    requester: req.user._id,
    status: 'pending'
  });
  
  res.json({
    status: 'success',
    data: {
      requests: sentRequests,
      pagination: {
        total: totalSentRequests,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + sentRequests.length < totalSentRequests
      }
    }
  });
}));

// @route   PUT /api/v1/users/friends/:requestId/accept
// @desc    Accept friend request
// @access  Private
router.put('/friends/:requestId/accept', validateUUIDParam('requestId'), asyncHandler(async (req, res, next) => {
  const { requestId } = req.params;
  
  const friendship = await Friendship.findById(requestId);
  
  if (!friendship) {
    return next(new AppError('Friend request not found', 404, 'REQUEST_NOT_FOUND'));
  }
  
  // Check if user is the recipient
  if (friendship.recipient !== req.user._id) {
    return next(new AppError('You can only accept requests sent to you', 403, 'NOT_REQUEST_RECIPIENT'));
  }
  
  // Accept the request
  await friendship.accept();
  
  // Get requester info for response
  const requester = await User.findById(friendship.requester).select('username');
  
  logger.info(`👥 Friend request accepted: ${requester.username} <-> ${req.user.username}`);
  
  res.json({
    status: 'success',
    message: 'Friend request accepted',
    data: {
      friendship: friendship.toJSON()
    }
  });
}));

// @route   PUT /api/v1/users/friends/:requestId/decline
// @desc    Decline friend request
// @access  Private
router.put('/friends/:requestId/decline', validateUUIDParam('requestId'), asyncHandler(async (req, res, next) => {
  const { requestId } = req.params;
  
  const friendship = await Friendship.findById(requestId);
  
  if (!friendship) {
    return next(new AppError('Friend request not found', 404, 'REQUEST_NOT_FOUND'));
  }
  
  // Check if user is the recipient
  if (friendship.recipient !== req.user._id) {
    return next(new AppError('You can only decline requests sent to you', 403, 'NOT_REQUEST_RECIPIENT'));
  }
  
  // Decline the request
  await friendship.decline();
  
  logger.info(`👥 Friend request declined: ${req.user._id} declined ${friendship.requester}`);
  
  res.json({
    status: 'success',
    message: 'Friend request declined'
  });
}));

// @route   DELETE /api/v1/users/friends/:userId
// @desc    Remove friend
// @access  Private
router.delete('/friends/:userId', validateUUIDParam('userId'), asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  
  // Check if they are friends
  const areFriends = await Friendship.areFriends(req.user._id, userId);
  
  if (!areFriends) {
    return next(new AppError('You are not friends with this user', 400, 'NOT_FRIENDS'));
  }
  
  // Remove friendship
  const removed = await Friendship.removeFriendship(req.user._id, userId);
  
  if (!removed) {
    return next(new AppError('Failed to remove friendship', 500, 'FRIENDSHIP_REMOVAL_FAILED'));
  }
  
  logger.info(`👥 Friendship removed: ${req.user._id} <-> ${userId}`);
  
  res.json({
    status: 'success',
    message: 'Friend removed successfully'
  });
}));

// @route   GET /api/v1/users/friends/suggestions
// @desc    Get friend suggestions
// @access  Private
router.get('/friends/suggestions', asyncHandler(async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 20);
  
  const suggestions = await Friendship.getFriendSuggestions(req.user._id, limit);
  
  res.json({
    status: 'success',
    data: {
      suggestions: suggestions.map(user => ({
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
        publicStats: {
          totalTests: user.stats?.totalTests || 0,
          bestWpm: user.stats?.bestWpm || 0,
          averageAccuracy: user.stats?.averageAccuracy || 0
        }
      }))
    }
  });
}));

// @route   GET /api/v1/users/:userId/mutual-friends
// @desc    Get mutual friends with another user
// @access  Private
router.get('/:userId/mutual-friends', protect, validateUUIDParam('userId'), asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  
  if (req.user._id === userId) {
    return next(new AppError('Cannot get mutual friends with yourself', 400, 'SELF_MUTUAL_FRIENDS'));
  }
  
  const mutualFriends = await Friendship.getMutualFriends(req.user._id, userId);
  
  res.json({
    status: 'success',
    data: {
      mutualFriends: mutualFriends.map(friend => ({
        id: friend._id,
        username: friend.username,
        createdAt: friend.createdAt,
        publicStats: {
          totalTests: friend.stats?.totalTests || 0,
          bestWpm: friend.stats?.bestWpm || 0,
          averageAccuracy: friend.stats?.averageAccuracy || 0
        }
      })),
      count: mutualFriends.length
    }
  });
}));

// @route   GET /api/v1/users/search
// @desc    Search for users
// @access  Private (to prevent abuse)
router.get('/search', protect, [
  require('express-validator').query('q')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Search query must be between 2 and 50 characters'),
  require('../middleware/validation').handleValidationErrors
], asyncHandler(async (req, res, next) => {
  const { q: query, limit = 10 } = req.query;
  
  // Search by username (case-insensitive)
  const users = await User.find({
    username: { $regex: query, $options: 'i' },
    isActive: true,
    _id: { $ne: req.user._id } // Exclude current user
  })
  .select('username createdAt stats.totalTests stats.bestWpm stats.averageAccuracy')
  .limit(Math.min(parseInt(limit), 20))
  .lean();
  
  // Add friendship status for each user
  const usersWithFriendshipStatus = await Promise.all(
    users.map(async (user) => {
      const friendshipStatus = await Friendship.getFriendshipStatus(req.user._id, user._id);
      
      return {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
        publicStats: {
          totalTests: user.stats?.totalTests || 0,
          bestWpm: user.stats?.bestWpm || 0,
          averageAccuracy: user.stats?.averageAccuracy || 0
        },
        friendshipStatus: friendshipStatus === 'none' ? null : friendshipStatus
      };
    })
  );
  
  res.json({
    status: 'success',
    data: {
      users: usersWithFriendshipStatus,
      query
    }
  });
}));

module.exports = router;