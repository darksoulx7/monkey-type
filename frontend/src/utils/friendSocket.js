import socketClient from './socket';
import { EventEmitter } from 'events';

/**
 * Friend activity WebSocket utilities
 */
class FriendSocket extends EventEmitter {
  constructor() {
    super();
    this.onlineFriends = new Map();
    this.recentActivity = [];
    this.currentStatus = 'online';
    this.currentActivity = null;
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for friend events
   */
  setupEventHandlers() {
    // Friend status events
    socketClient.on('friend:online', (friend) => {
      console.log('👋 Friend came online:', friend.username);
      this.onlineFriends.set(friend.userId, {
        ...friend,
        status: 'online',
        lastSeen: new Date()
      });
      this.emit('friendOnline', friend);
    });

    socketClient.on('friend:offline', (friend) => {
      console.log('👋 Friend went offline:', friend.username);
      this.onlineFriends.delete(friend.userId);
      this.emit('friendOffline', friend);
    });

    socketClient.on('friends:online_list', (data) => {
      console.log('📋 Received online friends list:', data.onlineFriends.length);
      
      // Update online friends map
      this.onlineFriends.clear();
      data.onlineFriends.forEach(friend => {
        this.onlineFriends.set(friend.userId, friend);
      });
      
      this.emit('onlineFriendsList', data);
    });

    // Friend activity events
    socketClient.on('friend:test_completed', (data) => {
      console.log('🎯 Friend completed test:', data.username, data.wpm, 'WPM');
      this.addRecentActivity({
        type: 'test_completed',
        userId: data.userId,
        username: data.username,
        data: data.testResult,
        timestamp: new Date()
      });
      this.emit('friendTestCompleted', data);
    });

    socketClient.on('friends:activity_update', (activity) => {
      console.log('📈 Friend activity update:', activity.username, activity.activityType);
      this.addRecentActivity({
        type: activity.activityType,
        userId: activity.userId,
        username: activity.username,
        data: activity.activityData,
        timestamp: new Date(activity.timestamp)
      });
      this.emit('friendActivity', activity);
    });

    socketClient.on('friends:status_changed', (data) => {
      console.log('📊 Friend status changed:', data.username, data.status);
      const friend = this.onlineFriends.get(data.userId);
      if (friend) {
        friend.status = data.status;
        friend.activity = data.activity;
      }
      this.emit('friendStatusChanged', data);
    });

    // Invitations and challenges
    socketClient.on('friends:race_invitation', (invitation) => {
      console.log('🏁 Race invitation from:', invitation.fromUsername);
      this.emit('raceInvitation', invitation);
    });

    socketClient.on('friends:challenge_received', (challenge) => {
      console.log('⚔️ Challenge received from:', challenge.fromUsername);
      this.emit('challengeReceived', challenge);
    });

    socketClient.on('friends:invitation_sent', (data) => {
      this.emit('invitationSent', data);
    });

    socketClient.on('friends:challenge_sent', (data) => {
      this.emit('challengeSent', data);
    });

    // Recent activity
    socketClient.on('friends:recent_activity', (data) => {
      this.emit('recentActivity', data);
    });
  }

  /**
   * Get list of online friends
   */
  async getOnlineFriends() {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      socketClient.emit('friends:get_online');
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Get online friends timeout'));
        }, 5000);

        const handleList = (data) => {
          clearTimeout(timeout);
          this.off('onlineFriendsList', handleList);
          resolve(data);
        };

