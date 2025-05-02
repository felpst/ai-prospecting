/**
 * Rate Limiter Utility
 * Controls request frequency to avoid overloading target websites
 */

import { logger } from './logger.js';
import { URL } from 'url';

// Default configuration
const DEFAULT_CONFIG = {
  minDelay: 2000,   // Minimum delay between requests to the same domain (ms)
  maxDelay: 5000,   // Maximum delay between requests to the same domain (ms)
  maxConcurrent: 3, // Maximum number of concurrent requests across all domains
  maxPerDomain: 1,  // Maximum number of concurrent requests to the same domain
  maxPerMinute: 20  // Maximum requests per minute across all domains
};

/**
 * Rate Limiter class to control request timing and frequency
 */
export class RateLimiter {
  /**
   * Create a new rate limiter
   * @param {Object} config - Rate limiting configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Domain-specific tracking
    this.domainTimers = new Map();     // Last request time per domain
    this.domainConfigs = new Map();    // Custom settings per domain
    this.domainRequests = new Map();   // Request count per domain
    this.domainSemaphores = new Map(); // Concurrent request control per domain
    
    // Global request tracking
    this.activeRequests = 0;
    this.requestHistory = [];          // Timestamps of recent requests
    
    // Request queue
    this.queue = [];
    this.processing = false;
    
    // Stats for monitoring
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      rateExceededCount: 0
    };
    
    // Start the request processor
    this.startProcessor();
    
    logger.info('Rate limiter initialized', {
      config: this.config
    });
  }
  
  /**
   * Set domain-specific rate limiting configuration
   * @param {string} domain - Domain to configure
   * @param {Object} config - Rate limiting configuration for this domain
   */
  setDomainConfig(domain, config) {
    // Get existing config or create new one
    const existingConfig = this.domainConfigs.get(domain) || {};
    
    // Merge with new config
    this.domainConfigs.set(domain, {
      ...existingConfig,
      ...config
    });
    
    logger.debug(`Set rate limit config for ${domain}`, {
      config: this.domainConfigs.get(domain)
    });
  }
  
  /**
   * Schedule a request to be executed with rate limiting
   * @param {Function} requestFn - Function that performs the request
   * @param {string} url - URL to be requested
   * @param {number} priority - Priority of the request (lower number = higher priority)
   * @returns {Promise<any>} - Result of the request
   */
  async schedule(requestFn, url, priority = 5) {
    const domain = this.extractDomain(url);
    this.stats.totalRequests++;
    
    // Create a new request object with a promise that will be resolved when the request completes
    return new Promise((resolve, reject) => {
      const request = {
        fn: requestFn,
        url,
        domain,
        priority,
        added: Date.now(),
        resolve,
        reject
      };
      
      // Add to the queue
      this.addToQueue(request);
    });
  }
  
  /**
   * Add a request to the queue
   * @param {Object} request - Request object
   * @private
   */
  addToQueue(request) {
    // Insert based on priority (lower number = higher priority)
    const index = this.queue.findIndex(req => req.priority > request.priority);
    if (index === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(index, 0, request);
    }
    
    logger.debug(`Added request to queue: ${request.url}`, {
      priority: request.priority,
      queueLength: this.queue.length,
      domain: request.domain
    });
  }
  
  /**
   * Start the queue processor
   * @private
   */
  startProcessor() {
    const processQueue = async () => {
      if (this.processing) return;
      
      this.processing = true;
      
      try {
        while (this.queue.length > 0) {
          // Check if we can process more requests
          if (!this.canProcessRequest()) {
            // We're over the rate limit, wait a bit
            await this.delay(1000);
            continue;
          }
          
          // Get the next request that can be processed
          const nextRequest = this.getNextProcessableRequest();
          if (!nextRequest) {
            // No requests can be processed right now, wait a bit
            await this.delay(500);
            continue;
          }
          
          // Process the request
          this.processRequest(nextRequest)
            .catch(err => {
              logger.error(`Error processing request: ${err.message}`, {
                url: nextRequest.url,
                error: err
              });
            });
        }
      } finally {
        this.processing = false;
      }
    };
    
    // Start the processor and keep it running
    const runProcessor = () => {
      processQueue().catch(err => {
        logger.error(`Error in queue processor: ${err.message}`, { error: err });
      }).finally(() => {
        // Check if there are items in the queue and restart if needed
        if (this.queue.length > 0 && !this.processing) {
          runProcessor();
        } else {
          // Schedule a check to see if new items have been added
          setTimeout(() => {
            if (this.queue.length > 0 && !this.processing) {
              runProcessor();
            }
          }, 1000);
        }
      });
    };
    
    // Initial start
    runProcessor();
  }
  
