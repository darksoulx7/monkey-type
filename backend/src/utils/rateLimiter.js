/**
 * Rate limiter utility for WebSocket events
 * Implements token bucket algorithm for different event types
 */

class RateLimiter {
  constructor() {
    // Store rate limit buckets in memory
    // In production, use Redis for distributed rate limiting
    this.buckets = new Map();
    
    // Rate limit configurations
    this.limits = {
      // Connection rate limits (per IP)
      connection: { tokens: 10, refillRate: 1, window: 60000 }, // 10 connections per minute
      
      // Keystroke events (per user)
      keystroke: { tokens: 20, refillRate: 20, window: 1000 }, // 20 per second
      
      // Race progress updates (per user)
      raceProgress: { tokens: 10, refillRate: 10, window: 1000 }, // 10 per second
      
      // Chat messages (per user)
      chatMessage: { tokens: 5, refillRate: 1, window: 12000 }, // 5 per minute (12 second intervals)
      
      // General events (per user)
      general: { tokens: 100, refillRate: 1, window: 600 } // 100 per 10 minutes
    };
  }

  /**
   * Check if action is allowed based on rate limits
   */
  async checkRate(key, limitType = 'general') {
    const limit = this.limits[limitType];
    if (!limit) {
      throw new Error(`Unknown rate limit type: ${limitType}`);
    }

    const bucketKey = `${limitType}:${key}`;
    const now = Date.now();
    
    let bucket = this.buckets.get(bucketKey);
    
    if (!bucket) {
      // Create new bucket
      bucket = {
        tokens: limit.tokens,
        lastRefill: now,
        createdAt: now
      };
      this.buckets.set(bucketKey, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / (limit.window / limit.refillRate));
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(limit.tokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if request is allowed
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return {
        allowed: true,
        remaining: bucket.tokens,
        resetTime: bucket.lastRefill + limit.window
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: bucket.lastRefill + limit.window,
      retryAfter: Math.ceil((limit.window / limit.refillRate) - elapsed)
    };
  }

  /**
   * Specific method for connection rate limiting
   */
  async checkConnectionRate(ip) {
    return this.checkRate(ip, 'connection');
  }

  /**
   * Specific method for keystroke event rate limiting
   */
  async checkKeystrokeRate(userId) {
    return this.checkRate(userId, 'keystroke');
  }

  /**
   * Specific method for race progress rate limiting
   */
  async checkRaceProgressRate(userId) {
    return this.checkRate(userId, 'raceProgress');
  }

  /**
   * Specific method for chat message rate limiting
   */
  async checkChatMessageRate(userId) {
    return this.checkRate(userId, 'chatMessage');
  }

  /**
   * Specific method for general event rate limiting
   */
  async checkGeneralRate(userId) {
    return this.checkRate(userId, 'general');
  }

  /**
   * Clean up old buckets (call periodically)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.createdAt > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Get current stats for monitoring
   */
  getStats() {
    const stats = {
      totalBuckets: this.buckets.size,
      bucketsByType: {}
    };

    for (const key of this.buckets.keys()) {
      const type = key.split(':')[0];
      stats.bucketsByType[type] = (stats.bucketsByType[type] || 0) + 1;
    }

    return stats;
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Clean up old buckets every 5 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

module.exports = rateLimiter;