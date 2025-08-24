const logger = require('../utils/logger');
const rateLimiter = require('../utils/rateLimiter');
const {
  emitError,
  emitRateLimitError,
  safeEmit,
  getUserSockets,
  isUserOnline
} = require('../utils/socketHelpers');

/**
 * Initialize friend activity and social event handlers
 */
function initializeFriendEvents(socket, io, activeConnections) {
  
  // Handle getting online friends list
  socket.on('friends:get_online', async () => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // TODO: Get user's friends list from database
      // For now, we'll simulate with a mock implementation
      const userFriends = await getUserFriends(socket.userId);
      
      const onlineFriends = [];
      
      for (const friend of userFriends) {
        if (isUserOnline(io, friend.userId)) {
          // Get friend's current activity
          const activity = await getFriendActivity(friend.userId, activeConnections);
          
          onlineFriends.push({
            userId: friend.userId,
            username: friend.username,
            avatar: friend.avatar,
            status: 'online',
            activity: activity
          });
        }
      }

      safeEmit(socket, 'friends:online_list', {
        onlineFriends,
        totalFriends: userFriends.length
      });

      logger.debug('Sent online friends list', {
        userId: socket.userId,
        onlineCount: onlineFriends.length,
        totalFriends: userFriends.length
      });

    } catch (error) {
      logger.error('Error handling friends:get_online', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to get online friends');
    }
  });

  // Handle friend invitation to race
  socket.on('friends:invite_race', async (data) => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      const { friendId, raceId, raceName } = data;
      
      if (!friendId || !raceId) {
        return emitError(socket, 4001, 'VALIDATION_ERROR', 
          'friendId and raceId are required');
      }

      // TODO: Verify friendship in database
      const areFriends = await checkFriendship(socket.userId, friendId);
      if (!areFriends) {
        return emitError(socket, 4002, 'NOT_FRIENDS', 
          'You are not friends with this user');
      }

      // Check if friend is online
      if (!isUserOnline(io, friendId)) {
        return emitError(socket, 4003, 'USER_OFFLINE', 
          'Friend is not currently online');
      }

      // Send invitation to friend
      const invitation = {
        fromUserId: socket.userId,
        fromUsername: socket.userInfo.username,
        raceId: raceId,
        raceName: raceName || 'Typing Race',
        timestamp: new Date().toISOString()
      };

      // Emit to all of friend's connected sockets
      const friendSockets = getUserSockets(io, friendId);
      friendSockets.forEach(friendSocket => {
        safeEmit(friendSocket, 'friends:race_invitation', invitation);
      });

      // Confirm invitation sent
      safeEmit(socket, 'friends:invitation_sent', {
        friendId,
        raceId
      });

      logger.info('Race invitation sent', {
        fromUserId: socket.userId,
        toUserId: friendId,
        raceId
      });

    } catch (error) {
      logger.error('Error handling friends:invite_race', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to send race invitation');
    }
  });

  // Handle friend challenge
  socket.on('friends:challenge', async (data) => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      const { friendId, challengeType, challengeData } = data;
      
      if (!friendId || !challengeType) {
        return emitError(socket, 4001, 'VALIDATION_ERROR', 
          'friendId and challengeType are required');
      }

      // TODO: Verify friendship in database
      const areFriends = await checkFriendship(socket.userId, friendId);
      if (!areFriends) {
        return emitError(socket, 4002, 'NOT_FRIENDS', 
          'You are not friends with this user');
      }

      // Check if friend is online
      if (!isUserOnline(io, friendId)) {
        return emitError(socket, 4003, 'USER_OFFLINE', 
          'Friend is not currently online');
      }

      // Create challenge object
      const challenge = {
        challengeId: require('uuid').v4(),
        fromUserId: socket.userId,
        fromUsername: socket.userInfo.username,
        fromAvatar: socket.userInfo.avatar,
        challengeType, // 'race', 'beat_score', 'daily_challenge'
        challengeData: challengeData || {},
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      };

      // Send challenge to friend
      const friendSockets = getUserSockets(io, friendId);
      friendSockets.forEach(friendSocket => {
        safeEmit(friendSocket, 'friends:challenge_received', challenge);
      });

      // Confirm challenge sent
      safeEmit(socket, 'friends:challenge_sent', {
        challengeId: challenge.challengeId,
        friendId
      });

      logger.info('Friend challenge sent', {
        challengeId: challenge.challengeId,
        fromUserId: socket.userId,
        toUserId: friendId,
        challengeType
      });

    } catch (error) {
      logger.error('Error handling friends:challenge', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to send challenge');
    }
  });

  // Handle friend status update
  socket.on('friends:update_status', async (data) => {
    try {
      const { status, activity } = data;
      
      if (!status || !['online', 'away', 'busy', 'invisible'].includes(status)) {
        return emitError(socket, 4001, 'VALIDATION_ERROR', 
          'Valid status is required');
      }

      // Update user's status in connection info
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.status = status;
        connection.activity = activity || null;
        connection.lastStatusUpdate = new Date();
      }

      // TODO: Get user's friends from database
      const userFriends = await getUserFriends(socket.userId);
      
      // Notify all online friends about status change
      for (const friend of userFriends) {
        if (isUserOnline(io, friend.userId)) {
          const friendSockets = getUserSockets(io, friend.userId);
          friendSockets.forEach(friendSocket => {
            safeEmit(friendSocket, 'friends:status_changed', {
              userId: socket.userId,
              username: socket.userInfo.username,
              status: status,
              activity: activity
            });
          });
        }
      }

      logger.debug('Friend status updated', {
        userId: socket.userId,
        status,
        activity
      });

    } catch (error) {
      logger.error('Error handling friends:update_status', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to update status');
    }
  });

  // Handle typing activity notification
  socket.on('friends:typing_activity', async (data) => {
    try {
      const { activityType, activityData } = data;
      
      // Rate limiting for activity updates
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return; // Don't emit error for activity updates, just skip
      }

      // TODO: Get user's friends from database
      const userFriends = await getUserFriends(socket.userId);
      
      // Create activity notification
      const activityNotification = {
        userId: socket.userId,
        username: socket.userInfo.username,
        avatar: socket.userInfo.avatar,
        activityType, // 'started_test', 'completed_test', 'joined_race', 'achieved_pb'
        activityData: activityData || {},
        timestamp: new Date().toISOString()
      };

      // Notify all online friends about the activity
      for (const friend of userFriends) {
        if (isUserOnline(io, friend.userId)) {
          const friendSockets = getUserSockets(io, friend.userId);
          friendSockets.forEach(friendSocket => {
            safeEmit(friendSocket, 'friends:activity_update', activityNotification);
          });
        }
      }

      logger.debug('Friend activity notification sent', {
        userId: socket.userId,
        activityType,
        notifiedFriends: userFriends.filter(f => isUserOnline(io, f.userId)).length
      });

    } catch (error) {
      logger.error('Error handling friends:typing_activity', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      // Don't emit error for activity updates to avoid spam
    }
  });

  // Handle getting friend's recent activity
  socket.on('friends:get_recent_activity', async (data) => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      const { friendId, limit = 20 } = data;
      
      if (!friendId) {
        return emitError(socket, 4001, 'VALIDATION_ERROR', 'friendId is required');
      }

      // TODO: Verify friendship and get activity from database
      const areFriends = await checkFriendship(socket.userId, friendId);
      if (!areFriends) {
        return emitError(socket, 4002, 'NOT_FRIENDS', 
          'You are not friends with this user');
      }

      const recentActivity = await getFriendRecentActivity(friendId, limit);

      safeEmit(socket, 'friends:recent_activity', {
        friendId,
        activities: recentActivity
      });

      logger.debug('Sent friend recent activity', {
        userId: socket.userId,
        friendId,
        activityCount: recentActivity.length
      });

    } catch (error) {
      logger.error('Error handling friends:get_recent_activity', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to get friend activity');
    }
  });
}

