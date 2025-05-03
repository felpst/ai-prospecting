/**
 * Entity Extractor Service
 * 
 * This service processes web search results and extracts structured company entities
 * with their attributes. It uses OpenAI to extract consistent company data from
 * unstructured web search content.
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
    logger.warn('OPENAI_API_KEY environment variable not set. Entity extraction will not function.');
  } else {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client initialized successfully for entity extraction.');
  }
} catch (error) {
  logger.error(`Failed to initialize OpenAI client for entity extraction: ${error.message}`);
  openaiClient = null; // Ensure client is null if initialization fails
}

// Use model from environment variable, fallback to a default OpenAI model
const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo';
const LLM_MODEL = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

// Cache configuration
const USE_LLM_CACHING = process.env.LLM_CACHING !== 'false'; // Default to true
const ENTITY_EXTRACTION_CACHE_TTL = 3600 * 24; // 24 hours cache for entity extraction

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

      logger.warn(`OpenAI entity extraction call attempt ${retries + 1} failed. Retrying in ${delay.toFixed(0)}ms... Error: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};

// --- Function Definitions for Company Entity Extraction ---

/**
 * Definition of the company entity extraction function for OpenAI function calling
 */
const companyExtractionFunction = {
  type: "function",
  function: {
    name: "extractCompanyEntities",
    description: "Extract structured company information from search results",
    parameters: {
      type: "object",
      properties: {
        companies: {
          type: "array",
          description: "List of companies extracted from the search results",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Company name"
              },
              domain: {
                type: "string",
                description: "Company website domain (without http/https)"
              },
              industry: {
                type: "string",
                description: "Company industry or sector"
              },
              description: {
                type: "string",
                description: "Brief description of the company"
              },
              location: {
                type: "string", 
                description: "Company location (city, region, country)"
              },
              size: {
                type: "string",
                description: "Company size (e.g., 1-10, 11-50, 51-200, etc.)"
              },
              founding_year: {
                type: "integer",
                description: "Year the company was founded"
              },
              specialties: {
                type: "array",
                description: "Company specialties or focus areas",
                items: {
                  type: "string"
                }
              },
              revenue: {
                type: "string",
                description: "Company revenue information if available"
              },
              social_links: {
                type: "object",
                description: "Social media links",
                properties: {
                  linkedin: { type: "string" },
                  twitter: { type: "string" },
                  facebook: { type: "string" }
                }
              },
              confidence_score: {
                type: "number",
                description: "Confidence score for the extracted information (0-1)"
              }
            },
            required: ["name"]
          }
        }
      },
      required: ["companies"]
    }
  }
};

// --- Core Functions ---

/**
 * Extracts structured company entities from web search results.
 * @param {Object} searchResults - The web search results containing unstructured company data.
 * @param {Object} options - Additional options for extraction.
 * @returns {Promise<Object>} Object containing structured company entities.
 * @throws {ApiError} If the extraction fails.
 */
