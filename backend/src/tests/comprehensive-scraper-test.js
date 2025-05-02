/**
 * Comprehensive Web Scraper Test
 * Tests all major components of the web scraping functionality
 */

import { 
  initBrowser, 
  createPage, 
  navigateToUrl,
  closeBrowser,
  extractMainContent,
  extractAboutInfo,
  extractProductInfo,
  extractTeamInfo,
  extractContactInfo,
  scrapeCompanyWebsite,
  testScraper
} from '../services/scraperService.js';

import {
  saveScrapedContent,
  getScrapedContent,
  updateScrapedContentStatus,
  getStorageStats,
  cleanupExpiredContent
} from '../services/storageService.js';

import { getRateLimiter } from '../utils/rateLimiter.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

// Test URLs with different characteristics
const TEST_URLS = [
  { url: 'https://example.com', name: 'Simple static site' },
  { url: 'https://www.mozilla.org', name: 'Complex organization site' },
  { url: 'https://about.gitlab.com', name: 'Company with rich about section' },
  { url: 'https://nonexistent-domain-for-testing-123456.com', name: 'Nonexistent domain (error case)' }
];

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webscraper_test';

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

// Test basic scraper functionality
const testBasicScraper = async () => {
  logger.info('\n=== Testing Basic Scraper Functionality ===\n');
  
  try {
    const result = await testScraper('https://example.com');
    logger.info(`Basic scraper test ${result.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    if (result.success) {
      logger.info(`Successfully loaded: "${result.title}" from ${result.url}`);
    } else {
      logger.error(`Error: ${result.error.message}`);
    }
    return result.success;
  } catch (error) {
    logger.error(`Basic scraper test error: ${error.message}`);
    return false;
  }
};

// Test content extraction functions
const testContentExtraction = async () => {
  logger.info('\n=== Testing Content Extraction ===\n');
  
  let browser = null;
  let page = null;
  
  try {
    browser = await initBrowser();
    page = await createPage(browser);
    
    for (const testSite of TEST_URLS.slice(0, 2)) { // Just use the first two valid URLs
      logger.info(`Testing content extraction on: ${testSite.name} (${testSite.url})`);
      
      try {
        await navigateToUrl(page, testSite.url);
        
        // Test each extraction function
        const mainContent = await extractMainContent(page);
        logger.info(`Main content extraction: ${mainContent ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        logger.info(`Main content length: ${mainContent?.length || 0} characters`);
        
        const aboutInfo = await extractAboutInfo(page);
        logger.info(`About info extraction: ${aboutInfo ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        
        const productInfo = await extractProductInfo(page);
        logger.info(`Product info extraction: ${productInfo ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        
        const teamInfo = await extractTeamInfo(page);
        logger.info(`Team info extraction: ${teamInfo ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        
        const contactInfo = await extractContactInfo(page);
        logger.info(`Contact info extraction: ${contactInfo ? 'SUCCESS ✅' : 'FAILED ❌'}`);
      } catch (error) {
        logger.error(`Error testing extraction on ${testSite.url}: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Content extraction test error: ${error.message}`);
    return false;
  } finally {
    if (browser) {
      await closeBrowser();
    }
  }
};

// Test error handling
const testErrorHandling = async () => {
  logger.info('\n=== Testing Error Handling ===\n');
  
  try {
    // Test with a non-existent domain to trigger error handling
    const errorUrl = TEST_URLS[3].url;
    logger.info(`Testing error handling with invalid URL: ${errorUrl}`);
    
    const result = await scrapeCompanyWebsite(errorUrl, {
      useRetries: true,
      maxRetries: 2
    });
    
    if (result.error) {
      logger.info(`Error handling test PASSED ✅`);
      logger.info(`Error type: ${result.error.type}`);
      logger.info(`Error message: ${result.error.message}`);
      return true;
    } else {
      logger.error(`Error handling test FAILED ❌ - Expected an error but got success`);
      return false;
    }
  } catch (error) {
    logger.error(`Unexpected error in error handling test: ${error.message}`);
    return false;
  }
};

// Test rate limiting functionality
const testRateLimiting = async () => {
  logger.info('\n=== Testing Rate Limiting ===\n');
  
  try {
    const rateLimiter = getRateLimiter();
    const testUrl = TEST_URLS[0].url;
    
    logger.info(`Testing rate limiting with multiple requests to: ${testUrl}`);
    
    // Record start time
    const startTime = Date.now();
    
    // Make 5 consecutive requests through rate limiter
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(
        rateLimiter.schedule(
          async () => {
            logger.info(`Rate-limited request ${i+1} executing at ${Date.now() - startTime}ms`);
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true, requestNum: i+1 };
          },
          testUrl
        )
      );
    }
    
    // Wait for all requests to complete
    const completedResults = await Promise.all(results);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    logger.info(`All rate-limited requests completed in ${totalTime}ms`);
    logger.info(`Rate limiter test ${completedResults.length === 5 ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    // Check if the requests were indeed rate-limited (should take over 2 seconds minimum due to rate limiting)
    const wasRateLimited = totalTime > 2000;
    logger.info(`Rate limiting active: ${wasRateLimited ? 'YES ✅' : 'NO ❌'}`);
    
    return wasRateLimited;
  } catch (error) {
    logger.error(`Rate limiting test error: ${error.message}`);
    return false;
  }
};

// Test storage integration
const testStorageIntegration = async () => {
  logger.info('\n=== Testing Storage Integration ===\n');
  
  try {
    const testUrl = TEST_URLS[1].url;
    logger.info(`Testing full scraping with storage for: ${testUrl}`);
    
    // First scrape should save to storage
    const result = await scrapeCompanyWebsite(testUrl, {
      saveToStorage: true,
      companyId: 'test-company-id'
    });
    
    if (result.error) {
      logger.error(`First scrape failed: ${result.error.message}`);
      return false;
    }
    
    logger.info(`First scrape successful, duration: ${result.duration}ms`);
    
    // Retrieve from storage
    const storedContent = await getScrapedContent(testUrl);
    
    if (storedContent) {
      logger.info(`Content successfully retrieved from storage ✅`);
      logger.info(`Stored content title: "${storedContent.title}"`);
      logger.info(`Stored content status: ${storedContent.status}`);
      
      // Show storage stats
      const stats = await getStorageStats();
      logger.info(`Storage contains ${stats.totalDocuments} documents`);
      logger.info(`Storage status breakdown:`, stats.byStatus);
      
      return true;
    } else {
      logger.error(`Failed to retrieve content from storage ❌`);
      return false;
    }
  } catch (error) {
    logger.error(`Storage integration test error: ${error.message}`);
    return false;
  }
};

// Full end-to-end test
const testEndToEnd = async () => {
  logger.info('\n=== Running End-to-End Test ===\n');
  
  try {
    // Use Mozilla for a comprehensive test
    const testUrl = TEST_URLS[1].url;
    logger.info(`Running full end-to-end test on: ${testUrl}`);
    
    // First scrape - should extract and save content
    logger.info(`First scrape...`);
    const firstResult = await scrapeCompanyWebsite(testUrl, {
      saveToStorage: true,
      companyId: 'e2e-test'
    });
    
    if (firstResult.error) {
      logger.error(`First scrape failed: ${firstResult.error.message}`);
      return false;
    }
    
    logger.info(`First scrape successful in ${firstResult.duration}ms ✅`);
    logger.info(`Page title: "${firstResult.title}"`);
    logger.info(`Main content length: ${firstResult.mainContent.length} characters`);
    
    // Second scrape - should use cache
    logger.info(`Second scrape (should use cache)...`);
    const secondResult = await scrapeCompanyWebsite(testUrl, {
      saveToStorage: true,
      companyId: 'e2e-test'
    });
    
    if (secondResult.error) {
      logger.error(`Second scrape failed: ${secondResult.error.message}`);
      return false;
    }
    
    if (secondResult.fromCache) {
      logger.info(`Second scrape successfully used cache ✅`);
      logger.info(`Cache duration: ${secondResult.duration}ms`);
      
      // Calculate performance improvement
      const improvement = ((firstResult.duration - secondResult.duration) / firstResult.duration) * 100;
      logger.info(`Performance improvement: ${improvement.toFixed(2)}%`);
    } else {
      logger.warn(`Second scrape did not use cache as expected ⚠️`);
    }
    
    return true;
  } catch (error) {
    logger.error(`End-to-end test error: ${error.message}`);
    return false;
  }
};

// Run all tests
const runAllTests = async () => {
  logger.info('=== Starting Comprehensive Web Scraper Tests ===');
  
  // Connect to database
  const connected = await connectToDatabase();
  if (!connected) {
    logger.error('Tests aborted due to database connection failure');
    process.exit(1);
  }
  
  try {
    // Run tests in sequence
    const testResults = [
      { name: 'Basic Scraper', result: await testBasicScraper() },
      { name: 'Content Extraction', result: await testContentExtraction() },
      { name: 'Error Handling', result: await testErrorHandling() },
      { name: 'Rate Limiting', result: await testRateLimiting() },
      { name: 'Storage Integration', result: await testStorageIntegration() },
      { name: 'End-to-End Test', result: await testEndToEnd() }
    ];
    
    // Print test summary
    logger.info('\n=== Test Results Summary ===\n');
    
    for (const test of testResults) {
      logger.info(`${test.result ? '✅' : '❌'} ${test.name}: ${test.result ? 'PASSED' : 'FAILED'}`);
    }
    
    const passCount = testResults.filter(t => t.result).length;
    logger.info(`\n${passCount} of ${testResults.length} tests passed`);
    
    if (passCount === testResults.length) {
      logger.info('\n🎉 All tests passed! The web scraper implementation is working properly.\n');
    } else {
      logger.warn('\n⚠️ Some tests failed. Review the logs for details.\n');
    }
  } catch (error) {
    logger.error(`Test execution error: ${error.message}`);
  } finally {
    // Clean up
    await disconnectFromDatabase();
    logger.info('Tests completed.');
  }
};

// Add direct console.log at the start to verify script execution
console.log('==============================');
console.log('Starting Web Scraper Tests');
console.log('==============================');

// Quick test for console output
const quickTest = async () => {
  console.log('\n=== Running Quick Browser Test ===\n');
  try {
    console.log('Initializing browser...');
    const browser = await initBrowser();
    console.log('Creating page...');
    const page = await createPage(browser);
    console.log('Navigating to example.com...');
    await navigateToUrl(page, 'https://example.com');
    console.log('Getting page title...');
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    console.log('Closing browser...');
    await closeBrowser();
    console.log('Quick test completed successfully! ✅');
    return true;
  } catch (error) {
    console.error('Quick test failed with error:', error);
    return false;
  }
};

// Run quick test first to verify console output, then run all tests
quickTest().then(result => {
  console.log(`Quick test ${result ? 'PASSED' : 'FAILED'}`);
  console.log('Now running full test suite...');
  runAllTests();
}); 