const logger = require('./logger');

/**
 * Performance monitoring utility for WebSocket operations
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      connections: {
        total: 0,
        active: 0,
        peak: 0,
        totalCreated: 0,
        totalClosed: 0
      },
      events: {
        total: 0,
        perSecond: 0,
        byType: new Map(),
        errors: 0,
        rateLimited: 0
      },
      latency: {
        samples: [],
        average: 0,
        p95: 0,
        p99: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      },
      sessions: {
        activeTests: 0,
        activeRaces: 0,
        completedTests: 0,
        completedRaces: 0
      }
    };

    this.eventCounter = 0;
    this.lastEventCountReset = Date.now();
    this.latencySamples = [];
    this.maxLatencySamples = 1000;

    // Start monitoring intervals
    this.startMonitoring();
  }

  /**
   * Record a new connection
   */
  recordConnection() {
    this.metrics.connections.total++;
    this.metrics.connections.active++;
    this.metrics.connections.totalCreated++;
    
    if (this.metrics.connections.active > this.metrics.connections.peak) {
      this.metrics.connections.peak = this.metrics.connections.active;
    }
  }

  /**
   * Record a connection close
   */
  recordDisconnection() {
    this.metrics.connections.active = Math.max(0, this.metrics.connections.active - 1);
    this.metrics.connections.totalClosed++;
  }

  /**
   * Record a WebSocket event
   */
  recordEvent(eventType, isError = false, isRateLimited = false) {
    this.metrics.events.total++;
    this.eventCounter++;
    
    if (isError) {
      this.metrics.events.errors++;
    }
    
    if (isRateLimited) {
      this.metrics.events.rateLimited++;
    }

    // Track events by type
    const count = this.metrics.events.byType.get(eventType) || 0;
    this.metrics.events.byType.set(eventType, count + 1);
  }

  /**
   * Record event latency
   */
  recordLatency(latencyMs) {
    this.latencySamples.push(latencyMs);
    
    // Keep only recent samples
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }

    // Update latency metrics
    this.updateLatencyMetrics();
  }

  /**
   * Record session activity
   */
  recordSessionActivity(type, action) {
    switch (type) {
      case 'test':
        if (action === 'start') {
          this.metrics.sessions.activeTests++;
        } else if (action === 'complete') {
          this.metrics.sessions.activeTests = Math.max(0, this.metrics.sessions.activeTests - 1);
          this.metrics.sessions.completedTests++;
        }
        break;
      case 'race':
        if (action === 'start') {
          this.metrics.sessions.activeRaces++;
        } else if (action === 'complete') {
          this.metrics.sessions.activeRaces = Math.max(0, this.metrics.sessions.activeRaces - 1);
          this.metrics.sessions.completedRaces++;
        }
        break;
    }
  }

  /**
   * Update latency percentiles
   */
  updateLatencyMetrics() {
    if (this.latencySamples.length === 0) return;

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    this.metrics.latency.average = Math.round(sum / sorted.length * 100) / 100;
    this.metrics.latency.p95 = this.getPercentile(sorted, 95);
    this.metrics.latency.p99 = this.getPercentile(sorted, 99);
  }

  /**
   * Get percentile value from sorted array
   */
  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100 // MB
    };
  }

  /**
   * Calculate events per second
   */
  updateEventRate() {
    const now = Date.now();
    const timeDiff = (now - this.lastEventCountReset) / 1000;
    
    if (timeDiff >= 1) {
      this.metrics.events.perSecond = Math.round(this.eventCounter / timeDiff * 100) / 100;
      this.eventCounter = 0;
      this.lastEventCountReset = now;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    this.updateMemoryMetrics();
    this.updateEventRate();
    
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  /**
   * Get metrics summary for logging
   */
  getMetricsSummary() {
    const metrics = this.getMetrics();
    
    return {
      connections: `${metrics.connections.active} active (peak: ${metrics.connections.peak})`,
      events: `${metrics.events.perSecond}/sec (total: ${metrics.events.total}, errors: ${metrics.events.errors})`,
      latency: `avg: ${metrics.latency.average}ms, p95: ${metrics.latency.p95}ms, p99: ${metrics.latency.p99}ms`,
      memory: `${metrics.memory.heapUsed}MB heap used of ${metrics.memory.heapTotal}MB`,
      sessions: `${metrics.sessions.activeTests} tests, ${metrics.sessions.activeRaces} races`
    };
  }

  /**
   * Check if system is under high load
   */
  isHighLoad() {
    const metrics = this.getMetrics();
    
    return (
      metrics.connections.active > 1000 ||
      metrics.events.perSecond > 5000 ||
      metrics.latency.p99 > 1000 ||
      metrics.memory.heapUsed > 500 || // 500MB
      metrics.events.errors > 100
    );
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const isHealthy = !this.isHighLoad() && metrics.events.errors < 10;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        connections: metrics.connections.active < 1000,
        eventRate: metrics.events.perSecond < 5000,
        latency: metrics.latency.p99 < 1000,
        memory: metrics.memory.heapUsed < 500,
        errors: metrics.events.errors < 100
      },
      metrics: this.getMetricsSummary()
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      connections: { total: 0, active: 0, peak: 0, totalCreated: 0, totalClosed: 0 },
      events: { total: 0, perSecond: 0, byType: new Map(), errors: 0, rateLimited: 0 },
      latency: { samples: [], average: 0, p95: 0, p99: 0 },
      memory: { heapUsed: 0, heapTotal: 0, external: 0 },
      sessions: { activeTests: 0, activeRaces: 0, completedTests: 0, completedRaces: 0 }
    };
    
    this.eventCounter = 0;
    this.lastEventCountReset = Date.now();
    this.latencySamples = [];
  }

  /**
   * Start monitoring intervals
   */
  startMonitoring() {
    // Log metrics every minute
    this.metricsInterval = setInterval(() => {
      const summary = this.getMetricsSummary();
      logger.info('Performance metrics', summary);
      
      // Alert on high load
      if (this.isHighLoad()) {
        logger.warn('System under high load', {
          health: this.getHealthStatus()
        });
      }
    }, 60000);

    // Clean up old latency samples every 5 minutes
    this.cleanupInterval = setInterval(() => {
      if (this.latencySamples.length > this.maxLatencySamples / 2) {
        this.latencySamples = this.latencySamples.slice(-this.maxLatencySamples / 2);
        this.updateLatencyMetrics();
      }
    }, 5 * 60000);
  }

  /**
   * Stop monitoring intervals
   */
  stopMonitoring() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Graceful cleanup on process exit
process.on('SIGINT', () => {
  performanceMonitor.stopMonitoring();
});

process.on('SIGTERM', () => {
  performanceMonitor.stopMonitoring();
});

module.exports = performanceMonitor;