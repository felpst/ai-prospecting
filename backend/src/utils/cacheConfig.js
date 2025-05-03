/**
 * Cache Configuration
 * Centralizes all cache-related configuration for the application
 */

// Default TTL values in seconds
export const cacheTTL = {
  // Cache search results for 5 minutes
  SEARCH_RESULTS: 5 * 60,
  // Cache company details for 1 hour
  COMPANY_DETAILS: 60 * 60,
  // Cache enriched LLM data for 24 hours (since it costs money to generate)
  ENRICHED_DATA: 24 * 60 * 60,
  // Cache scraped content for 12 hours
  SCRAPED_CONTENT: 12 * 60 * 60,
  // Cache unified search results for 10 minutes (longer than regular search due to additional processing)
  UNIFIED_SEARCH: 10 * 60,
  // Default TTL for other cached items
  DEFAULT: 5 * 60
};

// Cache configuration
export const cacheConfig = {
  // Whether to use Redis or in-memory cache
  useRedis: process.env.USE_REDIS === 'true',
  // Redis connection string
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // Redis password if required
  redisPassword: process.env.REDIS_PASSWORD || '',
  // Prefix for all cache keys to avoid collisions in shared Redis
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'ai-prospecting:',
  // Maximum size for in-memory cache (number of items)
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  // Whether to enable cache monitoring/metrics
  enableMetrics: process.env.CACHE_METRICS === 'true',
  // Check period for in-memory cache cleanup (in seconds)
  checkPeriod: 60,
  // Whether to use compression for large cached items
  useCompression: process.env.CACHE_COMPRESSION === 'true'
};

// Cache key generation helpers
export const cacheKeys = {
  // Generate search key based on query parameters
  searchKey: (params) => {
    // Sort parameters to ensure consistent keys regardless of parameter order
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        // Ignore parameters that should not affect caching
        if (key !== 'requestId' && key !== 'timestamp') {
          result[key] = params[key];
        }
        return result;
      }, {});
    
    return `search:${JSON.stringify(sortedParams)}`;
  },
  
  // Generate company details key
  companyKey: (id) => `company:${id}`,
  
  // Generate LLM enrichment key
  enrichmentKey: (id) => `enrichment:${id}`,
  
  // Generate scraped content key
  scrapedContentKey: (url) => `scraped:${url}`
}; 