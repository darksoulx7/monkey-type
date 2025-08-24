import { EventEmitter } from 'events';

/**
 * Comprehensive error handling and recovery for WebSocket connections
 */
class SocketErrorHandler extends EventEmitter {
  constructor() {
    super();
    this.errorCounts = new Map();
    this.recoveryStrategies = new Map();
    this.isRecovering = false;
    this.maxRecoveryAttempts = 3;
    this.errorHistory = [];
    this.maxErrorHistory = 50;
    
    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeRecoveryStrategies() {
    // Authentication errors
    this.recoveryStrategies.set('AUTH_REQUIRED', {
      action: 'refreshToken',
      maxAttempts: 2,
      delay: 1000,
      userMessage: 'Authentication required. Please log in again.'
    });

    this.recoveryStrategies.set('AUTH_INVALID', {
      action: 'refreshToken',
      maxAttempts: 2,
      delay: 1000,
      userMessage: 'Session expired. Please log in again.'
    });

    this.recoveryStrategies.set('AUTH_FORBIDDEN', {
      action: 'logout',
      maxAttempts: 1,
      delay: 0,
      userMessage: 'Access denied. Please contact support.'
    });

    // Connection errors
    this.recoveryStrategies.set('CONNECTION_ERROR', {
      action: 'reconnect',
      maxAttempts: 5,
      delay: 2000,
      userMessage: 'Connection lost. Attempting to reconnect...'
    });

    this.recoveryStrategies.set('TIMEOUT', {
      action: 'reconnect',
      maxAttempts: 3,
      delay: 3000,
      userMessage: 'Connection timeout. Retrying...'
    });

    // Race/Test errors
    this.recoveryStrategies.set('RACE_NOT_FOUND', {
      action: 'redirectToLobby',
      maxAttempts: 1,
      delay: 0,
      userMessage: 'Race not found. Returning to lobby.'
    });

    this.recoveryStrategies.set('RACE_FULL', {
      action: 'findAlternativeRace',
      maxAttempts: 1,
      delay: 0,
      userMessage: 'Race is full. Looking for alternatives...'
    });

    this.recoveryStrategies.set('TEST_NOT_FOUND', {
      action: 'restartTest',
      maxAttempts: 2,
      delay: 1000,
      userMessage: 'Test session lost. Restarting...'
    });

    // Rate limiting
    this.recoveryStrategies.set('RATE_LIMITED', {
      action: 'backoff',
      maxAttempts: 1,
      delay: 5000,
      userMessage: 'Rate limited. Please slow down.'
    });

    // Server errors
    this.recoveryStrategies.set('SERVER_ERROR', {
      action: 'retry',
      maxAttempts: 3,
      delay: 2000,
      userMessage: 'Server error occurred. Retrying...'
    });

    // Network errors
    this.recoveryStrategies.set('NETWORK_ERROR', {
      action: 'checkConnectivity',
      maxAttempts: 3,
      delay: 3000,
      userMessage: 'Network error. Checking connection...'
    });
  }

  /**
   * Handle WebSocket errors with recovery strategies
   */
  async handleError(error, context = {}) {
    try {
      console.error('🔥 WebSocket error:', error, context);
      
      // Add to error history
      this.addToErrorHistory(error, context);
      
      // Determine error type
      const errorType = this.determineErrorType(error);
      
      // Get recovery strategy
      const strategy = this.recoveryStrategies.get(errorType);
      
      if (!strategy) {
        console.warn('⚠️ No recovery strategy for error type:', errorType);
        this.emit('unhandledError', { error, errorType, context });
        return false;
      }

      // Check if we've exceeded max attempts for this error
      const errorCount = this.getErrorCount(errorType);
      if (errorCount >= strategy.maxAttempts) {
        console.error('❌ Max recovery attempts exceeded for:', errorType);
        this.emit('maxAttemptsExceeded', { error, errorType, attempts: errorCount });
        return false;
      }

      // Increment error count
      this.incrementErrorCount(errorType);

      // Emit user-friendly error message
      this.emit('userError', {
        type: errorType,
        message: strategy.userMessage,
        severity: this.getErrorSeverity(errorType),
        canRetry: errorCount < strategy.maxAttempts - 1
      });

      // Execute recovery strategy
      const recovered = await this.executeRecoveryStrategy(errorType, strategy, error, context);
      
      if (recovered) {
        console.log('✅ Error recovery successful for:', errorType);
        this.resetErrorCount(errorType);
        this.emit('recoverySuccess', { errorType, strategy: strategy.action });
      } else {
        console.error('❌ Error recovery failed for:', errorType);
        this.emit('recoveryFailed', { errorType, strategy: strategy.action });
      }

      return recovered;
    } catch (recoveryError) {
      console.error('❌ Error during recovery:', recoveryError);
      this.emit('recoveryException', { originalError: error, recoveryError });
      return false;
    }
  }

  /**
   * Execute recovery strategy
   */
  async executeRecoveryStrategy(errorType, strategy, error, context) {
    this.isRecovering = true;
    
    try {
      // Wait for delay
      if (strategy.delay > 0) {
        await this.delay(strategy.delay);
      }

      switch (strategy.action) {
        case 'refreshToken':
          return await this.refreshAuthToken();
        
        case 'logout':
          return await this.performLogout();
        
        case 'reconnect':
          return await this.performReconnect(context);
        
        case 'redirectToLobby':
          return await this.redirectToLobby();
        
        case 'findAlternativeRace':
          return await this.findAlternativeRace(context);
        
        case 'restartTest':
          return await this.restartTest(context);
        
        case 'backoff':
          return await this.performBackoff(strategy.delay);
        
        case 'retry':
          return await this.retryLastAction(context);
        
        case 'checkConnectivity':
          return await this.checkNetworkConnectivity();
        
        default:
          console.warn('⚠️ Unknown recovery action:', strategy.action);
          return false;
      }
    } catch (error) {
      console.error('❌ Recovery strategy execution failed:', error);
      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Recovery strategy implementations
   */
  
  async refreshAuthToken() {
    try {
      // This should be implemented by the application
      this.emit('needTokenRefresh');
      
      // Wait for token refresh
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);
        
        this.once('tokenRefreshed', () => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        this.once('tokenRefreshFailed', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return false;
    }
  }

  async performLogout() {
    try {
      this.emit('forceLogout');
      return true;
    } catch (error) {
      console.error('❌ Logout failed:', error);
      return false;
    }
  }

  async performReconnect(context) {
    try {
      this.emit('needReconnect', context);
      return true;
    } catch (error) {
      console.error('❌ Reconnect failed:', error);
      return false;
    }
  }

  async redirectToLobby() {
    try {
      this.emit('redirectToLobby');
      return true;
    } catch (error) {
      console.error('❌ Redirect to lobby failed:', error);
      return false;
    }
  }

  async findAlternativeRace(context) {
    try {
      this.emit('findAlternativeRace', context);
      return true;
    } catch (error) {
      console.error('❌ Find alternative race failed:', error);
      return false;
    }
  }

  async restartTest(context) {
    try {
      this.emit('restartTest', context);
      return true;
    } catch (error) {
      console.error('❌ Restart test failed:', error);
      return false;
    }
  }

  async performBackoff(delay) {
    try {
      await this.delay(delay);
      this.emit('backoffComplete');
      return true;
    } catch (error) {
      console.error('❌ Backoff failed:', error);
      return false;
    }
  }

  async retryLastAction(context) {
    try {
      this.emit('retryLastAction', context);
      return true;
    } catch (error) {
      console.error('❌ Retry last action failed:', error);
      return false;
    }
  }

  async checkNetworkConnectivity() {
    try {
      // Simple connectivity check
      const response = await fetch('/health', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        this.emit('connectivityRestored');
        return true;
      } else {
        this.emit('connectivityIssue', { status: response.status });
        return false;
      }
    } catch (error) {
      console.error('❌ Connectivity check failed:', error);
      this.emit('connectivityIssue', { error });
      return false;
    }
  }

  /**
   * Determine error type from error object
   */
  determineErrorType(error) {
    if (error.type) {
      return error.type;
    }
    
    if (error.code) {
      // Map error codes to types
      const codeTypeMap = {
        1001: 'AUTH_REQUIRED',
        1002: 'AUTH_INVALID', 
        1003: 'AUTH_FORBIDDEN',
        2001: 'RACE_NOT_FOUND',
        2002: 'RACE_FULL',
        2003: 'RACE_STARTED',
        3001: 'TEST_NOT_FOUND',
        4001: 'RATE_LIMITED',
        5001: 'SERVER_ERROR'
      };
      
      return codeTypeMap[error.code] || 'UNKNOWN_ERROR';
    }
    
    if (error.message) {
      // Try to infer from message
      const message = error.message.toLowerCase();
      
      if (message.includes('network')) return 'NETWORK_ERROR';
      if (message.includes('timeout')) return 'TIMEOUT';
      if (message.includes('auth')) return 'AUTH_INVALID';
      if (message.includes('connection')) return 'CONNECTION_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(errorType) {
    const severityMap = {
      'AUTH_REQUIRED': 'high',
      'AUTH_INVALID': 'high',
      'AUTH_FORBIDDEN': 'critical',
      'CONNECTION_ERROR': 'medium',
      'TIMEOUT': 'medium',
      'RACE_NOT_FOUND': 'low',
      'RACE_FULL': 'low',
      'TEST_NOT_FOUND': 'medium',
      'RATE_LIMITED': 'low',
      'SERVER_ERROR': 'high',
      'NETWORK_ERROR': 'medium'
    };
    
    return severityMap[errorType] || 'medium';
  }

  /**
   * Error count management
   */
  
  getErrorCount(errorType) {
    return this.errorCounts.get(errorType) || 0;
  }

  incrementErrorCount(errorType) {
    const count = this.getErrorCount(errorType);
    this.errorCounts.set(errorType, count + 1);
  }

  resetErrorCount(errorType) {
    this.errorCounts.delete(errorType);
  }

  resetAllErrorCounts() {
    this.errorCounts.clear();
  }

  /**
   * Error history management
   */
  
  addToErrorHistory(error, context) {
    this.errorHistory.unshift({
      error,
      context,
      timestamp: new Date(),
      errorType: this.determineErrorType(error)
    });
    
    // Keep history size manageable
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(0, this.maxErrorHistory);
    }
  }

  getErrorHistory(limit = 10) {
    return this.errorHistory.slice(0, limit);
  }

  clearErrorHistory() {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByType: {},
      errorsByHour: {},
      recoveryRate: 0
    };

    // Count errors by type
    this.errorHistory.forEach(entry => {
      const type = entry.errorType;
      stats.errorsByType[type] = (stats.errorsByType[type] || 0) + 1;
    });

    // Count errors by hour
    const now = new Date();
    this.errorHistory.forEach(entry => {
      const hoursDiff = Math.floor((now - entry.timestamp) / (1000 * 60 * 60));
      const hour = `${hoursDiff}h ago`;
      stats.errorsByHour[hour] = (stats.errorsByHour[hour] || 0) + 1;
    });

    return stats;
  }

  /**
   * Utility methods
   */
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isCurrentlyRecovering() {
    return this.isRecovering;
  }

  /**
   * Signal successful recovery
   */
  signalRecoverySuccess() {
    this.resetAllErrorCounts();
    this.emit('fullRecovery');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.removeAllListeners();
    this.errorCounts.clear();
    this.errorHistory = [];
    this.isRecovering = false;
  }
}

// Create singleton instance
const socketErrorHandler = new SocketErrorHandler();

export default socketErrorHandler;