/**
 * Cache Service
 * Provides a unified interface for caching data with support for both Redis and in-memory caching
 */

import Redis from 'ioredis';
import NodeCache from 'node-cache';
import { cacheConfig, cacheTTL } from './cacheConfig.js';
import logger from './logger.js';
import { promisify } from 'util';
import zlib from 'zlib';

// Promisify zlib functions for compression
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

// Cache metrics
const metrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  errors: 0,
  startTime: Date.now()
};

// Initialize the appropriate cache store based on configuration
class CacheService {
  constructor() {
    this.useRedis = cacheConfig.useRedis;
    this.compressionEnabled = cacheConfig.useCompression;
    this.keyPrefix = cacheConfig.keyPrefix;
    
    // Initialize cache client based on configuration
    if (this.useRedis) {
      try {
        this.redisClient = new Redis(cacheConfig.redisUrl, {
          password: cacheConfig.redisPassword || undefined,
          retryStrategy: (times) => {
            // Retry connection with exponential backoff
            const delay = Math.min(times * 50, 2000);
            return delay;
          }
        });
        
        // Set up event handlers
        this.redisClient.on('error', (err) => {
          logger.error(`Redis error: ${err.message}`);
          metrics.errors++;
          
          // If Redis fails, fall back to in-memory cache
          if (!this.memoryCache) {
            logger.info('Falling back to in-memory cache');
            this.initializeMemoryCache();
          }
        });
        
        this.redisClient.on('connect', () => {
          logger.info('Connected to Redis server');
        });
        
        logger.info('Redis cache initialized');
      } catch (error) {
        logger.error(`Failed to initialize Redis: ${error.message}`);
        // Fall back to in-memory cache
        this.useRedis = false;
        this.initializeMemoryCache();
      }
    } else {
      this.initializeMemoryCache();
    }
  }
  
  // Initialize in-memory cache
  initializeMemoryCache() {
    this.memoryCache = new NodeCache({
      stdTTL: cacheTTL.DEFAULT,
      checkperiod: cacheConfig.checkPeriod,
      maxKeys: cacheConfig.maxSize,
      useClones: false // For performance reasons
    });
    logger.info('In-memory cache initialized');
  }
  
  // Format cache key with prefix
  _formatKey(key) {
    return `${this.keyPrefix}${key}`;
  }
  
  // Compress data if enabled and size is large enough
  async _maybeCompressData(data) {
    if (!this.compressionEnabled) {
      return { data, compressed: false };
    }
    
    const stringData = JSON.stringify(data);
    // Only compress if data is larger than 1KB
    if (stringData.length > 1024) {
      try {
        const compressedData = await gzipAsync(Buffer.from(stringData));
        return { 
          data: compressedData, 
          compressed: true 
        };
      } catch (error) {
        logger.error(`Compression error: ${error.message}`);
        return { data, compressed: false };
      }
    }
    
    return { data, compressed: false };
  }
  
  // Decompress data if it was compressed
  async _maybeDecompressData(data, compressed) {
    if (!compressed) {
      return data;
    }
    
    try {
      const decompressedData = await gunzipAsync(data);
      return JSON.parse(decompressedData.toString());
    } catch (error) {
      logger.error(`Decompression error: ${error.message}`);
      throw new Error('Failed to decompress cached data');
    }
  }
  
  // Get value from cache
  async get(key) {
    const formattedKey = this._formatKey(key);
    
    try {
      if (this.useRedis && this.redisClient) {
        // Get from Redis
        const cachedItem = await this.redisClient.get(formattedKey);
        
        if (cachedItem) {
          // Parse the cached item
          const parsedItem = JSON.parse(cachedItem);
          const decompressedData = await this._maybeDecompressData(
            parsedItem.data, 
            parsedItem.compressed
          );
          
          metrics.hits++;
          return decompressedData;
        }
      } else if (this.memoryCache) {
        // Get from in-memory cache
        const cachedItem = this.memoryCache.get(formattedKey);
        
        if (cachedItem) {
          metrics.hits++;
          return cachedItem;
        }
      }
      
      // Cache miss
      metrics.misses++;
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}: ${error.message}`);
      metrics.errors++;
      return null;
    }
  }
  
  // Set value in cache
  async set(key, value, ttl = cacheTTL.DEFAULT) {
    const formattedKey = this._formatKey(key);
    
    try {
      if (this.useRedis && this.redisClient) {
        // Process data for Redis
        const { data, compressed } = await this._maybeCompressData(value);
        
        // Store with metadata
        const cacheItem = JSON.stringify({
          data,
          compressed,
          timestamp: Date.now()
        });
        
        // Set in Redis with TTL
        await this.redisClient.set(formattedKey, cacheItem, 'EX', ttl);
      } else if (this.memoryCache) {
        // Set in memory cache
        this.memoryCache.set(formattedKey, value, ttl);
      }
      
      metrics.sets++;
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}: ${error.message}`);
      metrics.errors++;
      return false;
    }
  }
  
  // Delete value from cache
  async delete(key) {
    const formattedKey = this._formatKey(key);
    
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(formattedKey);
      } else if (this.memoryCache) {
        this.memoryCache.del(formattedKey);
      }
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}: ${error.message}`);
      metrics.errors++;
      return false;
    }
  }
  
  // Delete multiple values with a pattern (only works with Redis)
  async deletePattern(pattern) {
    if (!this.useRedis || !this.redisClient) {
      logger.warn('Pattern deletion only supported with Redis');
      return false;
    }
    
    const formattedPattern = this._formatKey(pattern) + '*';
    
    try {
      // Find keys matching pattern
      const keys = await this.redisClient.keys(formattedPattern);
      
      if (keys.length > 0) {
        // Delete all matching keys
        await this.redisClient.del(keys);
        logger.info(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache deletePattern error: ${error.message}`);
      metrics.errors++;
      return false;
    }
  }
  
  // Clear all cache entries
  async clear() {
    try {
      if (this.useRedis && this.redisClient) {
        // Only clear keys with our prefix to avoid clearing other data
        const keys = await this.redisClient.keys(`${this.keyPrefix}*`);
        
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          logger.info(`Cleared ${keys.length} keys from Redis cache`);
        }
      } else if (this.memoryCache) {
        this.memoryCache.flushAll();
        logger.info('In-memory cache cleared');
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache clear error: ${error.message}`);
      metrics.errors++;
      return false;
    }
  }
  
  // Get cache statistics
  getStats() {
    const totalOps = metrics.hits + metrics.misses;
    const hitRate = totalOps > 0 ? (metrics.hits / totalOps * 100).toFixed(2) : 0;
    
    return {
      hits: metrics.hits,
      misses: metrics.misses,
      sets: metrics.sets,
      errors: metrics.errors,
      hitRate: `${hitRate}%`,
      totalOperations: totalOps,
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
      type: this.useRedis ? 'Redis' : 'In-Memory',
      compression: this.compressionEnabled
    };
  }
  
  // Close connections on application shutdown
  async close() {
    if (this.useRedis && this.redisClient) {
      await this.redisClient.quit();
      logger.info('Redis connection closed');
    }
    
    if (this.memoryCache) {
      this.memoryCache.close();
      logger.info('In-memory cache closed');
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService; 