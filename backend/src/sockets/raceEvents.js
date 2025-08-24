const Joi = require('joi');
const rateLimiter = require('../utils/rateLimiter');
const logger = require('../utils/logger');
const {
  generateSessionId,
  calculateTypingStats,
  emitError,
  emitRateLimitError,
  safeEmit,
  safeBroadcast,
  generateRoomCode,
  validateRaceConfig,
  generateWords
} = require('../utils/socketHelpers');

// Joi schemas for validation
const raceCreateSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  mode: Joi.string().valid('time', 'words').required(),
  duration: Joi.number().min(15).max(300).when('mode', {
    is: 'time',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  wordCount: Joi.number().min(10).max(200).when('mode', {
    is: 'words', 
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  maxPlayers: Joi.number().min(2).max(20).default(5),
  wordListId: Joi.string().default('common-words'),
  isPrivate: Joi.boolean().default(false)
});

const raceJoinSchema = Joi.object({
  raceId: Joi.string().required()
});

const raceProgressSchema = Joi.object({
  raceId: Joi.string().required(),
  position: Joi.number().min(0).required(),
  wpm: Joi.number().min(0).required(),
  accuracy: Joi.number().min(0).max(100).required(),
  errors: Joi.number().min(0).required(),
  isFinished: Joi.boolean().required()
});

const raceFinishSchema = Joi.object({
  raceId: Joi.string().required(),
  finalStats: Joi.object({
    wpm: Joi.number().min(0).required(),
    accuracy: Joi.number().min(0).max(100).required(),
    consistency: Joi.number().min(0).max(100).optional(),
    errors: Joi.number().min(0).required(),
    finishTime: Joi.number().min(0).required()
  }).required()
});

const raceMessageSchema = Joi.object({
  raceId: Joi.string().required(),
  message: Joi.string().min(1).max(200).required()
});

/**
 * Initialize multiplayer race event handlers
 */
function initializeRaceEvents(socket, io, activeRaces) {
  
  // Handle race creation
  socket.on('race:create', async (data) => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // Validate payload
      const { error, value } = raceCreateSchema.validate(data);
      if (error) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 
          'Invalid race creation data', error.details[0].message);
      }

      // Additional validation
      const validationErrors = validateRaceConfig(value);
      if (validationErrors.length > 0) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 
          'Race configuration invalid', validationErrors.join(', '));
      }

      // Generate race ID and room code
      const raceId = generateSessionId();
      const roomCode = generateRoomCode();
      
      // Generate words based on mode
      const wordCount = value.mode === 'words' ? value.wordCount : 50;
      const words = generateWords(wordCount);

      // Create race object
      const race = {
        id: raceId,
        roomCode,
        name: value.name,
        mode: value.mode,
        duration: value.duration,
        wordCount: value.wordCount,
        maxPlayers: value.maxPlayers,
        wordListId: value.wordListId,
        isPrivate: value.isPrivate,
        words,
        createdBy: socket.userId,
        createdAt: new Date(),
        status: 'waiting', // waiting, countdown, active, finished
        players: new Map(),
        startTime: null,
        endTime: null,
        countdownStarted: false,
        results: []
      };

      // Add creator as first player
      const creatorPlayer = {
        userId: socket.userId,
        username: socket.userInfo.username,
        avatar: socket.userInfo.avatar,
        position: 0,
        wpm: 0,
        accuracy: 100,
        errors: 0,
        isFinished: false,
        finishTime: null,
        rank: null,
        keystrokes: [],
        joinedAt: new Date()
      };

      race.players.set(socket.userId, creatorPlayer);
      activeRaces.set(raceId, race);

      // Join creator to race room
      socket.join(`race:${raceId}`);

      // Send confirmation
      safeEmit(socket, 'race:created', {
        race: serializeRace(race),
        roomCode
      });

      // Auto-join creator
      safeEmit(socket, 'race:joined', {
        race: serializeRace(race),
        player: creatorPlayer
      });

      logger.info('Race created', {
        raceId,
        roomCode,
        createdBy: socket.userId,
        name: value.name,
        mode: value.mode
      });

    } catch (error) {
      logger.error('Error handling race:create', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to create race');
    }
  });

  // Handle joining race
  socket.on('race:join', async (data) => {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiter.checkGeneralRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // Validate payload
      const { error, value } = raceJoinSchema.validate(data);
      if (error) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 
          'Invalid race join data', error.details[0].message);
      }

      const { raceId } = value;
      
      // Get race
      const race = activeRaces.get(raceId);
      if (!race) {
        return emitError(socket, 2001, 'RACE_NOT_FOUND', 'Race not found');
      }

      // Check if race is full
      if (race.players.size >= race.maxPlayers) {
        return emitError(socket, 2002, 'RACE_FULL', 'Race is full');
      }

      // Check if race has started
      if (race.status === 'active') {
        return emitError(socket, 2003, 'RACE_STARTED', 'Race has already started');
      }

      if (race.status === 'finished') {
        return emitError(socket, 2004, 'RACE_FINISHED', 'Race has finished');
      }

      // Check if user is already in race
      if (race.players.has(socket.userId)) {
        // Re-join existing player
        socket.join(`race:${raceId}`);
        safeEmit(socket, 'race:joined', {
          race: serializeRace(race),
          player: race.players.get(socket.userId)
        });
        return;
      }

      // Add player to race
      const player = {
        userId: socket.userId,
        username: socket.userInfo.username,
        avatar: socket.userInfo.avatar,
        position: 0,
        wpm: 0,
        accuracy: 100,
        errors: 0,
        isFinished: false,
        finishTime: null,
        rank: null,
        keystrokes: [],
        joinedAt: new Date()
      };

      race.players.set(socket.userId, player);

      // Join race room
      socket.join(`race:${raceId}`);

      // Send confirmation to joiner
      safeEmit(socket, 'race:joined', {
        race: serializeRace(race),
        player
      });

      // Notify other players
      socket.to(`race:${raceId}`).emit('race:player_joined', player);

      logger.info('Player joined race', {
        raceId,
        userId: socket.userId,
        username: socket.userInfo.username,
        playerCount: race.players.size
      });

      // Auto-start countdown if minimum players reached
      if (race.players.size >= 2 && !race.countdownStarted) {
        startRaceCountdown(race, io);
      }

    } catch (error) {
      logger.error('Error handling race:join', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to join race');
    }
  });

  // Handle leaving race
  socket.on('race:leave', async (data) => {
    try {
      const raceId = data?.raceId;
      if (!raceId) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 'raceId is required');
      }

      const race = activeRaces.get(raceId);
      if (!race) {
        return;
      }

      // Remove player from race
      if (race.players.has(socket.userId)) {
        race.players.delete(socket.userId);
        socket.leave(`race:${raceId}`);

        // Notify other players
        socket.to(`race:${raceId}`).emit('race:player_left', {
          playerId: socket.userId,
          username: socket.userInfo.username
        });

        logger.info('Player left race', {
          raceId,
          userId: socket.userId,
          remainingPlayers: race.players.size
        });

        // Clean up empty races
        if (race.players.size === 0) {
          activeRaces.delete(raceId);
          logger.info('Empty race cleaned up', { raceId });
        }
      }

    } catch (error) {
      logger.error('Error handling race:leave', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    }
  });

  // Handle race progress updates
  socket.on('race:progress', async (data) => {
    try {
      // Rate limiting for race progress (10 per second)
      const rateLimitResult = await rateLimiter.checkRaceProgressRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // Validate payload
      const { error, value } = raceProgressSchema.validate(data);
      if (error) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 
          'Invalid race progress data', error.details[0].message);
      }

      const { raceId, position, wpm, accuracy, errors, isFinished } = value;
      
      // Get race and player
      const race = activeRaces.get(raceId);
      if (!race) {
        return emitError(socket, 2001, 'RACE_NOT_FOUND', 'Race not found');
      }

      const player = race.players.get(socket.userId);
      if (!player) {
        return emitError(socket, 2005, 'NOT_IN_RACE', 'You are not in this race');
      }

      // Only update if race is active
      if (race.status !== 'active') {
        return;
      }

      // Update player progress
      player.position = position;
      player.wpm = wpm;
      player.accuracy = accuracy;
      player.errors = errors;
      player.isFinished = isFinished;

      if (isFinished && !player.finishTime) {
        player.finishTime = Date.now() - race.startTime.getTime();
        
        // Assign rank
        const finishedPlayers = Array.from(race.players.values())
          .filter(p => p.isFinished)
          .sort((a, b) => a.finishTime - b.finishTime);
        
        player.rank = finishedPlayers.length;

        // Notify about player finish
        safeBroadcast(io, `race:${raceId}`, 'race:player_finished', {
          playerId: socket.userId,
          username: player.username,
          rank: player.rank,
          wpm: player.wpm,
          accuracy: player.accuracy,
          finishTime: player.finishTime
        });

        logger.info('Player finished race', {
          raceId,
          userId: socket.userId,
          rank: player.rank,
          finishTime: player.finishTime
        });

        // Check if race should end
        checkRaceCompletion(race, io);
      }

      // Broadcast progress update to all players
      const progressUpdate = Array.from(race.players.values()).map(p => ({
        id: p.userId,
        username: p.username,
        position: p.position,
        wpm: p.wpm,
        accuracy: p.accuracy,
        rank: p.rank || (race.players.size + 1),
        isFinished: p.isFinished
      }));

      safeBroadcast(io, `race:${raceId}`, 'race:progress_update', progressUpdate);

    } catch (error) {
      logger.error('Error handling race:progress', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to update progress');
    }
  });

  // Handle race finish
  socket.on('race:finish', async (data) => {
    try {
      // Validate payload
      const { error, value } = raceFinishSchema.validate(data);
      if (error) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 
          'Invalid race finish data', error.details[0].message);
      }

      const { raceId, finalStats } = value;
      
      // Get race and player
      const race = activeRaces.get(raceId);
      if (!race) {
        return emitError(socket, 2001, 'RACE_NOT_FOUND', 'Race not found');
      }

      const player = race.players.get(socket.userId);
      if (!player) {
        return emitError(socket, 2005, 'NOT_IN_RACE', 'You are not in this race');
      }

      // Mark player as finished
      if (!player.isFinished) {
        player.isFinished = true;
        player.finishTime = finalStats.finishTime;
        player.wpm = finalStats.wpm;
        player.accuracy = finalStats.accuracy;
        player.consistency = finalStats.consistency;
        player.errors = finalStats.errors;

        // Assign rank
        const finishedPlayers = Array.from(race.players.values())
          .filter(p => p.isFinished)
          .sort((a, b) => a.finishTime - b.finishTime);
        
        player.rank = finishedPlayers.findIndex(p => p.userId === socket.userId) + 1;

        // Notify about player finish
        safeBroadcast(io, `race:${raceId}`, 'race:player_finished', {
          playerId: socket.userId,
          username: player.username,
          rank: player.rank,
          wpm: player.wpm,
          accuracy: player.accuracy,
          finishTime: player.finishTime
        }, socket);

        logger.info('Player manually finished race', {
          raceId,
          userId: socket.userId,
          finalStats
        });

        checkRaceCompletion(race, io);
      }

    } catch (error) {
      logger.error('Error handling race:finish', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to finish race');
    }
  });

  // Handle race chat messages
  socket.on('race:message', async (data) => {
    try {
      // Rate limiting for chat (5 per minute)
      const rateLimitResult = await rateLimiter.checkChatMessageRate(socket.userId);
      if (!rateLimitResult.allowed) {
        return emitRateLimitError(socket, rateLimitResult.retryAfter);
      }

      // Validate payload
      const { error, value } = raceMessageSchema.validate(data);
      if (error) {
        return emitError(socket, 2001, 'VALIDATION_ERROR', 
          'Invalid message data', error.details[0].message);
      }

      const { raceId, message } = value;
      
      // Get race
      const race = activeRaces.get(raceId);
      if (!race) {
        return emitError(socket, 2001, 'RACE_NOT_FOUND', 'Race not found');
      }

      // Check if user is in race
      if (!race.players.has(socket.userId)) {
        return emitError(socket, 2005, 'NOT_IN_RACE', 'You are not in this race');
      }

      // Broadcast message to all players in race
      const messageData = {
        username: socket.userInfo.username,
        message: message.trim(),
        timestamp: new Date().toISOString()
      };

      safeBroadcast(io, `race:${raceId}`, 'race:message_received', messageData);

      logger.debug('Race chat message sent', {
        raceId,
        userId: socket.userId,
        messageLength: message.length
      });

    } catch (error) {
      logger.error('Error handling race:message', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      emitError(socket, 5001, 'SERVER_ERROR', 'Failed to send message');
    }
  });
}