        this.once('onlineFriendsList', handleList);
      });
    } catch (error) {
      console.error('❌ Failed to get online friends:', error);
      throw error;
    }
  }

  /**
   * Invite friend to race
   */
  async inviteFriendToRace(friendId, raceId, raceName) {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      if (!friendId || !raceId) {
        throw new Error('friendId and raceId are required');
      }

      const invitationData = {
        friendId,
        raceId,
        raceName: raceName || 'Typing Race'
      };

      socketClient.emit('friends:invite_race', invitationData);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Race invitation timeout'));
        }, 5000);

        const handleSent = (data) => {
          clearTimeout(timeout);
          this.off('invitationSent', handleSent);
          this.off('error', handleError);
          resolve(data);
        };

        const handleError = (error) => {
          if (error.code >= 4000 && error.code < 5000) {
            clearTimeout(timeout);
            this.off('invitationSent', handleSent);
            this.off('error', handleError);
            reject(error);
          }
        };

        this.once('invitationSent', handleSent);
        socketClient.once('error', handleError);
      });
    } catch (error) {
      console.error('❌ Failed to invite friend to race:', error);
      throw error;
    }
  }

  /**
   * Send challenge to friend
   */
  async challengeFriend(friendId, challengeType, challengeData = {}) {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      if (!friendId || !challengeType) {
        throw new Error('friendId and challengeType are required');
      }

      const challengePayload = {
        friendId,
        challengeType, // 'race', 'beat_score', 'daily_challenge'
        challengeData
      };

      socketClient.emit('friends:challenge', challengePayload);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Challenge timeout'));
        }, 5000);

        const handleSent = (data) => {
          clearTimeout(timeout);
          this.off('challengeSent', handleSent);
          this.off('error', handleError);
          resolve(data);
        };

        const handleError = (error) => {
          if (error.code >= 4000 && error.code < 5000) {
            clearTimeout(timeout);
            this.off('challengeSent', handleSent);
            this.off('error', handleError);
            reject(error);
          }
        };

        this.once('challengeSent', handleSent);
        socketClient.once('error', handleError);
      });
    } catch (error) {
      console.error('❌ Failed to challenge friend:', error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  updateStatus(status, activity = null) {
    if (!socketClient.isReady()) {
      console.warn('⚠️ Cannot update status - socket not connected');
      return;
    }

    if (!['online', 'away', 'busy', 'invisible'].includes(status)) {
      throw new Error('Invalid status');
    }

    this.currentStatus = status;
    this.currentActivity = activity;

    const statusData = {
      status,
      activity
    };

    socketClient.emit('friends:update_status', statusData);
  }

  /**
   * Send typing activity notification
   */
  sendActivity(activityType, activityData = {}) {
    if (!socketClient.isReady()) {
      return;
    }

    const activityPayload = {
      activityType, // 'started_test', 'completed_test', 'joined_race', 'achieved_pb'
      activityData
    };

    socketClient.emit('friends:typing_activity', activityPayload);
  }

  /**
   * Get friend's recent activity
   */
  async getFriendRecentActivity(friendId, limit = 20) {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      if (!friendId) {
        throw new Error('friendId is required');
      }

      const requestData = {
        friendId,
        limit
      };

      socketClient.emit('friends:get_recent_activity', requestData);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Get recent activity timeout'));
        }, 5000);

        const handleActivity = (data) => {
          clearTimeout(timeout);
          this.off('recentActivity', handleActivity);
          resolve(data);
        };

        this.once('recentActivity', handleActivity);
      });
    } catch (error) {
      console.error('❌ Failed to get friend recent activity:', error);
      throw error;
    }
  }

  /**
   * Add activity to recent activity list
   */
  addRecentActivity(activity) {
    this.recentActivity.unshift(activity);
    
    // Keep only recent 100 activities
    if (this.recentActivity.length > 100) {
      this.recentActivity = this.recentActivity.slice(0, 100);
    }
  }

  /**
   * Get online friends list
   */
  getOnlineFriendsList() {
    return Array.from(this.onlineFriends.values());
  }

  /**
   * Check if friend is online
   */
  isFriendOnline(userId) {
    return this.onlineFriends.has(userId);
  }

  /**
   * Get friend info
   */
  getFriend(userId) {
    return this.onlineFriends.get(userId);
  }

  /**
   * Get recent activity
   */
  getRecentActivity(limit = 20) {
    return this.recentActivity.slice(0, limit);
  }

  /**
   * Clear recent activity
   */
  clearRecentActivity() {
    this.recentActivity = [];
  }

  /**
   * Get current status
   */
  getCurrentStatus() {
    return {
      status: this.currentStatus,
      activity: this.currentActivity
    };
  }

  /**
   * Reset friend socket state
   */
  reset() {
    this.onlineFriends.clear();
    this.recentActivity = [];
    this.currentStatus = 'online';
    this.currentActivity = null;
  }
}

// Create singleton instance
const friendSocket = new FriendSocket();

export default friendSocket;