/**
 * Get user's friends list from database
 * TODO: Replace with actual database query
 */
async function getUserFriends(userId) {
  // Mock implementation - replace with actual database query
  return [
    // Example friends data
    // {
    //   userId: 'friend-id-1',
    //   username: 'speedtyper',
    //   avatar: 'avatar-url'
    // }
  ];
}

/**
 * Check if two users are friends
 * TODO: Replace with actual database query
 */
async function checkFriendship(userId1, userId2) {
  // Mock implementation - replace with actual database query
  return true; // For now, assume all users can interact
}

/**
 * Get friend's current activity
 */
async function getFriendActivity(userId, activeConnections) {
  // Check active connections for current activity
  for (const connection of activeConnections.values()) {
    if (connection.userId === userId) {
      return {
        type: connection.activity?.type || 'idle',
        data: connection.activity?.data || {},
        lastUpdated: connection.lastActivity
      };
    }
  }
  
  return {
    type: 'offline',
    data: {},
    lastUpdated: null
  };
}

/**
 * Get friend's recent activity from database
 * TODO: Replace with actual database query
 */
async function getFriendRecentActivity(friendId, limit = 20) {
  // Mock implementation - replace with actual database query
  return [
    // Example activity data
    // {
    //   id: 'activity-1',
    //   type: 'completed_test',
    //   data: {
    //     wpm: 85,
    //     accuracy: 96.5,
    //     mode: 'time',
    //     duration: 60
    //   },
    //   timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    // }
  ];
}

/**
 * Broadcast friend status change to mutual friends
 */
function broadcastStatusChange(io, userId, username, status, activeConnections) {
  // This function would be called when a user comes online/offline
  // TODO: Get mutual friends and broadcast status change
  
  logger.debug('Broadcasting status change', {
    userId,
    username,
    status
  });
}

module.exports = initializeFriendEvents;
module.exports.broadcastStatusChange = broadcastStatusChange;