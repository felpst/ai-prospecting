/**
 * Web Search Service
 * 
 * This service leverages OpenAI's capabilities to retrieve real-time information
 * based on structured search parameters.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import * as llmCacheService from './llmCacheService.js';

// Load .env from project root
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '..', '..', '..', '.env') });
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Error class for API-related errors
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// --- Configuration ---

// Initialize OpenAI client
let openaiClient;
try {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY environment variable not set. Web search service will not function.');
  } else {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client initialized successfully for web search.');
  }
} catch (error) {
  logger.error(`Failed to initialize OpenAI client for web search: ${error.message}`);
  openaiClient = null; // Ensure client is null if initialization fails
}

// Use model from environment variable, fallback to a default OpenAI model
const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo';
const LLM_MODEL = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

// Cache configuration
const USE_LLM_CACHING = process.env.LLM_CACHING !== 'false'; // Default to true
const WEB_SEARCH_CACHE_TTL = 3600; // 1 hour cache for web search results (in seconds)

// Rate limiting configuration
const MAX_REQUESTS_PER_MINUTE = process.env.WEB_SEARCH_RATE_LIMIT || 10;
const REQUEST_INTERVAL_MS = 60 * 1000 / MAX_REQUESTS_PER_MINUTE;

// Retry configuration
const WEB_SEARCH_RETRY_ATTEMPTS = 3;
const WEB_SEARCH_INITIAL_DELAY_MS = 1000;

// --- Retry Logic Helper ---

/**
 * Checks if an error from the OpenAI API is potentially retryable.
 * @param {Error} error - The error object.
 * @returns {boolean} True if the error might be transient and worth retrying.
 */
const isRetryableOpenAIError = (error) => {
  if (error.status === 429) return true; // Rate limit
  if (error.status >= 500) return true;  // Server errors
  return false;
};

/**
 * Simple retry wrapper for async functions.
 * @param {Function} fn - The async function to execute.
 * @param {number} maxRetries - Maximum number of retry attempts.
 * @param {number} initialDelay - Initial delay in milliseconds for backoff.
 * @param {Function} isRetryableCheck - Function to check if an error is retryable.
 * @returns {Promise<any>} The result of the function if successful.
 * @throws The last error encountered if all retries fail.
 */
