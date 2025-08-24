# WebSocket Event Documentation

## Overview

This document describes the WebSocket events used for real-time features in the MonkeyType clone application. WebSocket connections are used for:

- Real-time keystroke tracking during typing tests
- Multiplayer race rooms with live progress updates
- Live statistics updates during tests
- Real-time notifications and friend activity

## Connection and Authentication

### Connection Endpoint
```
ws://localhost:3000/ws
wss://api.typingtest.com/ws
```

### Authentication
WebSocket connections must be authenticated using JWT tokens:

```javascript
const socket = io('wss://api.typingtest.com', {
  auth: {
    token: 'jwt_access_token'
  }
});
```

### Connection Events

#### `connect`
**Direction:** Server → Client  
**Description:** Emitted when client successfully connects and authenticates

```javascript
socket.on('connect', () => {
  console.log('Connected to server');
});
```

#### `disconnect`
**Direction:** Server → Client  
**Description:** Emitted when connection is lost

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### `auth_error`
**Direction:** Server → Client  
**Description:** Emitted when authentication fails

```javascript
socket.on('auth_error', (error) => {
  console.log('Authentication failed:', error.message);
});
```

## Typing Test Events

### Real-time Statistics

#### `test:join`
**Direction:** Client → Server  
**Description:** Join a typing test session for real-time updates

```javascript
socket.emit('test:join', {
  testId: 'uuid-test-id'
});
```

#### `test:joined`
**Direction:** Server → Client  
**Description:** Confirmation of joining test session

```javascript
socket.on('test:joined', (data) => {
  console.log('Joined test:', data.testId);
});
```

#### `test:keystroke`
**Direction:** Client → Server  
**Description:** Send keystroke data for real-time processing

```javascript
socket.emit('test:keystroke', {
  testId: 'uuid-test-id',
  timestamp: 1634567890123,
  key: 'a',
  correct: true,
  position: 42,
  currentText: 'hello world and everyone else'
});
```

**Payload Schema:**
```typescript
interface KeystrokeEvent {
  testId: string;
  timestamp: number;        // Milliseconds since test start
  key: string;             // Key pressed
  correct: boolean;        // Whether keystroke was correct
  position: number;        // Current position in text
  currentText?: string;    // Current typed text (optional)
}
```

#### `test:stats_update`
**Direction:** Server → Client  
**Description:** Real-time statistics updates during typing

```javascript
socket.on('test:stats_update', (stats) => {
  updateUI({
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    consistency: stats.consistency,
    errors: stats.errors,
    position: stats.position
  });
});
```

**Payload Schema:**
```typescript
interface StatsUpdate {
  testId: string;
  wpm: number;
  accuracy: number;
  consistency: number;
  errors: number;
  position: number;
  timeElapsed: number;
  correctChars: number;
  incorrectChars: number;
}
```

#### `test:completed`
**Direction:** Client → Server  
**Description:** Notify server that test is completed

```javascript
socket.emit('test:completed', {
  testId: 'uuid-test-id',
  finalStats: {
    wpm: 85.5,
    accuracy: 96.8,
    consistency: 78.2,
    errors: 12,
    timeElapsed: 60000
  }
});
```

#### `test:result`
**Direction:** Server → Client  
**Description:** Final test results and rankings

```javascript
socket.on('test:result', (result) => {
  displayResults({
    wpm: result.wpm,
    accuracy: result.accuracy,
    globalRank: result.globalRank,
    percentile: result.percentile,
    improvement: result.improvement
  });
});
```

## Multiplayer Race Events

### Room Management

#### `race:create`
**Direction:** Client → Server  
**Description:** Create a new multiplayer race room

```javascript
socket.emit('race:create', {
  name: 'Speed Challenge',
  mode: 'time',
  duration: 60,
  maxPlayers: 5,
  wordListId: 'common-words',
  isPrivate: false
});
```

#### `race:created`
**Direction:** Server → Client  
**Description:** Confirmation of race creation

```javascript
socket.on('race:created', (race) => {
  console.log('Race created:', race.id);
  // Automatically join creator to the race
});
```