/**
 * Start race countdown
 */
function startRaceCountdown(race, io) {
  if (race.countdownStarted || race.status !== 'waiting') {
    return;
  }

  race.countdownStarted = true;
  race.status = 'countdown';

  const countdownDuration = 5; // 5 seconds
  let countdown = countdownDuration;

  // Notify players race is starting
  safeBroadcast(io, `race:${race.id}`, 'race:start', {
    raceId: race.id,
    countdown: countdownDuration,
    words: race.words
  });

  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      safeBroadcast(io, `race:${race.id}`, 'race:countdown', {
        seconds: countdown
      });
      countdown--;
    } else {
      clearInterval(countdownInterval);
      
      // Start the race
      race.status = 'active';
      race.startTime = new Date();

      safeBroadcast(io, `race:${race.id}`, 'race:begin', {
        startTime: race.startTime.getTime(),
        words: race.words
      });

      logger.info('Race started', {
        raceId: race.id,
        playerCount: race.players.size
      });

      // Set race timeout
      const raceTimeout = race.mode === 'time' ? race.duration * 1000 : 5 * 60 * 1000; // 5 min max
      setTimeout(() => {
        if (race.status === 'active') {
          endRace(race, io);
        }
      }, raceTimeout);
    }
  }, 1000);
}

/**
 * Check if race should be completed
 */
