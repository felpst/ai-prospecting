/**
 * Company Matcher Controller
 * 
 * This controller handles API requests for matching extracted company entities
 * to existing database entries using exact matching and embeddings.
 */

import * as companyMatcherService from '../services/companyMatcherService.js';
import * as entityExtractorService from '../services/entityExtractorService.js';
import * as webSearchService from '../services/webSearchService.js';
import { logger } from '../utils/logger.js';

/**
 * Match extracted company entities to database entries.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const matchCompanyEntities = async (req, res) => {
  try {
    const { extractedCompanies, options = {} } = req.body;
    
    if (!extractedCompanies || !Array.isArray(extractedCompanies) || extractedCompanies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid extracted companies array is required'
      });
    }
    
    logger.info(`Company matching request received for ${extractedCompanies.length} companies`);
    
    // Match companies using the company matcher service
    const matchResults = await companyMatcherService.matchCompanies(extractedCompanies, options);
    
    return res.status(200).json({
      success: true,
      matchResults: matchResults.matchedCompanies,
      meta: matchResults.meta
    });
  } catch (error) {
    logger.error(`Error in company matching: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while matching companies'
    });
  }
};

/**
 * Perform an end-to-end search with entity extraction and matching.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const searchWithMatching = async (req, res) => {
  try {
    const { query } = req.body;
    const options = req.body.options || {};
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'A search query is required'
      });
    }
    
    logger.info(`Search with matching request received: "${query}"`);
    
    // Step 1: Perform web search
    const searchResults = await webSearchService.searchWeb({ query }, options);
    
    // Step 2: Extract structured entities
    const extractedEntities = await entityExtractorService.extractCompanies(searchResults, options);
    
    // Step 3: Match entities to database entries
    const matchResults = await companyMatcherService.matchCompanies(extractedEntities.companies, options);
    
    // Combine results into a complete response
    return res.status(200).json({
      success: true,
      searchResults: {
        originalQuery: query,
        extractedEntities: extractedEntities.companies,
        matchedCompanies: matchResults.matchedCompanies
      },
      meta: {
        extractionMeta: extractedEntities.meta,
        matchingMeta: matchResults.meta
      }
    });
  } catch (error) {
    logger.error(`Error in search with matching: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred during search with matching'
    });
  }
};

/**
 * Generate an embedding for a text string.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const generateEmbedding = async (req, res) => {
  try {
    const { text, options = {} } = req.body;
    
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Valid text is required for embedding generation'
      });
    }
    
    logger.info(`Embedding generation request received for text (${text.length} chars)`);
    
    // Generate embedding
    const embedding = await companyMatcherService.generateEmbedding(text, options);
    
    return res.status(200).json({
      success: true,
      embedding,
      meta: {
        textLength: text.length,
        embeddingDimensions: embedding.length
      }
    });
  } catch (error) {
    logger.error(`Error in embedding generation: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred during embedding generation'
    });
  }
};

/**
 * Calculate similarity between two texts using embeddings.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>}
 */
export const calculateSimilarity = async (req, res) => {
  try {
    const { text1, text2, options = {} } = req.body;
    
    if (!text1 || !text2 || typeof text1 !== 'string' || typeof text2 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Two valid text strings are required for similarity calculation'
      });
    }
    
    logger.info(`Similarity calculation request received for two texts`);
    
    // Generate embeddings for both texts
    const [embedding1, embedding2] = await Promise.all([
      companyMatcherService.generateEmbedding(text1, options),
      companyMatcherService.generateEmbedding(text2, options)
    ]);
    
    // Calculate similarity
    const similarity = companyMatcherService.calculateCosineSimilarity(embedding1, embedding2);
    
    return res.status(200).json({
      success: true,
      similarity,
      meta: {
        text1Length: text1.length,
        text2Length: text2.length
      }
    });
  } catch (error) {
    logger.error(`Error in similarity calculation: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred during similarity calculation'
    });
  }
};

export default {
  matchCompanyEntities,
  searchWithMatching,
  generateEmbedding,
  calculateSimilarity
}; 