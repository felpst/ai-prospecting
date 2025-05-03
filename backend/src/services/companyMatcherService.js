/**
 * Company Matcher Service
 * 
 * This service matches extracted company entities with existing database entries 
 * using OpenAI's text-embedding-3-small model for semantic matching when exact
 * matches aren't found.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import * as llmCacheService from './llmCacheService.js';
import * as companyService from './companyService.js';

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
    logger.warn('OPENAI_API_KEY environment variable not set. Company matching with embeddings will not function.');
  } else {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client initialized successfully for company matching.');
  }
} catch (error) {
  logger.error(`Failed to initialize OpenAI client for company matching: ${error.message}`);
  openaiClient = null; // Ensure client is null if initialization fails
}

// Use embedding model from environment variable, or default to text-embedding-3-small
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

// Cache configuration
const USE_LLM_CACHING = process.env.LLM_CACHING !== 'false'; // Default to true
const EMBEDDING_CACHE_TTL = 3600 * 24 * 30; // 30 days cache for embeddings

// Constants for matching configuration
const DEFAULT_SIMILARITY_THRESHOLD = 0.75; // Minimum similarity score to consider a match
const DEFAULT_MAX_MATCHES = 5; // Maximum number of matches to return per company
const DEFAULT_BATCH_SIZE = 20; // Number of embeddings to generate in a single API call

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

      logger.warn(`OpenAI embedding call attempt ${retries + 1} failed. Retrying in ${delay.toFixed(0)}ms... Error: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};

// --- Core Functions ---

/**
 * Generates an embedding for the given text using OpenAI's API.
 * @param {string} text - The text to generate an embedding for.
 * @param {Object} options - Additional options.
 * @returns {Promise<Array<number>>} The embedding vector.
 * @throws {ApiError} If the embedding generation fails.
 */
export const generateEmbedding = async (text, options = {}) => {
  if (!openaiClient) {
    logger.error('OpenAI client is not available. Check OPENAI_API_KEY environment variable and initialization logs.');
    throw new ApiError('OpenAI service is not configured or failed to initialize. Please check server configuration.', 503);
  }

  // Validate input
  if (!text || typeof text !== 'string' || text.trim() === '') {
    logger.error('Invalid input for embedding generation: empty or non-string text');
    throw new ApiError('Invalid input for embedding generation. Text is required.', 400);
  }

  // Use a normalized version of the text to ensure consistent caching
  const normalizedText = text.trim().toLowerCase();
  
  // Generate a cache key
  const cacheKey = { type: 'embedding', text: normalizedText, model: EMBEDDING_MODEL };

  // Check cache if enabled
  if (USE_LLM_CACHING && !options.skipCache) {
    const cachedEmbedding = await llmCacheService.getCachedLlmResponse(cacheKey);
    if (cachedEmbedding) {
      logger.debug(`Using cached embedding for text: "${normalizedText.substring(0, 30)}..."`);
      return cachedEmbedding;
    }
  }

  // Wrap the core logic in the retry function
  return withOpenAIRetry(async () => {
    const startTime = Date.now();
    logger.debug(`Generating embedding for text: "${normalizedText.substring(0, 30)}..."`);

    try {
      // Call OpenAI API to generate embedding
      const response = await openaiClient.embeddings.create({
        model: EMBEDDING_MODEL,
        input: normalizedText,
        encoding_format: 'float'
      });

      const duration = Date.now() - startTime;
      logger.debug(`Embedding generation completed. Duration: ${duration}ms`);

      // Extract the embedding vector
      const embedding = response.data[0].embedding;

      // Cache the embedding if enabled
      if (USE_LLM_CACHING && !options.skipCache) {
        await llmCacheService.cacheLlmResponse(cacheKey, embedding, EMBEDDING_CACHE_TTL);
        logger.debug(`Cached embedding for text: "${normalizedText.substring(0, 30)}..."`);
      }

      return embedding;
    } catch (error) {
      logger.error(`Embedding generation failed: ${error.message}`);
      throw new ApiError(`Failed to generate embedding: ${error.message}`, error.status || 500);
    }
  });
};

