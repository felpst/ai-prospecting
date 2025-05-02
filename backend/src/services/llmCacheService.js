/**
 * LLM Cache Service
 * Provides caching specifically for LLM service calls to reduce API usage and costs
 */

import cacheService from '../utils/cacheService.js';
import { cacheKeys, cacheTTL } from '../utils/cacheConfig.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Cache generated company summary to reduce LLM API calls
 * @param {String} companyId - Company ID
 * @param {Object} summary - Generated summary data
 * @returns {Promise<Boolean>} Success status
 */
export async function cacheCompanySummary(companyId, summary) {
  if (!summary) {
    logger.warn(`Attempted to cache null or undefined summary for company ${companyId}`);
    return false;
  }
  
  try {
    const cacheKey = cacheKeys.enrichmentKey(companyId);
    
    // Store with timestamp for freshness tracking
    const cacheData = {
      summary,
      cachedAt: new Date().toISOString()
    };
    
    // Use longer TTL for enriched data since it's expensive to generate
    const success = await cacheService.set(cacheKey, cacheData, cacheTTL.ENRICHED_DATA);
    
    if (success) {
      logger.info(`Cached enrichment data for company ${companyId}`);
    } else {
      logger.warn(`Failed to cache enrichment data for company ${companyId}`);
    }
    
    return success;
  } catch (error) {
    logger.error(`Error caching enrichment data for company ${companyId}: ${error.message}`);
    return false;
  }
}

/**
 * Get cached company summary if available
 * @param {String} companyId - Company ID
 * @returns {Promise<Object|null>} Cached summary or null if not found
 */
export async function getCachedCompanySummary(companyId) {
  try {
    const cacheKey = cacheKeys.enrichmentKey(companyId);
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      logger.info(`Using cached enrichment data for company ${companyId} from ${cachedData.cachedAt}`);
      return cachedData.summary;
    }
    
    return null;
  } catch (error) {
    logger.error(`Error retrieving cached enrichment data for company ${companyId}: ${error.message}`);
    return null;
  }
}

/**
 * Invalidate cached company summary
 * @param {String} companyId - Company ID
 * @returns {Promise<Boolean>} Success status
 */
export async function invalidateCompanySummary(companyId) {
  try {
    const cacheKey = cacheKeys.enrichmentKey(companyId);
    const success = await cacheService.delete(cacheKey);
    
    if (success) {
      logger.info(`Invalidated cached enrichment data for company ${companyId}`);
    }
    
    return success;
  } catch (error) {
    logger.error(`Error invalidating cached enrichment data for company ${companyId}: ${error.message}`);
    return false;
  }
}

/**
 * Cache scraped content to avoid repeated scraping
 * @param {String} url - URL that was scraped
 * @param {Object} content - Scraped content data
 * @returns {Promise<Boolean>} Success status
 */
export async function cacheScrapedContent(url, content) {
  if (!url || !content) {
    logger.warn(`Invalid parameters for caching scraped content: url=${url}, content=${content ? 'present' : 'missing'}`);
    return false;
  }
  
  try {
    const cacheKey = cacheKeys.scrapedContentKey(url);
    
    // Add timestamp for freshness tracking
    const cacheData = {
      ...content,
      cachedAt: new Date().toISOString()
    };
    
    // Use appropriate TTL for scraped content
    const success = await cacheService.set(cacheKey, cacheData, cacheTTL.SCRAPED_CONTENT);
    
    if (success) {
      logger.info(`Cached scraped content for URL ${url}`);
    }
    
    return success;
  } catch (error) {
    logger.error(`Error caching scraped content for URL ${url}: ${error.message}`);
    return false;
  }
}

/**
 * Get cached scraped content if available
 * @param {String} url - URL to get cached content for
 * @returns {Promise<Object|null>} Cached content or null if not found
 */
export async function getCachedScrapedContent(url) {
  if (!url) {
    logger.warn('Cannot get cached content for empty URL');
    return null;
  }
  
  try {
    const cacheKey = cacheKeys.scrapedContentKey(url);
    return await cacheService.get(cacheKey);
  } catch (error) {
    logger.error(`Error retrieving cached scraped content for URL ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Generate a cache key for a general LLM prompt
 * @param {Object} params - Parameters used for LLM prompt
 * @returns {String} Cache key
 */
export function generateLlmCacheKey(params) {
  // Create a deterministic representation of the parameters
  const paramsString = JSON.stringify(
    typeof params === 'string' ? { text: params } : params
  );
  
  // Generate a hash of the parameters for a more compact key
  const hash = crypto
    .createHash('sha256')
    .update(paramsString)
    .digest('hex');
  
  return `llm:${hash}`;
}

/**
 * Check if a cached LLM response exists for the given parameters
 * @param {Object} params - Parameters used for LLM prompt
 * @returns {Promise<Object|null>} Cached response or null if not found
 */
export async function getCachedLlmResponse(params) {
  const cacheKey = generateLlmCacheKey(params);
  return await cacheService.get(cacheKey);
}

/**
 * Cache an LLM response for the given parameters
 * @param {Object} params - Parameters used for LLM prompt
 * @param {Object} response - LLM response to cache
 * @param {Number} ttl - Cache TTL in seconds (default: cacheTTL.ENRICHED_DATA)
 * @returns {Promise<Boolean>} Success status
 */
export async function cacheLlmResponse(params, response, ttl = cacheTTL.ENRICHED_DATA) {
  const cacheKey = generateLlmCacheKey(params);
  
  // Add metadata to the cached response
  const cacheData = {
    response,
    cachedAt: new Date().toISOString(),
    params
  };
  
  return await cacheService.set(cacheKey, cacheData, ttl);
} 