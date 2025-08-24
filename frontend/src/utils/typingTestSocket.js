import socketClient from './socket';
import { EventEmitter } from 'events';

/**
 * Typing test WebSocket utilities
 */
class TypingTestSocket extends EventEmitter {
  constructor() {
    super();
    this.currentTestId = null;
    this.isTestActive = false;
    this.keystrokeBuffer = [];
    this.lastStatsUpdate = null;
    this.statsUpdateThrottle = 100; // Update stats max once per 100ms
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for typing test events
   */
  setupEventHandlers() {
    // Test session events
    socketClient.on('test:joined', (data) => {
      console.log('✅ Joined test session:', data.testId);
      this.currentTestId = data.testId;
      this.isTestActive = true;
      this.emit('testJoined', data);
    });

    socketClient.on('test:stats_update', (stats) => {
      this.lastStatsUpdate = Date.now();
      this.emit('statsUpdate', stats);
    });

    socketClient.on('test:result', (result) => {
      console.log('🏁 Test completed with result:', result);
      this.isTestActive = false;
      this.currentTestId = null;
      this.emit('testResult', result);
    });

    // Error handling
    socketClient.on('error', (error) => {
      if (error.code >= 3000 && error.code < 4000) {
        console.error('❌ Test error:', error);
        this.emit('testError', error);
      }
    });
  }

  /**
   * Join a typing test session
   */
  async joinTest(testConfig) {
    try {
      if (!socketClient.isReady()) {
        throw new Error('Socket not connected');
      }

      const testData = {
        testId: testConfig.testId,
        mode: testConfig.mode || 'time',
        duration: testConfig.duration || 60,
        wordCount: testConfig.wordCount || 50,
        wordListId: testConfig.wordListId || 'common-words'
      };

      socketClient.emit('test:join', testData);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test join timeout'));
        }, 5000);

        const handleJoined = (data) => {
          clearTimeout(timeout);
          this.off('testJoined', handleJoined);
          this.off('testError', handleError);
          resolve(data);
        };

        const handleError = (error) => {
          clearTimeout(timeout);
          this.off('testJoined', handleJoined);
          this.off('testError', handleError);
          reject(error);
        };

        this.once('testJoined', handleJoined);
        this.once('testError', handleError);
      });
    } catch (error) {
      console.error('❌ Failed to join test:', error);
      throw error;
    }
  }

  /**
   * Send keystroke data to server
   */
  sendKeystroke(keystrokeData) {
    if (!this.isTestActive || !socketClient.isReady()) {
      return;
    }

    const keystroke = {
      testId: this.currentTestId,
      timestamp: keystrokeData.timestamp,
      key: keystrokeData.key,
      correct: keystrokeData.correct,
      position: keystrokeData.position,
      currentText: keystrokeData.currentText
    };

    // Validate keystroke data
    if (!this.validateKeystroke(keystroke)) {
      console.warn('⚠️ Invalid keystroke data:', keystroke);
      return;
    }

    // Buffer keystrokes to avoid overwhelming the server
    this.keystrokeBuffer.push(keystroke);
    
    // Send immediately for better real-time experience
    socketClient.emit('test:keystroke', keystroke);
    
    // Keep buffer size manageable
    if (this.keystrokeBuffer.length > 1000) {
      this.keystrokeBuffer = this.keystrokeBuffer.slice(-500);
    }
  }

  /**
   * Complete the current test
   */
  async completeTest(finalStats) {
    try {
      if (!this.isTestActive || !this.currentTestId) {
        throw new Error('No active test to complete');
      }

      const completionData = {
        testId: this.currentTestId,
        finalStats: {
          wpm: finalStats.wpm,
          accuracy: finalStats.accuracy,
          consistency: finalStats.consistency || 0,
          errors: finalStats.errors,
          timeElapsed: finalStats.timeElapsed
        }
      };

      socketClient.emit('test:completed', completionData);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test completion timeout'));
        }, 5000);

        const handleResult = (result) => {
          clearTimeout(timeout);
          this.off('testResult', handleResult);
          this.off('testError', handleError);
          resolve(result);
        };

        const handleError = (error) => {
          clearTimeout(timeout);
          this.off('testResult', handleResult);
          this.off('testError', handleError);
          reject(error);
        };

        this.once('testResult', handleResult);
        this.once('testError', handleError);
      });
    } catch (error) {
      console.error('❌ Failed to complete test:', error);
      throw error;
    }
  }

  /**
   * Leave the current test session
   */
  leaveTest() {
    if (this.currentTestId) {
      socketClient.emit('test:leave', { testId: this.currentTestId });
      this.isTestActive = false;
      this.currentTestId = null;
      this.keystrokeBuffer = [];
    }
  }

  /**
   * Validate keystroke data
   */
  validateKeystroke(keystroke) {
    const required = ['testId', 'timestamp', 'key', 'correct', 'position'];
    
    for (const field of required) {
      if (keystroke[field] === undefined || keystroke[field] === null) {
        return false;
      }
    }

    // Type validations
    if (typeof keystroke.testId !== 'string' ||
        typeof keystroke.timestamp !== 'number' ||
        typeof keystroke.key !== 'string' ||
        typeof keystroke.correct !== 'boolean' ||
        typeof keystroke.position !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get current test state
   */
  getTestState() {
    return {
      testId: this.currentTestId,
      isActive: this.isTestActive,
      keystrokeBufferSize: this.keystrokeBuffer.length,
      lastStatsUpdate: this.lastStatsUpdate
    };
  }

  /**
   * Reset test state
   */
  reset() {
    this.currentTestId = null;
    this.isTestActive = false;
    this.keystrokeBuffer = [];
    this.lastStatsUpdate = null;
  }
}

// Create singleton instance
const typingTestSocket = new TypingTestSocket();

export default typingTestSocket;