#### `race:join`
**Direction:** Client → Server  
**Description:** Join an existing race room

```javascript
socket.emit('race:join', {
  raceId: 'uuid-race-id'
});
```

#### `race:joined`
**Direction:** Server → Client  
**Description:** Successfully joined race room

```javascript
socket.on('race:joined', (data) => {
  console.log('Joined race:', data.race.id);
  updateRaceUI(data.race);
});
```

#### `race:player_joined`
**Direction:** Server → Client  
**Description:** Another player joined the race

```javascript
socket.on('race:player_joined', (player) => {
  addPlayerToRace({
    username: player.username,
    avatar: player.avatar,
    stats: player.recentStats
  });
});
```

#### `race:leave`
**Direction:** Client → Server  
**Description:** Leave a race room

```javascript
socket.emit('race:leave', {
  raceId: 'uuid-race-id'
});
```

#### `race:player_left`
**Direction:** Server → Client  
**Description:** A player left the race

```javascript
socket.on('race:player_left', (data) => {
  removePlayerFromRace(data.playerId);
});
```

### Race Lifecycle

#### `race:start`
**Direction:** Server → Client  
**Description:** Race is starting (countdown or immediate start)

```javascript
socket.on('race:start', (data) => {
  startCountdown({
    countdown: data.countdown, // seconds until start
    words: data.words,
    raceId: data.raceId
  });
});
```

#### `race:countdown`
**Direction:** Server → Client  
**Description:** Countdown updates before race starts

```javascript
socket.on('race:countdown', (data) => {
  updateCountdown(data.seconds);
});
```

#### `race:begin`
**Direction:** Server → Client  
**Description:** Race has officially begun

```javascript
socket.on('race:begin', (data) => {
  startRace({
    startTime: data.startTime,
    words: data.words
  });
});
```

### Real-time Race Progress

#### `race:progress`
**Direction:** Client → Server  
**Description:** Send typing progress during race

```javascript
socket.emit('race:progress', {
  raceId: 'uuid-race-id',
  position: 125,           // Character position
  wpm: 87.5,
  accuracy: 96.2,
  errors: 3,
  isFinished: false
});
```

#### `race:progress_update`
**Direction:** Server → Client  
**Description:** Live progress updates from all players

```javascript
socket.on('race:progress_update', (players) => {
  updateRaceProgress({
    players: [
      {
        id: 'player1',
        username: 'speedtyper',
        position: 125,
        wpm: 87.5,
        accuracy: 96.2,
        rank: 1,
        isFinished: false
      },
      // ... other players
    ]
  });
});
```

#### `race:player_finished`
**Direction:** Server → Client  
**Description:** A player has finished the race

```javascript
socket.on('race:player_finished', (data) => {
  displayPlayerFinished({
    playerId: data.playerId,
    username: data.username,
    rank: data.rank,
    finalWpm: data.wpm,
    accuracy: data.accuracy,
    finishTime: data.finishTime
  });
});
```

#### `race:finish`
**Direction:** Client → Server  
**Description:** Player has finished the race

```javascript
socket.emit('race:finish', {
  raceId: 'uuid-race-id',
  finalStats: {
    wpm: 92.3,
    accuracy: 97.8,
    consistency: 85.1,
    errors: 5,
    finishTime: 45230  // milliseconds
  }
});
```

#### `race:completed`
**Direction:** Server → Client  
**Description:** Race has ended (all players finished or timeout)

```javascript
socket.on('race:completed', (results) => {
  displayRaceResults({
    winner: results.winner,
    rankings: results.rankings,
    personalStats: results.personalStats,
    raceStats: results.raceStats
  });
});
```

### Race Chat (Optional Feature)

#### `race:message`
**Direction:** Client → Server  
**Description:** Send chat message in race room

```javascript
socket.emit('race:message', {
  raceId: 'uuid-race-id',
  message: 'Good luck everyone!'
});
```

#### `race:message_received`
**Direction:** Server → Client  
**Description:** Receive chat messages from other players

