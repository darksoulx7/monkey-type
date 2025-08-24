import socketClient from './socket';
import { EventEmitter } from 'events';

/**
 * Multiplayer race WebSocket utilities
 */
class RaceSocket extends EventEmitter {
  constructor() {
    super();
    this.currentRaceId = null;
    this.isInRace = false;
    this.raceStatus = 'idle'; // idle, waiting, countdown, active, finished
    this.players = [];
    this.lastProgressUpdate = null;
    this.progressUpdateThrottle = 200; // Update progress max once per 200ms
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for race events
   */
  setupEventHandlers() {
    // Race creation and joining
    socketClient.on('race:created', (data) => {
      console.log('🏁 Race created:', data.race.id);
      this.emit('raceCreated', data);
    });

    socketClient.on('race:joined', (data) => {
      console.log('✅ Joined race:', data.race.id);
      this.currentRaceId = data.race.id;
      this.isInRace = true;
      this.raceStatus = data.race.status;
      this.players = data.race.players || [];
      this.emit('raceJoined', data);
    });

    // Player events
    socketClient.on('race:player_joined', (player) => {
      console.log('👤 Player joined race:', player.username);
      this.players.push(player);
      this.emit('playerJoined', player);
    });

    socketClient.on('race:player_left', (data) => {
      console.log('👤 Player left race:', data.username);
      this.players = this.players.filter(p => p.userId !== data.playerId);
      this.emit('playerLeft', data);
    });

    // Race lifecycle events
    socketClient.on('race:start', (data) => {
      console.log('🚀 Race starting with countdown:', data.countdown);
      this.raceStatus = 'countdown';
      this.emit('raceStart', data);
    });

    socketClient.on('race:countdown', (data) => {
      this.emit('raceCountdown', data);
    });

    socketClient.on('race:begin', (data) => {
      console.log('🏁 Race begun!');
      this.raceStatus = 'active';
      this.emit('raceBegin', data);
    });

    // Progress and completion
    socketClient.on('race:progress_update', (players) => {
      this.players = players;
      this.lastProgressUpdate = Date.now();
      this.emit('progressUpdate', players);
    });

    socketClient.on('race:player_finished', (data) => {
      console.log('🏆 Player finished:', data.username, 'Rank:', data.rank);
      this.emit('playerFinished', data);
    });

    socketClient.on('race:completed', (results) => {
      console.log('🏁 Race completed:', results);
      this.raceStatus = 'finished';
      this.emit('raceCompleted', results);
      
      // Reset state after a delay
      setTimeout(() => {
        this.reset();
      }, 30000);
    });

    // Chat events
    socketClient.on('race:message_received', (message) => {
      this.emit('chatMessage', message);
    });

    // Error handling
    socketClient.on('error', (error) => {
      if (error.code >= 2000 && error.code < 3000) {
        console.error('❌ Race error:', error);
        this.emit('raceError', error);
      }
    });
  }

  /**
   * Create a new race
   */
  async createRace(raceConfig) {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      const raceData = {
        name: raceConfig.name,
        mode: raceConfig.mode, // 'time' or 'words'
        duration: raceConfig.duration,
        wordCount: raceConfig.wordCount,
        maxPlayers: raceConfig.maxPlayers || 5,
        wordListId: raceConfig.wordListId || 'common-words',
        isPrivate: raceConfig.isPrivate || false
      };

      // Validate race configuration
      this.validateRaceConfig(raceData);

      socketClient.emit('race:create', raceData);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Race creation timeout'));
        }, 10000);

        const handleCreated = (data) => {
          clearTimeout(timeout);
          this.off('raceCreated', handleCreated);
          this.off('raceError', handleError);
          resolve(data);
        };

        const handleError = (error) => {
          clearTimeout(timeout);
          this.off('raceCreated', handleCreated);
          this.off('raceError', handleError);
          reject(error);
        };

