/**
 * Storage Tests
 * Tests the storage functionality for scraped content
 */

import mongoose from 'mongoose';
import { 
  saveScrapedContent, 
  getScrapedContent, 
  updateScrapedContentStatus,
  getStorageStats,
  cleanupExpiredContent,
  validateContentQuality
} from '../services/storageService.js';
import { scrapeCompanyWebsite } from '../services/scraperService.js';
import { logger } from '../utils/logger.js';

// MongoDB connection string for testing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webscraper_test';

// Test URLs
const TEST_URLS = [
  'https://example.com',
  'https://www.iana.org'
];

// Connect to MongoDB
const connectToDatabase = async () => {
  try {
    logger.info(`Connecting to MongoDB at ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    logger.info('Successfully connected to MongoDB');
    return true;
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);
    return false;
  }
};

// Disconnect from MongoDB
const disconnectFromDatabase = async () => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    return true;
  } catch (error) {
    logger.error(`Error disconnecting from MongoDB: ${error.message}`);
    return false;
  }
};

// Test basic storage functionality
const testStorageBasics = async () => {
  logger.info('\n=== Testing basic storage functionality ===\n');
  
  try {
    // Create test content
    const testContent = {
      url: 'https://test.example.com/storage-test',
      title: 'Storage Test Page',
      mainContent: 'This is test main content for storage testing.',
      aboutInfo: 'Test about information for storage.',
      productInfo: 'Test product information for storage.',
      teamInfo: 'Test team information for storage.',
      contactInfo: 'contact@example.com'
    };
    
    // Save the test content
    logger.info('Saving test content...');
    const savedContent = await saveScrapedContent(testContent, {
      statusCode: 200,
      scrapeDuration: 1500
    });
    
    logger.info(`Content saved with ID: ${savedContent._id}`);
    
    // Retrieve the content
    logger.info('Retrieving saved content...');
    const retrievedContent = await getScrapedContent(testContent.url);
    
    // Verify content was saved correctly
    if (retrievedContent && retrievedContent.url === testContent.url) {
      logger.info('✓ Successfully retrieved saved content');
    } else {
      logger.error('✗ Failed to retrieve content correctly');
    }
    
    // Update status
    logger.info('Updating content status...');
    const updatedContent = await updateScrapedContentStatus(testContent.url, 'processed');
    
    if (updatedContent && updatedContent.status === 'processed') {
      logger.info('✓ Successfully updated content status');
    } else {
      logger.error('✗ Failed to update content status');
    }
    
    // Test content quality validation
    logger.info('Testing content quality validation...');
    const highQualityContent = {
      mainContent: 'This is a long main content that should pass the quality check. '.repeat(10),
      aboutInfo: 'This is about information that is detailed enough. '.repeat(5)
    };
    
    const lowQualityContent = {
      mainContent: 'Too short',
      aboutInfo: ''
    };
    
    const isHighQuality = validateContentQuality(highQualityContent);
    const isLowQuality = validateContentQuality(lowQualityContent);
    
    logger.info(`High quality validation result: ${isHighQuality}`);
    logger.info(`Low quality validation result: ${isLowQuality}`);
    
    if (isHighQuality && !isLowQuality) {
      logger.info('✓ Content quality validation works correctly');
    } else {
      logger.error('✗ Content quality validation failed');
    }
    
    return true;
  } catch (error) {
    logger.error(`Storage basics test failed: ${error.message}`);
    return false;
  }
};

// Test real scraping with storage
const testScrapingWithStorage = async () => {
  logger.info('\n=== Testing scraping with storage integration ===\n');
  
  try {
    const testUrl = TEST_URLS[0];
    
    // First scraping run
    logger.info(`Scraping ${testUrl} and saving to storage...`);
    const startTime = Date.now();
    const scrapedData = await scrapeCompanyWebsite(testUrl, {
      saveToStorage: true,
      companyId: 'test-company-123'
    });
    
    const firstScrapeDuration = Date.now() - startTime;
    logger.info(`First scrape completed in ${firstScrapeDuration}ms`);
    
    if (!scrapedData.error) {
      logger.info('✓ First scraping successful');
    } else {
      logger.error(`✗ First scraping failed: ${scrapedData.error.message}`);
      return false;
    }
    
    // Second scraping run - should use cache
    logger.info(`Scraping ${testUrl} again - should use cache...`);
    const cacheStartTime = Date.now();
    const cachedData = await scrapeCompanyWebsite(testUrl, {
      saveToStorage: true,
      companyId: 'test-company-123'
    });
    
    const secondScrapeDuration = Date.now() - cacheStartTime;
    logger.info(`Second scrape completed in ${secondScrapeDuration}ms`);
    
    if (cachedData.fromCache) {
      logger.info('✓ Second scraping successfully used cached data');
    } else {
      logger.error('✗ Second scraping did not use cache as expected');
    }
    
    // Test cache retrieval speed improvement
    const speedImprovement = ((firstScrapeDuration - secondScrapeDuration) / firstScrapeDuration) * 100;
    logger.info(`Speed improvement with cache: ${speedImprovement.toFixed(2)}%`);
    
    return true;
  } catch (error) {
    logger.error(`Scraping with storage test failed: ${error.message}`);
    return false;
  }
};

// Test storage statistics
const testStorageStats = async () => {
  logger.info('\n=== Testing storage statistics ===\n');
  
  try {
    // Get storage stats
    const stats = await getStorageStats();
    
    logger.info('Storage statistics:');
    logger.info(`- Total documents: ${stats.totalDocuments}`);
    logger.info(`- Added in last 24 hours: ${stats.addedLast24Hours}`);
    
    if (stats.byStatus) {
      logger.info('Status breakdown:');
      for (const [status, count] of Object.entries(stats.byStatus)) {
        logger.info(`  - ${status}: ${count}`);
      }
    }
    
    if (stats.averageContentSizeBytes) {
      logger.info(`- Average content size: ${stats.averageContentSizeBytes} bytes`);
    }
    
    if (stats.totalContentSizeBytes) {
      const sizeInMB = stats.totalContentSizeBytes / (1024 * 1024);
      logger.info(`- Total content size: ${sizeInMB.toFixed(2)} MB`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Storage stats test failed: ${error.message}`);
    return false;
  }
};