export const extractCompanies = async (searchResults, options = {}) => {
  if (!openaiClient) {
    logger.error('OpenAI client is not available. Check OPENAI_API_KEY environment variable and initialization logs.');
    throw new ApiError('OpenAI service is not configured or failed to initialize. Please check server configuration.', 503);
  }

  // Validate input
  if (!searchResults || !searchResults.companies || !Array.isArray(searchResults.companies)) {
    logger.error('Invalid search results format for entity extraction');
    throw new ApiError('Invalid search results format. Expected an object with a companies array.', 400);
  }

  // Generate a cache key from the search results
  const cacheKeyContent = JSON.stringify(searchResults.companies);
  const cacheKey = { type: 'entity_extraction', contentHash: Buffer.from(cacheKeyContent).toString('base64') };

  // Check cache if enabled
  if (USE_LLM_CACHING && !options.skipCache) {
    const cachedResponse = await llmCacheService.getCachedLlmResponse(cacheKey);
    if (cachedResponse) {
      logger.info(`Using cached entity extraction results`);
      return cachedResponse;
    }
  }

  // Prepare search results for processing
  const rawCompanies = searchResults.companies;
  logger.info(`Extracting structured entities from ${rawCompanies.length} company search results`);

  // Wrap the core logic in the retry function
  return withOpenAIRetry(async () => {
    const startTime = Date.now();
    logger.debug(`Calling OpenAI API for entity extraction with model ${LLM_MODEL}`);

    // System prompt for entity extraction
    const systemPrompt = `You are an AI specialized in extracting structured company information from web search results.
Your task is to extract detailed company data, standardize it, and ensure all entities are consistently formatted.
If certain information is not available, omit those fields rather than guessing or providing placeholders.
For each company, extract as many details as possible, including name, website domain, industry, location, size, founding year, etc.
If multiple entries refer to the same company, merge them into a single comprehensive entity.
Assign a confidence score (0-1) to each company based on the completeness and consistency of the data.`;

    try {
      // Prepare the input data
      const searchResultsString = JSON.stringify(rawCompanies, null, 2);
      
      // Call OpenAI API with function calling
      const response = await openaiClient.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract and structure company information from these search results: ${searchResultsString}` }
        ],
        tools: [companyExtractionFunction],
        tool_choice: { type: "function", function: { name: "extractCompanyEntities" } }
      });

      const duration = Date.now() - startTime;
      logger.info(`OpenAI entity extraction API call completed. Duration: ${duration}ms`);

      // Extract the company entities from the function call
      let extractedCompanies = { companies: [] };
      const message = response.choices[0].message;
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        
        if (toolCall.function.name === "extractCompanyEntities") {
          try {
            extractedCompanies = JSON.parse(toolCall.function.arguments);
            logger.debug(`Successfully extracted ${extractedCompanies.companies.length} company entities`);
          } catch (error) {
            logger.error(`Failed to parse function arguments: ${error.message}`);
            throw new ApiError('Failed to parse company entities from OpenAI response', 500);
          }
        }
      } else {
        logger.warn('OpenAI API did not use function calling for entity extraction');
        throw new ApiError('Entity extraction failed: Model did not return structured data', 500);
      }

      // Add metadata to the extracted companies
      const result = {
        ...extractedCompanies,
        meta: {
          originalCount: rawCompanies.length,
          extractedCount: extractedCompanies.companies.length,
          processingTime: duration,
          timestamp: new Date().toISOString()
        }
      };

      // Deduplicate companies based on domain or name
      result.companies = deduplicateCompanies(result.companies);
      
      // Cache the result if enabled
      if (USE_LLM_CACHING && !options.skipCache) {
        await llmCacheService.cacheLlmResponse(cacheKey, result, ENTITY_EXTRACTION_CACHE_TTL);
        logger.debug(`Cached entity extraction results`);
      }

      return result;
    } catch (error) {
      logger.error(`Entity extraction API call failed: ${error.message}`);
      throw error;
    }
  });
};

/**
 * Deduplicates companies based on domain or name.
 * @param {Array} companies - Array of company objects to deduplicate.
 * @returns {Array} Deduplicated array of company objects.
 */
const deduplicateCompanies = (companies) => {
  if (!companies || !Array.isArray(companies)) return [];
  
  const uniqueCompanies = [];
  const seenDomains = new Set();
  const seenNames = new Map();
  
  // First pass - add companies with domains
  for (const company of companies) {
    if (company.domain && !seenDomains.has(company.domain.toLowerCase())) {
      seenDomains.add(company.domain.toLowerCase());
      seenNames.set(company.name.toLowerCase(), uniqueCompanies.length);
      uniqueCompanies.push(company);
    }
  }
  
  // Second pass - handle companies without domains
  for (const company of companies) {
    if (!company.domain && company.name && !seenNames.has(company.name.toLowerCase())) {
      seenNames.set(company.name.toLowerCase(), uniqueCompanies.length);
      uniqueCompanies.push(company);
    } else if (!company.domain && company.name && seenNames.has(company.name.toLowerCase())) {
      // Merge with existing company if additional data is available
      const existingIndex = seenNames.get(company.name.toLowerCase());
      mergeCompanyData(uniqueCompanies[existingIndex], company);
    }
  }
  
  return uniqueCompanies;
};

/**
 * Merges data from a source company into a target company.
 * @param {Object} target - The target company object to merge into.
 * @param {Object} source - The source company object to merge from.
 */
const mergeCompanyData = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    // Skip if the property is already defined in the target
    if (key === 'name' || key === 'domain' || target[key]) continue;
    
    // Add the property from the source
    if (value !== null && value !== undefined) {
      target[key] = value;
    }
  }
  
  // Special handling for arrays like specialties
  if (source.specialties && Array.isArray(source.specialties)) {
    if (!target.specialties) {
      target.specialties = [];
    }
    
    // Add unique specialties
    for (const specialty of source.specialties) {
      if (!target.specialties.includes(specialty)) {
        target.specialties.push(specialty);
      }
    }
  }
  
  // Special handling for social links
  if (source.social_links && typeof source.social_links === 'object') {
    if (!target.social_links) {
      target.social_links = {};
    }
    
    for (const [platform, url] of Object.entries(source.social_links)) {
      if (!target.social_links[platform]) {
        target.social_links[platform] = url;
      }
    }
  }
};

// Export the extractor service
export default {
  extractCompanies
}; 