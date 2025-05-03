/**
 * Natural Language Query Parser Service
 * 
 * This service uses the OpenAI API to parse natural language search queries into structured search parameters.
 * It leverages function calling to ensure consistent parameter extraction.
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
    logger.warn('OPENAI_API_KEY environment variable not set. Natural language parsing will not function.');
  } else {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client initialized successfully.');
  }
} catch (error) {
  logger.error(`Failed to initialize OpenAI client: ${error.message}`);
  openaiClient = null; // Ensure client is null if initialization fails
}

// Use model from environment variable, fallback to a default OpenAI model
const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo';
const LLM_MODEL = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

// Cache configuration
const USE_LLM_CACHING = process.env.LLM_CACHING !== 'false'; // Default to true

// Retry configuration
const LLM_RETRY_ATTEMPTS = 3;
const LLM_INITIAL_DELAY_MS = 1000;

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
const withOpenAIRetry = async (fn, maxRetries = LLM_RETRY_ATTEMPTS, initialDelay = LLM_INITIAL_DELAY_MS, isRetryableCheck = isRetryableOpenAIError) => {
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

      logger.warn(`OpenAI call attempt ${retries + 1} failed. Retrying in ${delay.toFixed(0)}ms... Error: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};

// --- Function Definitions for Parameters Extraction ---

/**
 * Definition of the search parameters function for OpenAI function calling
 */
const searchParametersFunction = {
  type: "function",
  function: {
    name: "extractSearchParameters",
    description: "Extract structured search parameters from a natural language query about companies",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "General text search term (if any)"
        },
        industry: {
          type: "string",
          description: "Industry or sector of the company"
        },
        country: {
          type: "string",
          description: "Country where the company is located"
        },
        region: {
          type: "string",
          description: "Region, state, or province where the company is located"
        },
        locality: {
          type: "string",
          description: "City or specific locality where the company is located"
        },
        size: {
          type: "string",
          description: "Company size category"
        },
        founded: {
          type: "string",
          description: "Exact founding year if specified"
        },
        foundedMin: {
          type: "string",
          description: "Minimum founding year for a range"
        },
        foundedMax: {
          type: "string",
          description: "Maximum founding year for a range"
        },
        sort: {
          type: "string",
          description: "Field to sort by (score, name, founded)",
          enum: ["score", "name", "founded"]
        },
        order: {
          type: "string",
          description: "Sort order (asc, desc)",
          enum: ["asc", "desc"]
        }
      },
      required: []
    }
  }
};

// --- Core Functions ---

/**
 * Parses a natural language query into structured search parameters using OpenAI.
 * @param {string} query - The natural language query to parse.
 * @returns {Promise<Object>} The structured search parameters.
 * @throws {ApiError} If the OpenAI service is unavailable or the API call fails.
 */
export const parseQuery = async (query) => {
  if (!openaiClient) {
    logger.error('OpenAI client is not available. Check OPENAI_API_KEY environment variable and initialization logs.');
    throw new ApiError('OpenAI service is not configured or failed to initialize. Please check server configuration.', 503); // Service Unavailable
  }

  // Log the incoming query
  logger.info(`Parsing natural language query: "${query}"`);

  // Check cache if enabled
  if (USE_LLM_CACHING) {
    const cacheKey = { type: 'nlp_parse', query };
    const cachedResponse = await llmCacheService.getCachedLlmResponse(cacheKey);
    if (cachedResponse) {
      logger.info(`Using cached parse result for query: "${query}"`);
      return cachedResponse;
    }
  }

  // Wrap the core logic in the retry function
  return withOpenAIRetry(async () => {
    const startTime = Date.now();

    logger.debug(`Calling OpenAI API with model ${LLM_MODEL}`);
    
    // System prompt to guide the model
    const systemPrompt = `You are an AI assistant specialized in parsing natural language queries about companies into structured search parameters. 
Extract only the parameters that are explicitly mentioned or strongly implied in the query.
Don't make assumptions about parameters that aren't mentioned. 
If a parameter isn't clearly specified, don't include it in your response.`;

    // Make the API call to OpenAI with function calling
    const response = await openaiClient.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      tools: [searchParametersFunction],
      tool_choice: "auto" // Let the model decide whether to use function calling
    });

    const duration = Date.now() - startTime;
    logger.info(`OpenAI API call completed. Duration: ${duration}ms`);

    // Extract the search parameters from the function call
    let searchParams = {};
    const message = response.choices[0].message;
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      
      if (toolCall.function.name === "extractSearchParameters") {
        try {
          searchParams = JSON.parse(toolCall.function.arguments);
          logger.debug(`Successfully extracted search parameters: ${JSON.stringify(searchParams)}`);
        } catch (error) {
          logger.error(`Failed to parse function arguments: ${error.message}`);
          throw new ApiError('Failed to parse search parameters from OpenAI response', 500);
        }
      }
    } else {
      // If no function was called, use the message content as the general query
      logger.debug(`No function called, using message content as query`);
      searchParams = { query: message.content.trim() };
    }

    // Remove any empty or undefined parameters
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key] === undefined || searchParams[key] === null || searchParams[key] === '') {
        delete searchParams[key];
      }
    });

    // Cache the result if enabled
    if (USE_LLM_CACHING) {
      const cacheKey = { type: 'nlp_parse', query };
      await llmCacheService.cacheLlmResponse(cacheKey, searchParams);
    }

    return searchParams;
  });
};

