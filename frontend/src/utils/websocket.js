import { io } from 'socket.io-client'
import useAuthStore from '../store/authStore'
import useRaceStore from '../store/raceStore'
import useTypingStore from '../store/typingStore'

class WebSocketManager {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
    
    // Event listeners storage
    this.eventListeners = new Map()
    
    // Auto-connect when auth state changes
    this.setupAuthListener()
  }

  setupAuthListener() {
    useAuthStore.subscribe(
      (state) => state.isAuthenticated,
      (isAuthenticated) => {
        if (isAuthenticated) {
          this.connect()
        } else {
          this.disconnect()
        }
      }
    )
  }

  connect() {
    if (this.socket?.connected) return

    const { accessToken, isAuthenticated } = useAuthStore.getState()
    
    if (!isAuthenticated || !accessToken) {
      console.warn('Cannot connect WebSocket: not authenticated')
      return
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
    
    this.socket = io(wsUrl, {
      auth: {
        token: accessToken
      },
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 20000,
    })

    this.setupEventHandlers()
    this.reconnectAttempts = 0
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnected = false
  }

  setupEventHandlers() {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connected')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.isConnected = false
      this.emit('disconnected', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.emit('connectionError', error)
    })

    this.socket.on('auth_error', (error) => {
      console.error('WebSocket auth error:', error)
      // Force logout on auth error
      useAuthStore.getState().logout()
      this.emit('authError', error)
    })

    // Typing test events
    this.socket.on('test:joined', (data) => {
      console.log('Joined test:', data.testId)
    })

    this.socket.on('test:stats_update', (stats) => {
      // Update typing store with real-time stats
      const typingStore = useTypingStore.getState()
      if (typingStore.testId === stats.testId) {
        // Update real-time statistics
        // This is a backup to local calculations
      }
    })

    this.socket.on('test:result', (result) => {
      console.log('Test result received:', result)
      // Handle final test results
    })

    // Race events
    this.socket.on('race:created', (race) => {
      console.log('Race created:', race.id)
      useRaceStore.getState().handleRaceCreated?.(race)
    })

    this.socket.on('race:joined', (data) => {
      console.log('Joined race:', data.race.id)
      // Race store will handle this via API response
    })

    this.socket.on('race:player_joined', (player) => {
      useRaceStore.getState().handlePlayerJoined(player)
      this.emit('race:playerJoined', player)
    })

    this.socket.on('race:player_left', (data) => {
      useRaceStore.getState().handlePlayerLeft(data.playerId)
      this.emit('race:playerLeft', data)
    })

    this.socket.on('race:start', (data) => {
      useRaceStore.getState().handleRaceStart(data)
      this.emit('race:start', data)
    })

    this.socket.on('race:countdown', (data) => {
      useRaceStore.getState().handleCountdown(data.seconds)
      this.emit('race:countdown', data)
    })

    this.socket.on('race:begin', (data) => {
      useRaceStore.getState().handleRaceBegin(data)
      this.emit('race:begin', data)
    })

    this.socket.on('race:progress_update', (players) => {
      useRaceStore.getState().handleProgressUpdate(players)
      this.emit('race:progressUpdate', players)
    })

    this.socket.on('race:player_finished', (data) => {
      useRaceStore.getState().handlePlayerFinished(data)
      this.emit('race:playerFinished', data)
    })

    this.socket.on('race:completed', (results) => {
      useRaceStore.getState().handleRaceCompleted(results)
      this.emit('race:completed', results)
    })

    this.socket.on('race:message_received', (data) => {
      this.emit('race:message', data)
    })

    // Friend activity events
    this.socket.on('friend:online', (friend) => {
      this.emit('friend:online', friend)
    })

    this.socket.on('friend:offline', (friend) => {
      this.emit('friend:offline', friend)
    })

    this.socket.on('friend:test_completed', (data) => {
      this.emit('friend:testCompleted', data)
    })

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    })

    this.socket.on('validation_error', (error) => {
      console.error('WebSocket validation error:', error)
      this.emit('validationError', error)
    })

    this.socket.on('rate_limited', (error) => {
      console.warn('WebSocket rate limited:', error)
      this.emit('rateLimited', error)
    })
  }

  // Event emitter pattern for custom events
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set())
    }
    this.eventListeners.get(eventName).add(callback)
  }

  off(eventName, callback) {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName).delete(callback)
    }
  }

  emit(eventName, data) {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Event listener error:', error)
        }
      })
    }
  }

  // WebSocket emit methods
  send(eventName, data) {
    if (this.socket?.connected) {
      this.socket.emit(eventName, data)
    } else {
      console.warn('WebSocket not connected, cannot send:', eventName)
    }
  }

  // Typing test methods
  joinTest(testId) {
    this.send('test:join', { testId })
  }

  sendKeystroke(testId, keystrokeData) {
    this.send('test:keystroke', {
      testId,
      ...keystrokeData
    })
  }

  completeTest(testId, finalStats) {
    this.send('test:completed', {
      testId,
      finalStats
    })
  }

  // Race methods
  createRace(raceConfig) {
    this.send('race:create', raceConfig)
  }

  joinRace(raceId) {
    this.send('race:join', { raceId })
  }

  leaveRace(raceId) {
    this.send('race:leave', { raceId })
  }

  sendRaceProgress(raceId, progress) {
    this.send('race:progress', {
      raceId,
      ...progress
    })
  }

  finishRace(raceId, finalStats) {
    this.send('race:finish', {
      raceId,
      finalStats
    })
  }

  sendRaceMessage(raceId, message) {
    this.send('race:message', {
      raceId,
      message
    })
  }

  // Utility methods
  isConnected() {
    return this.socket?.connected || false
  }

  getConnectionState() {
    if (!this.socket) return 'disconnected'
    return this.socket.connected ? 'connected' : 'connecting'
  }

  forceReconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket.connect()
    }
  }

  updateAuth(accessToken) {
    if (this.socket) {
      this.socket.auth.token = accessToken
      if (!this.socket.connected) {
        this.socket.connect()
      }
    }
  }
}

// Create singleton instance
const websocketManager = new WebSocketManager()

// Auto-initialize when auth store is available
if (typeof window !== 'undefined') {
  // Initialize on next tick to ensure stores are ready
  setTimeout(() => {
    const { isAuthenticated } = useAuthStore.getState()
    if (isAuthenticated) {
      websocketManager.connect()
    }
  }, 0)
}

export default websocketManager