/**
 * Generates embeddings for multiple texts in batches.
 * @param {Array<string>} texts - Array of texts to generate embeddings for.
 * @param {Object} options - Additional options.
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors.
 */
export const generateEmbeddingsBatch = async (texts, options = {}) => {
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    logger.error('Invalid input for batch embedding generation: empty or non-array texts');
    throw new ApiError('Invalid input for batch embedding generation. Array of texts is required.', 400);
  }

  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const embeddings = [];
  
  // Process in batches to avoid rate limits and large requests
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    logger.info(`Processing embedding batch ${i / batchSize + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} items)`);
    
    // Use Promise.all to process the batch in parallel
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text, options).catch(error => {
        logger.error(`Failed to generate embedding for text: "${text.substring(0, 30)}...": ${error.message}`);
        // Return null for failed embeddings
        return null;
      }))
    );
    
    embeddings.push(...batchEmbeddings);
  }
  
  return embeddings;
};

/**
 * Calculates the cosine similarity between two embedding vectors.
 * @param {Array<number>} embedding1 - First embedding vector.
 * @param {Array<number>} embedding2 - Second embedding vector.
 * @returns {number} Cosine similarity score (0-1).
 */
export const calculateCosineSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    logger.error('Invalid embeddings for similarity calculation');
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
};

/**
 * Attempts to find exact matches for companies based on domain or name.
 * @param {Array<Object>} companies - Array of company objects with name and domain properties.
 * @returns {Promise<Array<Object>>} Array of matched companies with match information.
 */
export const findExactMatches = async (companies) => {
  const results = [];
  
  for (const company of companies) {
    let match = null;
    let matchField = null;
    
    // Try to match by domain first (most reliable)
    if (company.domain) {
      try {
        const domainMatch = await companyService.findCompanyByDomain(company.domain);
        if (domainMatch) {
          match = domainMatch;
          matchField = 'domain';
        }
      } catch (error) {
        logger.warn(`Error finding company by domain ${company.domain}: ${error.message}`);
        // Continue to try other matching methods
      }
    }
    
    // If no domain match, try exact name match
    if (!match && company.name) {
      try {
        const nameMatch = await companyService.findCompanyByExactName(company.name);
        if (nameMatch) {
          match = nameMatch;
          matchField = 'name';
        }
      } catch (error) {
        logger.warn(`Error finding company by name ${company.name}: ${error.message}`);
        // Continue to fuzzy matching if needed
      }
    }
    
    results.push({
      original: company,
      matches: match ? [{
        company: match,
        matchType: 'exact',
        matchField,
        score: 1.0,
        isExactMatch: true
      }] : []
    });
  }
  
  return results;
};

/**
 * Matches a list of extracted company entities to existing database entries.
 * Uses a combination of exact matching and embedding-based semantic matching.
 * @param {Array<Object>} extractedCompanies - Array of extracted company entities.
 * @param {Object} options - Matching options.
 * @returns {Promise<Object>} Object with matchedCompanies array and metadata.
 * @throws {ApiError} If the matching process fails.
 */
