/**
 * Cache Middleware
 * Provides Express middleware for route-level caching
 */

import cacheService from '../utils/cacheService.js';
import { cacheKeys, cacheTTL } from '../utils/cacheConfig.js';
import logger from '../utils/logger.js';

/**
 * Create cache middleware with custom options
 * @param {Object} options - Cache options
 * @param {Function} options.getKey - Function to generate cache key from request (default: uses URL)
 * @param {Number} options.ttl - Time to live in seconds (default: cacheTTL.DEFAULT)
 * @param {Boolean} options.ignoreQuery - Whether to ignore query parameters (default: false)
 * @param {Function} options.shouldCache - Function to determine if request should be cached (default: all GET requests)
 * @param {Array<String>} options.varyByHeaders - List of headers to vary cache by (e.g., 'authorization')
 * @returns {Function} Express middleware
 */
export function cacheMiddleware(options = {}) {
  const {
    getKey = req => req.originalUrl,
    ttl = cacheTTL.DEFAULT,
    ignoreQuery = false,
    shouldCache = req => req.method === 'GET',
    varyByHeaders = []
  } = options;
  
  return async (req, res, next) => {
    // Skip caching for non-GET requests or if explicitly disabled
    if (!shouldCache(req)) {
      return next();
    }
    
    try {
      // Generate cache key
      let cacheKey = getKey(req);
      
      if (ignoreQuery) {
        // Remove query string from URL
        cacheKey = req.path;
      }
      
      // Vary by headers if specified
      if (varyByHeaders.length > 0) {
        const headerValues = varyByHeaders
          .map(header => {
            const value = req.get(header);
            return value ? `${header}:${value}` : '';
          })
          .filter(Boolean)
          .join(',');
        
        if (headerValues) {
          cacheKey = `${cacheKey}|${headerValues}`;
        }
      }
      
      // Check cache
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        // Set headers to indicate cache hit
        res.set('X-Cache', 'HIT');
        
        // Return cached response
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return res.status(cachedResponse.status).json(cachedResponse.data);
      }
      
      // Cache miss, continue with original response
      res.set('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache the response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseToCache = {
            data,
            status: res.statusCode
          };
          
          // Cache the response
          cacheService.set(cacheKey, responseToCache, ttl)
            .catch(err => logger.error(`Failed to cache response: ${err.message}`));
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error(`Cache middleware error: ${error.message}`);
      next();
    }
  };
}

/**
 * Create middleware for search results caching
 * @param {Number} ttl - Cache TTL in seconds
 * @returns {Function} Express middleware
 */
export function cacheSearchResults(ttl = cacheTTL.SEARCH_RESULTS) {
  return cacheMiddleware({
    getKey: req => cacheKeys.searchKey(req.query),
    ttl,
    shouldCache: req => req.method === 'GET'
  });
}

/**
 * Create middleware for company details caching
 * @param {Number} ttl - Cache TTL in seconds
 * @returns {Function} Express middleware
 */
export function cacheCompanyDetails(ttl = cacheTTL.COMPANY_DETAILS) {
  return cacheMiddleware({
    getKey: req => cacheKeys.companyKey(req.params.id),
    ttl,
    shouldCache: req => req.method === 'GET'
  });
}

/**
 * Invalidate cache for a specific company
 * @param {String} companyId - Company ID
 * @returns {Promise<Boolean>} Success status
 */
export async function invalidateCompanyCache(companyId) {
  const key = cacheKeys.companyKey(companyId);
  return cacheService.delete(key);
}

/**
 * Clear all search result caches
 * @returns {Promise<Boolean>} Success status
 */
export async function clearSearchCache() {
  if (cacheService.useRedis) {
    return cacheService.deletePattern('search:');
  } else {
    // For in-memory cache, we need to clear all cache
    // as in-memory doesn't support pattern deletion
    return cacheService.clear();
  }
}

/**
 * Clear entire cache
 * @returns {Promise<Boolean>} Success status
 */
export async function clearAllCache() {
  return cacheService.clear();
} 