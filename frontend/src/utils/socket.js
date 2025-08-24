import { io } from 'socket.io-client';
import { EventEmitter } from 'events';

/**
 * WebSocket client utility with automatic reconnection and state management
 */
class SocketClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, authenticated
    this.eventQueue = [];
    this.currentUser = null;
    
    // Bind methods to maintain context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.emit = this.emit.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  async connect(token, options = {}) {
    if (this.isConnecting || this.socket?.connected) {
      return;
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';
    
    const serverUrl = options.url || process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    
    try {
      console.log('🔌 Connecting to WebSocket server...', serverUrl);
      
      this.socket = io(serverUrl, {
        auth: { token },
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000,
        transports: ['websocket', 'polling'],
        ...options
      });

      this.setupEventHandlers();
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error);
      this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Setup event handlers for socket connection
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectionState = 'connected';
      this.emit('connected');
      this.processQueuedEvents();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.isAuthenticated = false;
      this.connectionState = 'disconnected';
      this.emit('disconnected', reason);
      
      // Attempt reconnection for certain reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - don't reconnect immediately
        this.scheduleReconnect(5000);
      } else {
        // Client-side disconnect or transport error - reconnect
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.handleConnectionError(error);
    });

    // Authentication events
    this.socket.on('auth_error', (error) => {
      console.error('❌ WebSocket authentication error:', error);
      this.isAuthenticated = false;
      this.emit('authError', error);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', error);
    });

    // Rate limiting
    this.socket.on('rate_limited', (data) => {
      console.warn('⚠️ Rate limited:', data);
      this.emit('rateLimited', data);
    });

    // Validation errors
    this.socket.on('validation_error', (error) => {
      console.warn('⚠️ Validation error:', error);
      this.emit('validationError', error);
    });

    // Friend events
    this.socket.on('friend:online', (friend) => {
      this.emit('friendOnline', friend);
    });

    this.socket.on('friend:offline', (friend) => {
      this.emit('friendOffline', friend);
    });

    this.socket.on('friend:test_completed', (data) => {
      this.emit('friendTestCompleted', data);
    });

    // Heartbeat
    this.socket.on('pong', () => {
      // Server responded to ping
    });
  }

  /**
   * Handle connection errors
   */
  handleConnectionError(error) {
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.connectionState = 'disconnected';
    this.emit('connectionError', error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.emit('maxReconnectAttemptsReached');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect(delay) {
    if (this.isConnecting) return;
    
    const reconnectDelay = delay || Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    console.log(`🔄 Scheduling reconnect in ${reconnectDelay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.attemptReconnect();
    }, reconnectDelay);
  }

  /**
   * Attempt to reconnect
   */
  async attemptReconnect() {
    if (this.isConnecting || this.socket?.connected) return;
    
    this.reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    try {
      // Get fresh token if available
      const token = await this.getAuthToken();
      if (token) {
        await this.connect(token);
      } else {
        throw new Error('No authentication token available');
      }
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      this.handleConnectionError(error);
    }
  }

  /**
   * Get authentication token (should be implemented by the app)
   */
  async getAuthToken() {
    // This should be implemented to get a fresh JWT token
    // Example: return localStorage.getItem('authToken');
    return null;
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.connectionState = 'disconnected';
  }

  /**
   * Send event to server (with queuing if not connected)
   */
  emit(event, data, callback) {
    // If this is an internal event, use EventEmitter
    if (typeof event === 'string' && this.listenerCount(event) > 0) {
      return super.emit(event, data, callback);
    }

    if (!this.socket || !this.socket.connected) {
      // Queue event for when connection is restored
      this.eventQueue.push({ event, data, callback, timestamp: Date.now() });
      console.warn(`⚠️ Event ${event} queued (not connected)`);
      return;
    }

    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  /**
   * Listen for events from server
   */
  on(event, handler) {
    if (this.socket) {
      this.socket.on(event, handler);
    }
    
    // Also add to EventEmitter for internal events
    super.on(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.socket) {
      this.socket.off(event, handler);
    }
    
    super.off(event, handler);
  }

  /**
   * Process queued events after reconnection
   */
  processQueuedEvents() {
    const maxAge = 30000; // 30 seconds
    const now = Date.now();
    
    while (this.eventQueue.length > 0) {
      const queuedEvent = this.eventQueue.shift();
      
      // Skip old events
      if (now - queuedEvent.timestamp > maxAge) {
        console.warn(`⚠️ Skipping old queued event: ${queuedEvent.event}`);
        continue;
      }
      
      console.log(`📤 Processing queued event: ${queuedEvent.event}`);
      this.emit(queuedEvent.event, queuedEvent.data, queuedEvent.callback);
    }
  }

  /**
   * Send ping to server
   */
  ping() {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  /**
   * Get connection state
   */
  getState() {
    return {
      connected: this.socket?.connected || false,
      authenticated: this.isAuthenticated,
      connecting: this.isConnecting,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      queuedEvents: this.eventQueue.length
    };
  }

  /**
   * Check if socket is connected and ready
   */
  isReady() {
    return this.socket?.connected && this.isAuthenticated;
  }
}

// Create singleton instance
const socketClient = new SocketClient();

// Export both the class and the singleton
export { SocketClient };
export default socketClient;