// Test content cleanup
const testContentCleanup = async () => {
  logger.info('\n=== Testing content cleanup ===\n');
  
  try {
    // Create expired test content
    const expiredTestContent = {
      url: 'https://test.example.com/expired-content',
      title: 'Expired Test Page',
      mainContent: 'This is expired test content.'
    };
    
    // Set expiration to the past
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 8); // 8 days ago
    
    // Save the expired content with past date
    const savedContent = await saveScrapedContent(expiredTestContent, {
      statusCode: 200,
      scrapeDuration: 1000
    });
    
    // Manually set the expiration date to the past
    savedContent.expiresAt = pastDate;
    savedContent.scrapeDate = pastDate;
    await savedContent.save();
    
    logger.info(`Created expired content with ID: ${savedContent._id}`);
    
    // Run cleanup
    logger.info('Running content cleanup...');
    const cleanupResult = await cleanupExpiredContent(7); // 7 days threshold
    
    logger.info(`Cleanup result: ${cleanupResult.deletedCount} items deleted`);
    
    // Verify the expired content was deleted
    const retrievedContent = await getScrapedContent(expiredTestContent.url);
    
    if (!retrievedContent) {
      logger.info('✓ Expired content was successfully deleted');
    } else {
      logger.error('✗ Expired content was not deleted as expected');
    }
    
    return true;
  } catch (error) {
    logger.error(`Content cleanup test failed: ${error.message}`);
    return false;
  }
};

// Main test runner
const runAllTests = async () => {
  logger.info('=== Starting Storage Service Tests ===');
  
  // Connect to database
  const connected = await connectToDatabase();
  if (!connected) {
    logger.error('Tests aborted due to database connection failure');
    process.exit(1);
  }
  
  try {
    // Run all tests
    let testResults = [];
    
    testResults.push({ name: 'Storage Basics', result: await testStorageBasics() });
    testResults.push({ name: 'Scraping with Storage', result: await testScrapingWithStorage() });
    testResults.push({ name: 'Storage Statistics', result: await testStorageStats() });
    testResults.push({ name: 'Content Cleanup', result: await testContentCleanup() });
    
    // Print test results
    logger.info('\n=== Test Results ===\n');
    testResults.forEach(test => {
      logger.info(`${test.result ? '✅' : '❌'} ${test.name}: ${test.result ? 'PASSED' : 'FAILED'}`);
    });
    
    const passedCount = testResults.filter(test => test.result).length;
    logger.info(`\n${passedCount} of ${testResults.length} tests passed`);
    
  } catch (error) {
    logger.error(`Test execution error: ${error.message}`);
  } finally {
    // Disconnect from database
    await disconnectFromDatabase();
  }
};

// Run the tests
runAllTests(); 