/**
 * Storage Service for Scraped Content
 * Provides functionality to store, retrieve, update, and clean up scraped content
 */

import ScrapedContent from '../models/scrapedContent.js';
import { logger } from '../utils/logger.js';

// Default TTL for content (7 days)
const DEFAULT_TTL_DAYS = 7;

/**
 * Save scraped content to storage
 * @param {Object} content - Scraped content object
 * @param {string} content.url - URL of the scraped page
 * @param {string} content.title - Page title
 * @param {string} content.mainContent - Main content text
 * @param {string} content.aboutInfo - About section content
 * @param {string} content.productInfo - Product section content
 * @param {string} content.teamInfo - Team section content
 * @param {string} content.contactInfo - Contact section content
 * @param {string|Buffer} content.rawHtml - Raw HTML content (optional)
 * @param {Object} metadata - Additional metadata
 * @param {number} metadata.statusCode - HTTP status code
 * @param {number} metadata.scrapeDuration - Time taken to scrape in ms
 * @param {string} metadata.companyId - Company ID if known
 * @param {number} ttlDays - Days until content expires (default: 7)
 * @returns {Promise<Object>} Saved scraped content document
 */
export const saveScrapedContent = async (content, metadata = {}, ttlDays = DEFAULT_TTL_DAYS) => {
  try {
    // Basic validation
    if (!content || !content.url) {
      throw new Error('URL is required for scraped content');
    }

    // Extract domain from URL
    let domain = '';
    try {
      domain = new URL(content.url).hostname;
    } catch (e) {
      logger.warn(`Invalid URL format: ${content.url}`);
    }

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    // Check if content already exists
    const existingContent = await ScrapedContent.findOne({ url: content.url });
    
    if (existingContent) {
      logger.info(`Updating existing content for URL: ${content.url}`);
      
      // Update existing content
      existingContent.title = content.title || existingContent.title;
      existingContent.mainContent = content.mainContent || existingContent.mainContent;
      existingContent.aboutInfo = content.aboutInfo || existingContent.aboutInfo;
      existingContent.productInfo = content.productInfo || existingContent.productInfo;
      existingContent.teamInfo = content.teamInfo || existingContent.teamInfo;
      existingContent.contactInfo = content.contactInfo || existingContent.contactInfo;
      
      // Only update rawHtml if provided
      if (content.rawHtml) {
        existingContent.rawHtml = content.rawHtml;
        existingContent.isCompressed = false; // Mark for compression
      }
      
      // Update metadata
      existingContent.statusCode = metadata.statusCode || existingContent.statusCode;
      existingContent.scrapeDuration = metadata.scrapeDuration || existingContent.scrapeDuration;
      if (metadata.companyId) existingContent.companyId = metadata.companyId;
      
      // Reset expiration if requested
      existingContent.expiresAt = expiresAt;
      existingContent.scrapeDate = new Date();
      
      // Save and return updated content
      return await existingContent.save();
    } else {
      // Create new content document
      const newContent = new ScrapedContent({
        url: content.url,
        domain,
        title: content.title,
        mainContent: content.mainContent,
        aboutInfo: content.aboutInfo,
        productInfo: content.productInfo,
        teamInfo: content.teamInfo,
        contactInfo: content.contactInfo,
        rawHtml: content.rawHtml,
        statusCode: metadata.statusCode,
        scrapeDuration: metadata.scrapeDuration,
        companyId: metadata.companyId,
        scrapeDate: new Date(),
        expiresAt
      });
      
      // Save and return new content
      return await newContent.save();
    }
  } catch (error) {
    logger.error(`Error saving scraped content: ${error.message}`);
    throw error;
  }
};

/**
 * Get scraped content by URL
 * @param {string} url - URL of the scraped page
 * @param {boolean} includeRawHtml - Whether to include raw HTML in the result
 * @returns {Promise<Object>} Scraped content document
 */
export const getScrapedContent = async (url, includeRawHtml = false) => {
  try {
    // Build query with or without rawHtml
    const query = ScrapedContent.findOne({ url });
    
    if (includeRawHtml) {
      query.select('+rawHtml');
    }
    
    const content = await query.exec();
    
    if (!content) {
      return null;
    }
    
    // If raw HTML is compressed and requested, decompress it
    if (includeRawHtml && content.isCompressed && content.rawHtml) {
      const htmlString = await content.decompressHtml();
      // Don't save the decompressed HTML to DB, just return it
      content.rawHtml = htmlString;
    }
    
    return content;
  } catch (error) {
    logger.error(`Error retrieving scraped content: ${error.message}`);
    throw error;
  }
};

/**
 * Get scraped content by company ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Scraped content document
 */
export const getScrapedContentByCompanyId = async (companyId) => {
  try {
    return await ScrapedContent.findOne({ companyId }).exec();
  } catch (error) {
    logger.error(`Error retrieving scraped content by company ID: ${error.message}`);
    throw error;
  }
};

/**
 * Update scraped content status
 * @param {string} url - URL of the scraped page
 * @param {string} status - New status ('pending', 'processing', 'processed', 'failed', 'enriched')
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} Updated scraped content document
 */