        this.once('raceCreated', handleCreated);
        this.once('raceError', handleError);
      });
    } catch (error) {
      console.error('❌ Failed to create race:', error);
      throw error;
    }
  }

  /**
   * Join an existing race
   */
  async joinRace(raceId) {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      if (this.isInRace) {
        throw new Error('Already in a race');
      }

      socketClient.emit('race:join', { raceId });
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Race join timeout'));
        }, 10000);

        const handleJoined = (data) => {
          clearTimeout(timeout);
          this.off('raceJoined', handleJoined);
          this.off('raceError', handleError);
          resolve(data);
        };

        const handleError = (error) => {
          clearTimeout(timeout);
          this.off('raceJoined', handleJoined);
          this.off('raceError', handleError);
          reject(error);
        };

        this.once('raceJoined', handleJoined);
        this.once('raceError', handleError);
      });
    } catch (error) {
      console.error('❌ Failed to join race:', error);
      throw error;
    }
  }

  /**
   * Leave the current race
   */
  leaveRace() {
    if (this.currentRaceId) {
      socketClient.emit('race:leave', { raceId: this.currentRaceId });
      this.reset();
      this.emit('leftRace');
    }
  }

  /**
   * Send race progress update
   */
  sendProgress(progressData) {
    if (!this.isInRace || this.raceStatus !== 'active' || !socketClient.isReady()) {
      return;
    }

    // Throttle progress updates
    const now = Date.now();
    if (this.lastProgressUpdate && now - this.lastProgressUpdate < this.progressUpdateThrottle) {
      return;
    }

    const progress = {
      raceId: this.currentRaceId,
      position: progressData.position,
      wpm: progressData.wpm,
      accuracy: progressData.accuracy,
      errors: progressData.errors,
      isFinished: progressData.isFinished
    };

    // Validate progress data
    if (!this.validateProgressData(progress)) {
      console.warn('⚠️ Invalid progress data:', progress);
      return;
    }

    socketClient.emit('race:progress', progress);
    this.lastProgressUpdate = now;
  }

  /**
   * Finish the race
   */
  async finishRace(finalStats) {
    try {
      if (!this.isInRace || !this.currentRaceId) {
        throw new Error('Not in an active race');
      }

      const finishData = {
        raceId: this.currentRaceId,
        finalStats: {
          wpm: finalStats.wpm,
          accuracy: finalStats.accuracy,
          consistency: finalStats.consistency || 0,
          errors: finalStats.errors,
          finishTime: finalStats.finishTime
        }
      };

      socketClient.emit('race:finish', finishData);
      
      // Don't wait for response since race might complete immediately
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Failed to finish race:', error);
      throw error;
    }
  }

  /**
   * Send chat message in race
   */
  sendChatMessage(message) {
    if (!this.isInRace || !this.currentRaceId || !message.trim()) {
      return;
    }

    const chatData = {
      raceId: this.currentRaceId,
      message: message.trim().substring(0, 200) // Limit message length
    };

    socketClient.emit('race:message', chatData);
  }

  /**
   * Validate race configuration
   */
  validateRaceConfig(config) {
    const errors = [];

    if (!config.name || typeof config.name !== 'string' || config.name.length > 50) {
      errors.push('Race name must be a string (max 50 characters)');
    }

    if (!['time', 'words'].includes(config.mode)) {
      errors.push('Race mode must be either "time" or "words"');
    }

    if (config.mode === 'time') {
      if (!config.duration || config.duration < 15 || config.duration > 300) {
        errors.push('Race duration must be between 15 and 300 seconds');
      }
    }

    if (config.mode === 'words') {
      if (!config.wordCount || config.wordCount < 10 || config.wordCount > 200) {
        errors.push('Word count must be between 10 and 200');
      }
    }

    if (!config.maxPlayers || config.maxPlayers < 2 || config.maxPlayers > 20) {
      errors.push('Max players must be between 2 and 20');
    }

    if (errors.length > 0) {
      throw new Error(`Race configuration invalid: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate progress data
   */
  validateProgressData(progress) {
    const required = ['raceId', 'position', 'wpm', 'accuracy', 'errors', 'isFinished'];
    
    for (const field of required) {
      if (progress[field] === undefined || progress[field] === null) {
        return false;
      }
    }

    // Type validations
    return (
      typeof progress.raceId === 'string' &&
      typeof progress.position === 'number' &&
      typeof progress.wpm === 'number' &&
      typeof progress.accuracy === 'number' &&
      typeof progress.errors === 'number' &&
      typeof progress.isFinished === 'boolean'
    );
  }

  /**
   * Get current race state
   */
  getRaceState() {
    return {
      raceId: this.currentRaceId,
      isInRace: this.isInRace,
      status: this.raceStatus,
      playerCount: this.players.length,
      players: this.players,
      lastProgressUpdate: this.lastProgressUpdate
    };
  }

  /**
   * Get player by user ID
   */
  getPlayer(userId) {
    return this.players.find(p => p.userId === userId || p.id === userId);
  }

  /**
   * Get current user's position in race
   */
  getCurrentUserRank() {
    // This would need to be implemented based on how user ID is tracked
    // For now, return null
    return null;
  }

  /**
   * Reset race state
   */
  reset() {
    this.currentRaceId = null;
    this.isInRace = false;
    this.raceStatus = 'idle';
    this.players = [];
    this.lastProgressUpdate = null;
  }
}

// Create singleton instance
const raceSocket = new RaceSocket();

export default raceSocket;