  /**
   * Check if a new request can be processed right now
   * @returns {boolean} - True if a request can be processed
   * @private
   */
  canProcessRequest() {
    // Check if we're at the global concurrent request limit
    if (this.activeRequests >= this.config.maxConcurrent) {
      return false;
    }
    
    // Check if we're over the global rate limit
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);
    
    if (this.requestHistory.length >= this.config.maxPerMinute) {
      this.stats.rateExceededCount++;
      logger.warn('Global rate limit exceeded, throttling requests', {
        requestsPerMinute: this.requestHistory.length,
        limit: this.config.maxPerMinute
      });
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the next request that can be processed
   * @returns {Object|null} - The next request or null if none can be processed
   * @private
   */
  getNextProcessableRequest() {
    // Look for a request that isn't rate limited by domain
    for (let i = 0; i < this.queue.length; i++) {
      const request = this.queue[i];
      const domain = request.domain;
      
      // Check if this domain is already at its concurrency limit
      const domainActive = this.getDomainActiveCount(domain);
      const domainConfig = this.getDomainConfig(domain);
      
      if (domainActive >= domainConfig.maxPerDomain) {
        continue;
      }
      
      // Check if this domain needs a delay
      const lastRequestTime = this.domainTimers.get(domain) || 0;
      const minDelay = domainConfig.minDelay;
      const elapsed = Date.now() - lastRequestTime;
      
      if (lastRequestTime > 0 && elapsed < minDelay) {
        continue;
      }
      
      // Remove the request from the queue
      this.queue.splice(i, 1);
      return request;
    }
    
    return null;
  }
  
  /**
   * Process a request
   * @param {Object} request - Request object
   * @private
   */
  async processRequest(request) {
    const domain = request.domain;
    const domainConfig = this.getDomainConfig(domain);
    
    try {
      // Update domain timer with the current time
      this.domainTimers.set(domain, Date.now());
      
      // Record this request in history
      this.requestHistory.push(Date.now());
      
      // Increment domain request count
      const domainCount = (this.domainRequests.get(domain) || 0) + 1;
      this.domainRequests.set(domain, domainCount);
      
      // Increment active request count
      this.activeRequests++;
      
      // Apply a random delay to appear more human-like
      const delayTime = this.getRandomDelay(domainConfig);
      
      logger.debug(`Processing request for ${request.url}`, {
        delay: delayTime,
        queueLength: this.queue.length,
        activeRequests: this.activeRequests,
        domainCount
      });
      
      // Wait for the random delay
      await this.delay(delayTime);
      
      // Execute the request
      const result = await request.fn();
      
      // Resolve the promise
      request.resolve(result);
      
      return result;
    } catch (error) {
      // Check if this is a rate limit error and adjust accordingly
      if (this.isRateLimitError(error)) {
        this.handleRateLimitDetected(domain);
        
        // Put the request back in the queue with higher priority
        this.addToQueue({
          ...request,
          priority: Math.max(1, request.priority - 1)
        });
        
        // Don't reject the original promise yet, it will be resolved when retried
      } else {
        // For other errors, reject the promise
        request.reject(error);
      }
      
      throw error;
    } finally {
      // Decrement active request count
      this.activeRequests--;
    }
  }
  
  /**
   * Check if an error indicates rate limiting
   * @param {Error} error - The error to check
   * @returns {boolean} - True if this appears to be a rate limit error
   * @private
   */
  isRateLimitError(error) {
    // Implement detection of rate limit errors based on error message, 
    // status code, or other characteristics
    if (!error) return false;
    
    const message = (error.message || '').toLowerCase();
    const status = error.statusCode || (error.response && error.response.status);
    
    // Check for common rate limit indicators
    return status === 429 || 
           message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('throttled');
  }
  
  /**
   * Handle detected rate limiting
   * @param {string} domain - The domain that triggered rate limiting
   * @private
   */
  handleRateLimitDetected(domain) {
    const domainConfig = this.getDomainConfig(domain);
    
    // Double the minimum delay (up to a reasonable maximum)
    const newMinDelay = Math.min(domainConfig.minDelay * 2, 30000);
    const newMaxDelay = Math.min(domainConfig.maxDelay * 2, 60000);
    
    this.setDomainConfig(domain, {
      minDelay: newMinDelay,
      maxDelay: newMaxDelay
    });
    
    logger.warn(`Rate limit detected for ${domain}, increasing delay`, {
      newMinDelay,
      newMaxDelay
    });
    
    this.stats.throttledRequests++;
  }
  
  /**
   * Get the number of active requests for a domain
   * @param {string} domain - The domain to check
   * @returns {number} - Number of active requests
   * @private
   */
  getDomainActiveCount(domain) {
    // Count requests in queue for this domain
    return this.queue.filter(req => req.domain === domain).length +
           // Plus any currently processing
           (this.domainRequests.get(domain) || 0);
  }
  
  /**
   * Get configuration for a specific domain (merging with defaults)
   * @param {string} domain - The domain to get configuration for
   * @returns {Object} - Domain configuration
   * @private
   */
  getDomainConfig(domain) {
    const domainConfig = this.domainConfigs.get(domain) || {};
    
    return {
      minDelay: domainConfig.minDelay || this.config.minDelay,
      maxDelay: domainConfig.maxDelay || this.config.maxDelay,
      maxPerDomain: domainConfig.maxPerDomain || this.config.maxPerDomain,
      maxPerMinute: domainConfig.maxPerMinute || Math.floor(this.config.maxPerMinute / 4)
    };
  }
  
  /**
   * Generate a random delay that appears human-like
   * @param {Object} config - Domain configuration
   * @returns {number} - Delay in milliseconds
   * @private
   */
  getRandomDelay(config) {
    const { minDelay, maxDelay } = config;
    
    // Use a slightly skewed distribution to simulate human behavior
    // (more likely to be closer to minDelay but with occasional longer pauses)
    const skew = 0.7;
    const rand = Math.pow(Math.random(), skew);
    
    return Math.floor(minDelay + rand * (maxDelay - minDelay));
  }
  
  /**
   * Extract domain from URL
   * @param {string} url - URL to extract domain from
   * @returns {string} - Domain name
   * @private
   */
  extractDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (error) {
      logger.warn(`Invalid URL: ${url}`, { error: error.message });
      return url; // Fall back to using the entire URL as the "domain"
    }
  }
  
  /**
   * Simple delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>} - Promise that resolves after the delay
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get stats about the rate limiter
   * @returns {Object} - Statistics about rate limiting
   */
  getStats() {
    return {
      ...this.stats,
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
      requestsLastMinute: this.requestHistory.length,
      domainsTracked: this.domainTimers.size
    };
  }
  
  /**
   * Clear stats and reset counters (but keep configurations)
   */
  clearStats() {
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      rateExceededCount: 0
    };
    
    logger.debug('Rate limiter stats cleared');
  }
}

// Singleton instance for use throughout the application
let rateLimiterInstance = null;

/**
 * Get the global rate limiter instance
 * @param {Object} config - Optional configuration to override defaults
 * @returns {RateLimiter} - Global rate limiter instance
 */
export const getRateLimiter = (config = {}) => {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config);
  }
  return rateLimiterInstance;
}; 