/**
 * Web Search Controller
 * 
 * Manages web search requests, leveraging the WebSearchService to retrieve real-time
 * company information from the web.
 */

import * as webSearchService from '../services/webSearchService.js';
import { logger } from '../utils/logger.js';

/**
 * Search for companies on the web using the structured parameters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const searchCompanies = async (req, res) => {
  try {
    const searchParams = req.body.params || {};
    const options = req.body.options || {};
    
    if (Object.keys(searchParams).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search parameters are required'
      });
    }
    
    logger.info(`Web search request received with params: ${JSON.stringify(searchParams)}`);
    
    // Execute the web search
    const searchResults = await webSearchService.searchWeb(searchParams, options);
    
    // Return the search results
    return res.status(200).json({
      success: true,
      results: searchResults.companies,
      meta: {
        ...searchResults.meta,
        originalParams: searchParams
      }
    });
  } catch (error) {
    logger.error(`Error in web search: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while processing your web search query'
    });
  }
};

/**
 * Aggregate search results from multiple searches to provide comprehensive results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const aggregateSearch = async (req, res) => {
  try {
    const searchParams = req.body.params || {};
    const maxResults = req.body.maxResults || 20;
    
    if (Object.keys(searchParams).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search parameters are required'
      });
    }
    
    logger.info(`Aggregate web search request received with params: ${JSON.stringify(searchParams)}`);
    
    // Execute the aggregated web search
    const searchResults = await webSearchService.aggregateSearchResults(searchParams, maxResults);
    
    // Return the search results
    return res.status(200).json({
      success: true,
      results: searchResults.companies,
      meta: {
        ...searchResults.meta,
        originalParams: searchParams,
        maxResults: maxResults
      }
    });
  } catch (error) {
    logger.error(`Error in aggregate web search: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while processing your aggregate web search query'
    });
  }
};

export default {
  searchCompanies,
  aggregateSearch
}; 