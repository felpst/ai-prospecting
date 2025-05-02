/**
 * Scraper Error Classes
 * Custom error classes and utilities for the web scraper
 */

/**
 * Base scraper error class
 * @extends Error
 */
export class ScraperError extends Error {
  /**
   * Create a new ScraperError
   * @param {string} message - Error message
   * @param {Object} context - Additional context information
   */
  constructor(message, context = {}) {
    super(message);
    this.name = 'ScraperError';
    this.context = context;
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Network-related scraper errors
 * @extends ScraperError
 */
export class NetworkError extends ScraperError {
  /**
   * Create a new NetworkError
   * @param {string} message - Error message
   * @param {string} url - The URL that was being accessed
   * @param {number|null} statusCode - HTTP status code (if applicable)
   * @param {Object} context - Additional context information
   */
  constructor(message, url, statusCode = null, context = {}) {
    super(message, context);
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      url: this.url,
      statusCode: this.statusCode
    };
  }
}

/**
 * Navigation-related scraper errors
 * @extends ScraperError
 */
export class NavigationError extends ScraperError {
  /**
   * Create a new NavigationError
   * @param {string} message - Error message
   * @param {string} url - The URL that was being navigated to
   * @param {string} navigationStage - The stage of navigation that failed
   * @param {Object} context - Additional context information
   */
  constructor(message, url, navigationStage = 'unknown', context = {}) {
    super(message, context);
    this.name = 'NavigationError';
    this.url = url;
    this.navigationStage = navigationStage;
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      url: this.url,
      navigationStage: this.navigationStage
    };
  }
}

/**
 * Access denied errors (403, captchas, etc.)
 * @extends NetworkError
 */
export class AccessDeniedError extends NetworkError {
  /**
   * Create a new AccessDeniedError
   * @param {string} message - Error message
   * @param {string} url - The URL that access was denied to
   * @param {number} statusCode - HTTP status code
   * @param {string} reason - Reason for access denial (captcha, rate-limiting, etc.)
   * @param {Object} context - Additional context information
   */
  constructor(message, url, statusCode, reason = 'unknown', context = {}) {
    super(message, url, statusCode, context);
    this.name = 'AccessDeniedError';
    this.reason = reason;
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      reason: this.reason
    };
  }
}

/**
 * Content extraction errors
 * @extends ScraperError
 */
export class ExtractionError extends ScraperError {
  /**
   * Create a new ExtractionError
   * @param {string} message - Error message
   * @param {string} selector - The selector that failed
   * @param {string} contentType - Type of content being extracted
   * @param {Object} context - Additional context information
   */
  constructor(message, selector = null, contentType = 'unknown', context = {}) {
    super(message, context);
    this.name = 'ExtractionError';
    this.selector = selector;
    this.contentType = contentType;
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      selector: this.selector,
      contentType: this.contentType
    };
  }
}

/**
 * Browser-related errors
 * @extends ScraperError
 */
export class BrowserError extends ScraperError {
  /**
   * Create a new BrowserError
   * @param {string} message - Error message
   * @param {string} operation - The browser operation that failed
   * @param {Object} context - Additional context information
   */
  constructor(message, operation = 'unknown', context = {}) {
    super(message, context);
    this.name = 'BrowserError';
    this.operation = operation;
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation
    };
  }
}

/**
 * Timeout errors
 * @extends ScraperError
 */
export class TimeoutError extends ScraperError {
  /**
   * Create a new TimeoutError
   * @param {string} message - Error message
   * @param {string} operation - The operation that timed out
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {Object} context - Additional context information
   */
  constructor(message, operation = 'unknown', timeoutMs = 0, context = {}) {
    super(message, context);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
  
  /**
   * Get a JSON representation of the error
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      ...super.toJSON(),
      operation: this.operation,
      timeoutMs: this.timeoutMs
    };
  }
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} Whether the error is retryable
 */
export const isRetryableError = (error) => {
  // Network errors are generally retryable
  if (error instanceof NetworkError) {
    // Don't retry access denied errors
    if (error instanceof AccessDeniedError) {
      return false;
    }
    // Don't retry 4xx client errors except 429 (too many requests)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
      return false;
    }
    return true;
  }
  
  // Timeout errors are retryable
  if (error instanceof TimeoutError) {
    return true;
  }
  
  // Navigation errors may be retryable
  if (error instanceof NavigationError) {
    return true;
  }
  
  // Browser errors might be retryable depending on the operation
  if (error instanceof BrowserError) {
    // By default consider browser errors retryable
    return true;
  }
  
  // Don't retry extraction errors
  if (error instanceof ExtractionError) {
    return false;
  }
  
  // Unknown error types - safer not to retry
  return false;
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelay - Initial delay in milliseconds
 * @param {number} options.maxDelay - Maximum delay in milliseconds
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @param {Function} options.onRetry - Function called before each retry
 * @returns {Promise<any>} Result of the function
 */
export const withRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = isRetryableError,
    onRetry = () => {}
  } = options;
  
  let retries = 0;
  let lastError;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (retries >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate backoff delay with jitter
      const backoffDelay = Math.min(initialDelay * Math.pow(2, retries), maxDelay);
      const jitter = Math.random() * 0.3 * backoffDelay; // 0-30% jitter
      const delay = backoffDelay + jitter;
      
      // Call onRetry callback with current retry info
      await onRetry({
        error,
        retryCount: retries + 1, 
        maxRetries,
        delay
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};

/**
 * Creates a circuit breaker to prevent overwhelming target sites
 * @param {Object} options - Circuit breaker options
 * @param {number} options.failureThreshold - Number of failures before opening circuit
 * @param {number} options.resetTimeout - Time in ms before attempting to close circuit
 * @param {Function} options.onOpen - Function called when circuit opens
 * @param {Function} options.onClose - Function called when circuit closes
 * @param {Function} options.onHalfOpen - Function called when circuit goes half-open
 * @returns {Object} Circuit breaker object
 */
export class CircuitBreaker {
  /**
   * Create a new CircuitBreaker
   * @param {Object} options - Circuit breaker options
   */
  constructor(options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 30000,
      onOpen = () => {},
      onClose = () => {},
      onHalfOpen = () => {}
    } = options;
    
    this.failureCount = 0;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
    this.onOpenCallback = onOpen;
    this.onCloseCallback = onClose;
    this.onHalfOpenCallback = onHalfOpen;
  }
  
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result of the function
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (this.nextAttempt <= Date.now()) {
        this.state = 'HALF-OPEN';
        this.onHalfOpenCallback();
      } else {
        throw new ScraperError('Circuit breaker is OPEN', {
          nextAttempt: new Date(this.nextAttempt).toISOString(),
          timeRemaining: this.nextAttempt - Date.now()
        });
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   */
  onSuccess() {
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      this.onCloseCallback();
    }
    this.failureCount = 0;
  }
  
  /**
   * Handle execution failure
   */
  onFailure() {
    this.failureCount++;
    if ((this.failureCount >= this.failureThreshold && this.state === 'CLOSED') || 
        this.state === 'HALF-OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.onOpenCallback();
    }
  }
  
  /**
   * Get the current state of the circuit breaker
   * @returns {string} Current state ('OPEN', 'CLOSED', or 'HALF-OPEN')
   */
  getState() {
    return this.state;
  }
  
  /**
   * Reset the circuit breaker to its initial state
   */
  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.onCloseCallback();
  }
} 