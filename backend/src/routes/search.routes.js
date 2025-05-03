/**
 * Search Routes
 * 
 * Optimized search endpoints that use aggregation pipeline for better performance
 */

import express from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as searchService from '../services/searchService.js';
import * as nlSearchController from '../controllers/naturalLanguageSearchController.js';
import * as webSearchController from '../controllers/webSearchController.js';
import * as companyMatcherController from '../controllers/companyMatcherController.js';
import { formatPaginationLinks } from '../utils/paginationUtils.js';
import { cacheSearchResults, cacheMiddleware } from '../middleware/cacheMiddleware.js';
import { cacheTTL, cacheKeys } from '../utils/cacheConfig.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/search
 * @description Advanced search endpoint that uses optimized aggregation pipeline
 */
router.get('/', cacheSearchResults(cacheTTL.SEARCH_RESULTS), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // Log the search request
  logger.info(`[API] GET /api/search with params:`, req.query);
  
  try {
    // Execute search with current parameters
    const searchResult = await searchService.executeSearch(req.query, {
      count: req.query.count === 'true',
      facets: req.query.facets ? req.query.facets.split(',') : undefined
    });
    
    // Format response with pagination links if needed
    let paginationData = searchResult.pagination;
    
    if (searchResult.pagination.next_cursor || searchResult.pagination.prev_cursor) {
      const formattedPagination = formatPaginationLinks(req, searchResult.pagination);
      paginationData = {
        ...searchResult.pagination,
        links: formattedPagination.links
      };
    }
    
    // Calculate total execution time
    const executionTime = Date.now() - startTime;
    
    // Build the response object
    const response = {
      companies: searchResult.results,
      pagination: paginationData,
      ...(searchResult.facets && { facets: searchResult.facets }),
      meta: {
        ...searchResult.meta,
        executionTime: `${executionTime}ms`,
        query: req.query,
        cached: res.get('X-Cache') === 'HIT'
      }
    };
    
    // Add response time header
    res.set('X-Response-Time', `${executionTime}ms`);
    
    // Send JSON response
    res.json(response);
  } catch (error) {
    logger.error(`[ERROR] Search failed: ${error.message}`, error.stack);
    throw error;
  }
}));

/**
 * @route GET /api/search/facets
 * @description Get just the facet counts for search filters
 */
router.get('/facets', cacheSearchResults(cacheTTL.SEARCH_RESULTS), asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Execute faceted search
    const facets = req.query.facets ? req.query.facets.split(',') : ['industry', 'country', 'size'];
    const searchParams = { ...req.query, includeFacets: true, limit: 0 };
    
    const searchResult = await searchService.facetedSearch(searchParams, facets);
    
    // Calculate total execution time
    const executionTime = Date.now() - startTime;
    
    // Send facets only
    res.json({
      facets: searchResult.facets,
      meta: {
        executionTime: `${executionTime}ms`,
        count: searchResult.pagination.count,
        cached: res.get('X-Cache') === 'HIT'
      }
    });
  } catch (error) {
    logger.error(`[ERROR] Facet search failed: ${error.message}`);
    throw error;
  }
}));

/**
 * @route POST /api/search/natural-language
 * @description Natural language search endpoint that converts free-text queries into structured search parameters
 */
router.post('/natural-language', asyncHandler(nlSearchController.naturalLanguageSearch));

/**
 * @route POST /api/search/unified
 * @description Comprehensive natural language search API that combines database search, web search, 
 * entity extraction, and company matching with intelligent ranking and fallbacks
 */
router.post('/unified', cacheMiddleware({
  getKey: req => `unified-search:${req.body.query}:${JSON.stringify(req.body.options || {})}`,
  ttl: cacheTTL.UNIFIED_SEARCH || 300, // 5 minutes default
  shouldCache: req => !!req.body.query // Only cache if there's a query
}), asyncHandler(nlSearchController.unifiedSearch));

/**
 * @route POST /api/search/web
 * @description Web search endpoint that uses OpenAI's web search to find companies
 */
router.post('/web', asyncHandler(nlSearchController.webSearch));

/**
 * @route POST /api/search/extract-entities
 * @description Extract structured company entities from web search results
 */
router.post('/extract-entities', asyncHandler(nlSearchController.extractCompanyEntities));

/**
 * @route POST /api/search/web-companies
 * @description Real-time web search endpoint that retrieves company information from the web
 */
router.post('/web-companies', asyncHandler(webSearchController.searchCompanies));

/**
 * @route POST /api/search/web-aggregate
 * @description Aggregated web search endpoint that collects comprehensive company information from multiple sources
 */
router.post('/web-aggregate', asyncHandler(webSearchController.aggregateSearchResults));

/**
 * @route POST /api/search/match-companies
 * @description Match extracted company entities to existing database entries
 */
router.post('/match-companies', asyncHandler(companyMatcherController.matchCompanyEntities));

/**
 * @route POST /api/search/with-matching
 * @description End-to-end search flow with web search, entity extraction, and company matching
 */
router.post('/with-matching', asyncHandler(companyMatcherController.searchWithMatching));

/**
 * @route POST /api/search/embedding
 * @description Generate an embedding for a given text
 */
router.post('/embedding', asyncHandler(companyMatcherController.generateEmbedding));

/**
 * @route POST /api/search/similarity
 * @description Calculate similarity between two texts using embeddings
 */
router.post('/similarity', asyncHandler(companyMatcherController.calculateSimilarity));

export default router; 