export const updateScrapedContentStatus = async (url, status, additionalData = {}) => {
  try {
    const validStatuses = ['pending', 'processing', 'processed', 'failed', 'enriched'];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const updateData = {
      status,
      ...additionalData
    };
    
    // Add lastProcessedAt timestamp for certain statuses
    if (['processing', 'processed', 'failed', 'enriched'].includes(status)) {
      updateData.lastProcessedAt = new Date();
    }
    
    // Increment processing attempts for 'processing' status
    if (status === 'processing') {
      return await ScrapedContent.findOneAndUpdate(
        { url },
        { 
          $set: updateData,
          $inc: { processingAttempts: 1 }
        },
        { new: true }
      ).exec();
    } else {
      return await ScrapedContent.findOneAndUpdate(
        { url },
        updateData,
        { new: true }
      ).exec();
    }
  } catch (error) {
    logger.error(`Error updating scraped content status: ${error.message}`);
    throw error;
  }
};

/**
 * Get content ready for processing
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} Array of scraped content documents
 */
export const getPendingContent = async (limit = 10) => {
  try {
    return await ScrapedContent.findPendingContent(limit);
  } catch (error) {
    logger.error(`Error retrieving pending content: ${error.message}`);
    throw error;
  }
};

/**
 * Delete expired content
 * @param {number} olderThanDays - Delete content older than this many days
 * @returns {Promise<Object>} Deletion result with deleted count
 */
export const cleanupExpiredContent = async (olderThanDays = DEFAULT_TTL_DAYS) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await ScrapedContent.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { scrapeDate: { $lt: cutoffDate } }
      ]
    });
    
    logger.info(`Cleaned up ${result.deletedCount} expired content items`);
    return { deletedCount: result.deletedCount };
  } catch (error) {
    logger.error(`Error cleaning up expired content: ${error.message}`);
    throw error;
  }
};

/**
 * Search for scraped content
 * @param {Object} filters - Search filters
 * @param {string} filters.domain - Domain to filter by
 * @param {string} filters.status - Status to filter by
 * @param {string} filters.searchText - Text to search for in content
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results
 * @param {number} options.skip - Number of results to skip (for pagination)
 * @returns {Promise<Array>} Array of matching content
 */
export const searchScrapedContent = async (filters = {}, options = { limit: 20, skip: 0 }) => {
  try {
    const query = {};
    
    // Apply filters
    if (filters.domain) query.domain = filters.domain;
    if (filters.status) query.status = filters.status;
    if (filters.companyId) query.companyId = filters.companyId;
    
    // Text search
    if (filters.searchText) {
      query.$or = [
        { title: { $regex: filters.searchText, $options: 'i' } },
        { mainContent: { $regex: filters.searchText, $options: 'i' } },
        { aboutInfo: { $regex: filters.searchText, $options: 'i' } },
        { productInfo: { $regex: filters.searchText, $options: 'i' } },
        { teamInfo: { $regex: filters.searchText, $options: 'i' } },
        { contactInfo: { $regex: filters.searchText, $options: 'i' } },
      ];
    }
    
    // Execute query with pagination
    const results = await ScrapedContent.find(query)
      .skip(options.skip)
      .limit(options.limit)
      .sort({ scrapeDate: -1 }) // Newest first
      .exec();
    
    const total = await ScrapedContent.countDocuments(query);
    
    return {
      results,
      pagination: {
        total,
        page: Math.floor(options.skip / options.limit) + 1,
        limit: options.limit,
        pages: Math.ceil(total / options.limit)
      }
    };
  } catch (error) {
    logger.error(`Error searching scraped content: ${error.message}`);
    throw error;
  }
};

/**
 * Get storage statistics
 * @returns {Promise<Object>} Storage statistics
 */
export const getStorageStats = async () => {
  try {
    const stats = {};
    
    // Total count
    stats.totalDocuments = await ScrapedContent.countDocuments();
    
    // Count by status
    const statusCounts = await ScrapedContent.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    stats.byStatus = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    // Average content size
    const sizeStats = await ScrapedContent.aggregate([
      { $match: { contentSize: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgSize: { $avg: '$contentSize' }, totalSize: { $sum: '$contentSize' } } }
    ]);
    if (sizeStats.length > 0) {
      stats.averageContentSizeBytes = Math.round(sizeStats[0].avgSize);
      stats.totalContentSizeBytes = sizeStats[0].totalSize;
    }
    
    // Recently added count (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    stats.addedLast24Hours = await ScrapedContent.countDocuments({ scrapeDate: { $gte: oneDayAgo } });
    
    return stats;
  } catch (error) {
    logger.error(`Error getting storage stats: ${error.message}`);
    throw error;
  }
};

/**
 * Determine if content is valid and has enough information
 * @param {Object} content - Scraped content object
 * @returns {boolean} Whether the content is valid
 */
export const validateContentQuality = (content) => {
  // Check if main content exists and has reasonable length
  if (!content.mainContent || content.mainContent.length < 100) {
    return false;
  }
  
  // Check if at least one specialized content section exists
  const hasSpecializedContent = 
    (content.aboutInfo && content.aboutInfo.length > 100) ||
    (content.productInfo && content.productInfo.length > 100) ||
    (content.teamInfo && content.teamInfo.length > 100) ||
    (content.contactInfo && content.contactInfo.length > 50);
  
  return hasSpecializedContent;
};

/**
 * Schedule a cleanup job (to be called by a cron job)
 * @returns {Promise<void>}
 */
export const scheduleCleanup = async () => {
  logger.info('Running scheduled content cleanup job');
  await cleanupExpiredContent();
}; 