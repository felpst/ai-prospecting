/**
 * Admin Routes
 * Provides admin-level functionality for system management
 * These routes should be properly protected in production
 */

import express from 'express';
import cacheService from '../utils/cacheService.js';
import { clearSearchCache, clearAllCache } from '../middleware/cacheMiddleware.js';
import { asyncHandler } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/admin/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', asyncHandler(async (req, res) => {
  const stats = cacheService.getStats();
  res.json(stats);
}));

/**
 * POST /api/admin/cache/clear
 * Clear all cache
 */
router.post('/cache/clear', asyncHandler(async (req, res) => {
  logger.info('Admin requested to clear all cache');
  
  try {
    await clearAllCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error(`Failed to clear cache: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
}));

/**
 * POST /api/admin/cache/clear/search
 * Clear search cache
 */
router.post('/cache/clear/search', asyncHandler(async (req, res) => {
  logger.info('Admin requested to clear search cache');
  
  try {
    await clearSearchCache();
    res.json({
      success: true,
      message: 'Search cache cleared successfully'
    });
  } catch (error) {
    logger.error(`Failed to clear search cache: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to clear search cache',
      error: error.message
    });
  }
}));

/**
 * POST /api/admin/cache/clear/company/:id
 * Clear cache for a specific company
 */
router.post('/cache/clear/company/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Admin requested to clear cache for company ${id}`);
  
  try {
    const companyKey = `company:${id}`;
    const enrichmentKey = `enrichment:${id}`;
    
    // Delete both company details and enrichment cache
    await cacheService.delete(companyKey);
    await cacheService.delete(enrichmentKey);
    
    res.json({
      success: true,
      message: `Cache for company ${id} cleared successfully`
    });
  } catch (error) {
    logger.error(`Failed to clear cache for company ${id}: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Failed to clear cache for company ${id}`,
      error: error.message
    });
  }
}));

export default router; 