function checkRaceCompletion(race, io) {
  const finishedPlayers = Array.from(race.players.values()).filter(p => p.isFinished);
  const totalPlayers = race.players.size;

  // End race if all players finished or time limit reached
  if (finishedPlayers.length === totalPlayers || 
      (race.mode === 'time' && Date.now() - race.startTime.getTime() >= race.duration * 1000)) {
    endRace(race, io);
  }
}

/**
 * End race and send results
 */
function endRace(race, io) {
  if (race.status === 'finished') {
    return;
  }

  race.status = 'finished';
  race.endTime = new Date();

  // Calculate final rankings
  const players = Array.from(race.players.values());
  const finishedPlayers = players.filter(p => p.isFinished);
  const unfinishedPlayers = players.filter(p => !p.isFinished);

  // Sort finished players by finish time
  finishedPlayers.sort((a, b) => a.finishTime - b.finishTime);

  // Assign final ranks
  finishedPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  // Unfinished players get ranks after finished players
  unfinishedPlayers.forEach((player, index) => {
    player.rank = finishedPlayers.length + index + 1;
  });

  const rankings = [...finishedPlayers, ...unfinishedPlayers].map(p => ({
    rank: p.rank,
    userId: p.userId,
    username: p.username,
    wpm: p.wpm,
    accuracy: p.accuracy,
    consistency: p.consistency || 0,
    errors: p.errors,
    finishTime: p.finishTime,
    isFinished: p.isFinished
  }));

  const winner = finishedPlayers[0] || players[0];

  const results = {
    raceId: race.id,
    winner: winner ? {
      userId: winner.userId,
      username: winner.username,
      wpm: winner.wpm,
      accuracy: winner.accuracy
    } : null,
    rankings,
    raceStats: {
      totalPlayers: race.players.size,
      finishedPlayers: finishedPlayers.length,
      averageWpm: players.reduce((acc, p) => acc + p.wpm, 0) / players.length,
      duration: race.endTime.getTime() - race.startTime.getTime()
    }
  };

  // Send results to all players
  safeBroadcast(io, `race:${race.id}`, 'race:completed', results);

  logger.info('Race completed', {
    raceId: race.id,
    winner: winner?.username,
    totalPlayers: race.players.size,
    finishedPlayers: finishedPlayers.length
  });

  // TODO: Save race results to database

  // Clean up race after delay
  setTimeout(() => {
    activeRaces.delete(race.id);
  }, 60000); // Keep for 1 minute
}

/**
 * Serialize race object for client
 */
function serializeRace(race) {
  return {
    id: race.id,
    roomCode: race.roomCode,
    name: race.name,
    mode: race.mode,
    duration: race.duration,
    wordCount: race.wordCount,
    maxPlayers: race.maxPlayers,
    isPrivate: race.isPrivate,
    status: race.status,
    playerCount: race.players.size,
    players: Array.from(race.players.values()).map(p => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      position: p.position,
      wpm: p.wpm,
      accuracy: p.accuracy,
      isFinished: p.isFinished,
      rank: p.rank
    })),
    createdAt: race.createdAt,
    startTime: race.startTime,
    words: race.words
  };
}

module.exports = initializeRaceEvents;