/**
 * Parses a natural language query and initiates a web search using OpenAI.
 * @param {string} query - The natural language query to parse and search.
 * @returns {Promise<Object>} The search results with extracted companies information.
 * @throws {ApiError} If the OpenAI service is unavailable or the API call fails.
 */
export const webSearch = async (query) => {
  if (!openaiClient) {
    logger.error('OpenAI client is not available. Check OPENAI_API_KEY environment variable and initialization logs.');
    throw new ApiError('OpenAI service is not configured or failed to initialize. Please check server configuration.', 503);
  }

  // Log the incoming query
  logger.info(`Performing web search for query: "${query}"`);

  // Check cache if enabled
  if (USE_LLM_CACHING) {
    const cacheKey = { type: 'web_search', query };
    const cachedResponse = await llmCacheService.getCachedLlmResponse(cacheKey);
    if (cachedResponse) {
      logger.info(`Using cached web search result for query: "${query}"`);
      return cachedResponse;
    }
  }

  // Wrap the core logic in the retry function
  return withOpenAIRetry(async () => {
    const startTime = Date.now();

    logger.debug(`Calling OpenAI API for web search with model ${LLM_MODEL}`);

    // System prompt for web search
    const systemPrompt = `You are a research assistant specialized in finding companies that match specific criteria.
When given a query about companies, extract information about companies that match the criteria.
For each company, extract the company name, website domain, and any other relevant information such as industry, location, or specific attributes mentioned in the query.
Return your response as a JSON object with a 'companies' array containing company objects with properties like name, domain, industry, location, etc.`;

    try {
      // Use a standard completion without web search since it may not be available
      const response = await openaiClient.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please find information about: ${query}` }
        ],
        response_format: { type: "json_object" }
      });

      const duration = Date.now() - startTime;
      logger.info(`OpenAI API call completed. Duration: ${duration}ms`);

      // Parse the JSON response
      let searchResults;
      try {
        const jsonContent = response.choices[0].message.content;
        searchResults = JSON.parse(jsonContent);
        
        // Ensure we have a companies array
        if (!searchResults.companies && Array.isArray(searchResults)) {
          searchResults = { companies: searchResults };
        } else if (!searchResults.companies) {
          searchResults = { companies: [], message: "No companies found or invalid response format" };
        }
        
        logger.debug(`Successfully extracted ${searchResults.companies?.length || 0} companies from search`);
      } catch (error) {
        logger.error(`Failed to parse companies from response: ${error.message}`);
        throw new ApiError('Failed to parse companies from search response', 500);
      }

      // Cache the result if enabled
      if (USE_LLM_CACHING) {
        const cacheKey = { type: 'web_search', query };
        await llmCacheService.cacheLlmResponse(cacheKey, searchResults);
      }

      return searchResults;
    } catch (error) {
      logger.error(`OpenAI API call failed: ${error.message}`);
      throw error;
    }
  });
};

// Export the parser service
export default {
  parseQuery,
  webSearch
}; 