```javascript
socket.on('race:message_received', (data) => {
  displayChatMessage({
    username: data.username,
    message: data.message,
    timestamp: data.timestamp
  });
});
```

## Friend Activity Events

#### `friend:online`
**Direction:** Server → Client  
**Description:** Friend came online

```javascript
socket.on('friend:online', (friend) => {
  updateFriendStatus(friend.userId, 'online');
});
```

#### `friend:offline`
**Direction:** Server → Client  
**Description:** Friend went offline

```javascript
socket.on('friend:offline', (friend) => {
  updateFriendStatus(friend.userId, 'offline');
});
```

#### `friend:test_completed`
**Direction:** Server → Client  
**Description:** Friend completed a typing test

```javascript
socket.on('friend:test_completed', (data) => {
  showNotification({
    type: 'friend_achievement',
    message: `${data.username} just scored ${data.wpm} WPM!`,
    data: data.testResult
  });
});
```

## Error Handling

### Error Event Structure

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', {
    code: error.code,
    message: error.message,
    type: error.type,
    details: error.details
  });
});
```

### Common Error Codes

| Code | Type | Description |
|------|------|-------------|
| 1001 | AUTH_REQUIRED | Authentication token required |
| 1002 | AUTH_INVALID | Invalid or expired token |
| 1003 | AUTH_FORBIDDEN | Insufficient permissions |
| 2001 | RACE_NOT_FOUND | Race room not found |
| 2002 | RACE_FULL | Race room is full |
| 2003 | RACE_STARTED | Cannot join race that has started |
| 2004 | RACE_FINISHED | Race has already finished |
| 3001 | TEST_NOT_FOUND | Test session not found |
| 3002 | TEST_EXPIRED | Test session has expired |
| 4001 | RATE_LIMITED | Too many requests |
| 5001 | SERVER_ERROR | Internal server error |

## Rate Limiting

To prevent spam and ensure fair usage, the following rate limits apply:

- **Keystroke events**: Maximum 20 per second per test
- **Race progress**: Maximum 10 per second per race
- **Chat messages**: Maximum 5 per minute per race
- **General events**: Maximum 100 per minute per connection

When rate limits are exceeded, clients will receive a `rate_limited` error event.

## Connection Management

### Reconnection Strategy

```javascript
const socket = io('wss://api.typingtest.com', {
  auth: {
    token: getAuthToken()
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 20000
});

// Handle reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Rejoin any active sessions
  rejoinActiveSessions();
});
```

### Heartbeat/Ping

The server automatically sends ping/pong frames to maintain connection health. No client action required.

## Event Payload Validation

All event payloads are validated against schemas. Invalid payloads will result in validation error events:

```javascript
socket.on('validation_error', (error) => {
  console.error('Validation failed:', error.field, error.message);
});
```

## Security Considerations

1. **Authentication**: All WebSocket connections must be authenticated
2. **Rate limiting**: Implemented to prevent abuse
3. **Input validation**: All event payloads are validated
4. **CORS**: WebSocket origins are restricted in production
5. **SSL/TLS**: All production connections use WSS (WebSocket Secure)

## Testing WebSocket Events

### Development Tools

```javascript
// Connect to development server
const testSocket = io('ws://localhost:3000', {
  auth: { token: 'test-jwt-token' }
});

// Test keystroke events
testSocket.emit('test:keystroke', {
  testId: 'test-id',
  timestamp: Date.now(),
  key: 'a',
  correct: true,
  position: 0
});

// Monitor all events
testSocket.onAny((eventName, data) => {
  console.log('Event:', eventName, data);
});
```

### Mock Data for Testing

```javascript
// Mock race creation
const mockRace = {
  name: 'Test Race',
  mode: 'time',
  duration: 30,
  maxPlayers: 3,
  wordListId: 'test-words'
};

// Mock keystroke data
const mockKeystroke = {
  testId: 'test-123',
  timestamp: Date.now() - performance.now(),
  key: 'h',
  correct: true,
  position: 0
};
```

This WebSocket implementation provides low-latency real-time features essential for a competitive typing test application while maintaining reliability and security.