const withOpenAIRetry = async (fn, maxRetries = WEB_SEARCH_RETRY_ATTEMPTS, initialDelay = WEB_SEARCH_INITIAL_DELAY_MS, isRetryableCheck = isRetryableOpenAIError) => {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (retries >= maxRetries || !isRetryableCheck(error)) {
        logger.error(`OpenAI call failed after ${retries} retries or error not retryable: ${error.message}`);
        throw error; // Throw the original error if not retryable or max retries reached
      }
      
      let delay = initialDelay * Math.pow(2, retries);
      // Add jitter (randomness up to +/- 20%)
      delay = delay * (1 + (Math.random() * 0.4 - 0.2));
      delay = Math.max(initialDelay / 2, delay); // Ensure minimum delay

      logger.warn(`OpenAI web search call attempt ${retries + 1} failed. Retrying in ${delay.toFixed(0)}ms... Error: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};

// --- Rate Limiting ---

// Simple in-memory rate limiter
const requestTimestamps = [];

/**
 * Implements a sliding window rate limiter for API calls.
 * @returns {Promise<void>} Resolves when it's safe to make a request.
 */
const applyRateLimit = async () => {
  const now = Date.now();
  
  // Remove timestamps older than 1 minute
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60 * 1000) {
    requestTimestamps.shift();
  }
  
  // If we've reached the maximum requests per minute, wait
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestTimestamp = requestTimestamps[0];
    const waitTime = Math.max(60 * 1000 - (now - oldestTimestamp), 0) + 100; // Add small buffer
    
    logger.warn(`Rate limit reached. Waiting ${waitTime}ms before next request.`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return applyRateLimit(); // Recursively check again after waiting
  }
  
  // Record this request
  requestTimestamps.push(now);
};

// --- Core Functions ---

/**
 * Constructs an optimized search query from structured parameters.
 * @param {Object} params - Structured search parameters.
 * @returns {Promise<string>} Optimized search query string.
 */
const constructSearchQuery = async (params) => {
  // If params already has a query field, use that directly
  if (params.query && typeof params.query === 'string') {
    return params.query;
  }
  
  // Otherwise, construct a search query from the parameters
  const queryParts = [];
  
  if (params.industry) queryParts.push(`industry:${params.industry}`);
  if (params.country) queryParts.push(`location:${params.country}`);
  if (params.region) queryParts.push(`region:${params.region}`);
  if (params.locality) queryParts.push(`location:"${params.locality}"`);
  if (params.size) queryParts.push(`company size:${params.size}`);
  if (params.founded) queryParts.push(`founded:${params.founded}`);
  
  // If we have specific parameters but no queryParts yet, add company as a general term
  if (Object.keys(params).length > 0 && queryParts.length === 0) {
    queryParts.push('company');
  }
  
  return queryParts.join(' ');
};

/**
 * Performs a web search using OpenAI to find relevant company information.
 * @param {Object} params - Structured search parameters.
 * @param {Object} options - Additional options like pagination and caching.
 * @returns {Promise<Object>} Search results from web sources.
 * @throws {ApiError} If the web search fails.
 */
export const searchWeb = async (params, options = {}) => {
  if (!openaiClient) {
    logger.error('OpenAI client is not available. Check OPENAI_API_KEY environment variable and initialization logs.');
    throw new ApiError('OpenAI service is not configured or failed to initialize. Please check server configuration.', 503);
  }
  
  // Log the incoming parameters
  logger.info(`Web search request with params: ${JSON.stringify(params)}`);
  
  // Construct search query from parameters
  const searchQuery = await constructSearchQuery(params);
  logger.debug(`Constructed search query: "${searchQuery}"`);
  
  // Check cache if enabled
  if (USE_LLM_CACHING && !options.skipCache) {
    const cacheKey = { type: 'web_search', query: searchQuery };
    const cachedResponse = await llmCacheService.getCachedLlmResponse(cacheKey);
    
    if (cachedResponse) {
      logger.info(`Using cached web search result for query: "${searchQuery}"`);
      return cachedResponse;
    }
  }
  
  // Apply rate limiting
  await applyRateLimit();
  
  // Perform the search
  return withOpenAIRetry(async () => {
    const startTime = Date.now();
    
    logger.debug(`Calling OpenAI API for web search with model ${LLM_MODEL}`);
    
    // System prompt for web search
    const systemPrompt = `You are a research assistant specialized in finding company information based on specific search criteria.
Based on the search parameters, gather information about relevant companies including name, domain, industry, location, size, founding year, and any other relevant details.
Present your findings as a JSON object with a 'companies' array containing company objects with consistent properties.
Focus on accuracy and providing verifiable information from reputable sources.`;
    
    try {
      // Use OpenAI to perform web search
      const response = await openaiClient.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Find companies that match these criteria: ${searchQuery}. Return results as JSON.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const duration = Date.now() - startTime;
      logger.info(`OpenAI web search API call completed. Duration: ${duration}ms`);
      
      // Parse the JSON response
      let searchResults;
      try {
        const jsonContent = response.choices[0].message.content;
        searchResults = JSON.parse(jsonContent);
        
        // Ensure we have a companies array
        if (!searchResults.companies && Array.isArray(searchResults)) {
          searchResults = { companies: searchResults };
        } else if (!searchResults.companies) {
          searchResults = { companies: [], message: "No companies found that match the criteria" };
        }
        
        // Add metadata to the results
        searchResults.meta = {
          query: searchQuery,
          timestamp: new Date().toISOString(),
          params: params,
          resultCount: searchResults.companies.length
        };
        
        logger.debug(`Successfully found ${searchResults.companies.length} companies from web search`);
      } catch (error) {
        logger.error(`Failed to parse companies from web search response: ${error.message}`);
        throw new ApiError('Failed to parse companies from web search response', 500);
      }
      
      // Cache the result if enabled
      if (USE_LLM_CACHING && !options.skipCache) {
        const cacheKey = { type: 'web_search', query: searchQuery };
        await llmCacheService.cacheLlmResponse(cacheKey, searchResults, WEB_SEARCH_CACHE_TTL);
        logger.debug(`Cached web search results for query: "${searchQuery}"`);
      }
      
      return searchResults;
    } catch (error) {
      logger.error(`Web search API call failed: ${error.message}`);
      throw error;
    }
  });
};

/**
 * Aggregates search results from multiple pages or sources.
 * @param {Object} params - Structured search parameters.
 * @param {number} maxResults - Maximum number of results to retrieve.
 * @returns {Promise<Object>} Aggregated search results.
 */
export const aggregateSearchResults = async (params, maxResults = 20) => {
  logger.info(`Aggregating web search results for params: ${JSON.stringify(params)}`);
  
  // First batch of results
  const initialResults = await searchWeb(params);
  let allCompanies = [...initialResults.companies];
  
  // If we need more results and there are potential variations we could search for
  if (allCompanies.length < maxResults && (params.industry || params.locality || params.region || params.country)) {
    // Create variations of the search parameters to get different results
    const variations = [];
    
    if (params.industry) {
      variations.push({ ...params, industry: `${params.industry} companies` });
      variations.push({ ...params, industry: `top ${params.industry} companies` });
    }
    
    if (params.locality || params.region || params.country) {
      const location = params.locality || params.region || params.country;
      variations.push({ ...params, query: `companies in ${location}` });
      if (params.industry) {
        variations.push({ ...params, query: `${params.industry} companies in ${location}` });
      }
    }
    
    // Execute additional searches with different variations
    for (const variation of variations) {
      if (allCompanies.length >= maxResults) break;
      
      try {
        const additionalResults = await searchWeb(variation);
        
        // Add new companies, avoiding duplicates
        const existingDomains = new Set(allCompanies.map(c => c.domain?.toLowerCase()).filter(Boolean));
        const existingNames = new Set(allCompanies.map(c => c.name?.toLowerCase()).filter(Boolean));
        
        for (const company of additionalResults.companies) {
          // Check for duplicates by domain or name
          const domain = company.domain?.toLowerCase();
          const name = company.name?.toLowerCase();
          
          if ((domain && existingDomains.has(domain)) || (name && existingNames.has(name))) {
            continue; // Skip duplicates
          }
          
          // Add new company
          allCompanies.push(company);
          if (domain) existingDomains.add(domain);
          if (name) existingNames.add(name);
          
          // Stop if we've reached the max
          if (allCompanies.length >= maxResults) break;
        }
      } catch (error) {
        logger.warn(`Failed to get additional results for variation: ${JSON.stringify(variation)}: ${error.message}`);
        // Continue with other variations
      }
    }
  }
  
  // Return aggregated results
  return {
    companies: allCompanies.slice(0, maxResults),
    meta: {
      query: params.query || JSON.stringify(params),
      timestamp: new Date().toISOString(),
      resultCount: allCompanies.length,
      params: params
    }
  };
};

export default {
  searchWeb,
  aggregateSearchResults
}; 