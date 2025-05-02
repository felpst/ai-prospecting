/**
 * Search Routes
 * 
 * Optimized search endpoints that use aggregation pipeline for better performance
 */

import express from 'express';
import { asyncHandler } from '../utils/errorHandler.js';
import * as searchService from '../services/searchService.js';
import { formatPaginationLinks } from '../utils/paginationUtils.js';
import { cacheSearchResults } from '../middleware/cacheMiddleware.js';
import { cacheTTL } from '../utils/cacheConfig.js';
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

export default router; 