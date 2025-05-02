/**
 * Scraper Service Tests
 * Tests basic functionality of the scraper service
 */

import { testScraper, initBrowser, createPage, navigateToUrl, closeBrowser } from '../services/scraperService.js';
import { logger } from '../utils/logger.js';

// Self-executing async function to run tests
(async () => {
  logger.info('Running scraper service tests...');
  
  try {
    // Test 1: Basic scraper test function
    logger.info('Test 1: Basic scraper test function');
    const testResult = await testScraper();
    
    if (testResult.success) {
      logger.info(`✓ Test passed: Loaded "${testResult.title}" from ${testResult.url}`);
    } else {
      logger.error(`✗ Test failed: ${testResult.error}`);
    }
    
    // Test 2: Manual browser and page creation
    logger.info('Test 2: Manual browser and page creation');
    const browser = await initBrowser();
    const page = await createPage(browser);
    
    try {
      await navigateToUrl(page, 'https://example.org');
      const title = await page.title();
      logger.info(`✓ Manual navigation test passed: Loaded "${title}"`);
    } catch (error) {
      logger.error(`✗ Manual navigation test failed: ${error.message}`);
    } finally {
      await closeBrowser();
    }
    
    // Test 3: Test headless/headful configuration
    logger.info('Test 3: Testing browser configuration options');
    const configuredBrowser = await initBrowser({ headless: false });
    const configuredPage = await createPage(configuredBrowser, {
      viewport: { width: 1024, height: 768 },
      userAgent: 'Test User Agent'
    });
    
    try {
      await navigateToUrl(configuredPage, 'https://example.com', { 
        waitUntil: 'networkidle' 
      });
      const title = await configuredPage.title();
      logger.info(`✓ Configuration test passed: Loaded "${title}" with custom settings`);
    } catch (error) {
      logger.error(`✗ Configuration test failed: ${error.message}`);
    } finally {
      await closeBrowser();
    }
    
    // Test 4: Error handling for invalid URL
    logger.info('Test 4: Testing error handling for invalid URL');
    const errorBrowser = await initBrowser();
    const errorPage = await createPage(errorBrowser);
    
    try {
      await navigateToUrl(errorPage, 'https://this-site-does-not-exist-123456789.com');
      logger.error('✗ Error handling test failed: Should have thrown an error');
    } catch (error) {
      logger.info(`✓ Error handling test passed: Correctly caught error: ${error.message}`);
    } finally {
      await closeBrowser();
    }
    
    logger.info('All scraper tests completed');
  } catch (error) {
    logger.error(`Test suite failed: ${error.message}`);
  }
})(); 