export const matchCompanies = async (extractedCompanies, options = {}) => {
  if (!extractedCompanies || !Array.isArray(extractedCompanies) || extractedCompanies.length === 0) {
    logger.error('Invalid input for company matching: empty or non-array company entities');
    throw new ApiError('Invalid input for company matching. Array of company entities is required.', 400);
  }

  logger.info(`Matching ${extractedCompanies.length} extracted companies to database entries`);
  
  // First, try to find exact matches by domain or name
  const matchResults = await findExactMatches(extractedCompanies);
  
  // Filter companies that need fuzzy matching (no exact matches found)
  const companiesToMatch = matchResults.filter(result => result.matches.length === 0);
  
  if (companiesToMatch.length === 0) {
    logger.info('All companies have exact matches, skipping fuzzy matching');
    
    // Return with metadata even when skipping fuzzy matching
    return {
      matchedCompanies: matchResults,
      meta: {
        totalExtractedCompanies: extractedCompanies.length,
        exactMatches: matchResults.filter(r => r.matches.some(m => m.isExactMatch)).length,
        fuzzyMatches: 0,
        noMatches: matchResults.filter(r => r.matches.length === 0).length,
        similarityThreshold: options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  logger.info(`${companiesToMatch.length} companies require fuzzy matching`);
  
  const similarityThreshold = options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD;
  const maxMatches = options.maxMatches || DEFAULT_MAX_MATCHES;
  
  // Get all companies from database for matching (limited to 1000 to avoid performance issues)
  const dbCompanies = await companyService.getAllCompanies({ limit: 1000 });
  
  if (dbCompanies.length === 0) {
    logger.warn('No companies found in database for fuzzy matching');
    return {
      matchedCompanies: matchResults,
      meta: {
        totalExtractedCompanies: extractedCompanies.length,
        exactMatches: matchResults.filter(r => r.matches.some(m => m.isExactMatch)).length,
        fuzzyMatches: 0,
        noMatches: matchResults.filter(r => r.matches.length === 0).length,
        similarityThreshold: options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  logger.info(`Retrieved ${dbCompanies.length} companies from database for fuzzy matching`);
  
  // Create a map of company IDs to their enriched text representation for embedding
  const dbCompanyTexts = dbCompanies.map(company => {
    // Combine relevant company fields for better matching
    const fields = [
      company.name,
      company.description,
      company.industry,
      company.location,
      company.website
    ].filter(Boolean); // Filter out undefined/null values
    
    return fields.join(' ');
  });
  
  // Create a similar text representation for extracted companies
  const extractedCompanyTexts = companiesToMatch.map(result => {
    const company = result.original;
    const fields = [
      company.name,
      company.description,
      company.industry,
      company.location,
      company.domain
    ].filter(Boolean);
    
    return fields.join(' ');
  });
  
  // Generate embeddings for all companies
  logger.info('Generating embeddings for database companies...');
  const dbEmbeddings = await generateEmbeddingsBatch(dbCompanyTexts, options);
  
  logger.info('Generating embeddings for extracted companies...');
  const extractedEmbeddings = await generateEmbeddingsBatch(extractedCompanyTexts, options);
  
  // Perform fuzzy matching based on embeddings
  for (let i = 0; i < companiesToMatch.length; i++) {
    const result = companiesToMatch[i];
    const extractedEmbedding = extractedEmbeddings[i];
    
    if (!extractedEmbedding) {
      logger.warn(`No valid embedding for company ${result.original.name}, skipping fuzzy matching`);
      continue;
    }
    
    // Calculate similarity with all database companies
    const similarities = dbEmbeddings.map((dbEmbedding, index) => {
      if (!dbEmbedding) return { index, similarity: 0 };
      
      const similarity = calculateCosineSimilarity(extractedEmbedding, dbEmbedding);
      return { index, similarity };
    });
    
    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Filter matches above threshold and limit to maxMatches
    const topMatches = similarities
      .filter(match => match.similarity >= similarityThreshold)
      .slice(0, maxMatches);
    
    // Add matches to result
    result.matches = topMatches.map(match => ({
      company: dbCompanies[match.index],
      matchType: 'fuzzy',
      matchField: 'embedding',
      score: match.similarity,
      isExactMatch: false
    }));
    
    logger.debug(`Found ${result.matches.length} fuzzy matches for company ${result.original.name}`);
  }
  
  // Update the original matchResults with the fuzzy match results
  for (const matchedCompany of companiesToMatch) {
    const index = matchResults.findIndex(
      r => r.original.name === matchedCompany.original.name
    );
    
    if (index !== -1) {
      matchResults[index].matches = matchedCompany.matches;
    }
  }
  
  // Add metadata to results
  const result = {
    matchedCompanies: matchResults,
    meta: {
      totalExtractedCompanies: extractedCompanies.length,
      exactMatches: matchResults.filter(r => r.matches.some(m => m.isExactMatch)).length,
      fuzzyMatches: matchResults.filter(r => !r.matches.some(m => m.isExactMatch) && r.matches.length > 0).length,
      noMatches: matchResults.filter(r => r.matches.length === 0).length,
      similarityThreshold,
      timestamp: new Date().toISOString()
    }
  };
  
  return result;
};

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  calculateCosineSimilarity,
  matchCompanies
}; 