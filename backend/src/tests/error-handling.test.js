/**
 * Error Handling Tests
 * Tests the error handling capabilities of the scraper service
 */

import {
  scrapeCompanyWebsite,
  navigateToUrl,
  initBrowser,
  createPage,
  closeBrowser,
  testScraper
} from '../services/scraperService.js';

import {
  withRetry,
  CircuitBreaker,
  ScraperError,
  NavigationError,
  NetworkError,
  AccessDeniedError,
  BrowserError,
  TimeoutError
} from '../utils/scraperErrors.js';

import { logger } from '../utils/logger.js';

// Define test cases that should trigger different types of errors
const ERROR_TEST_CASES = [
  { 
    name: 'Non-existent domain',
    url: 'https://this-domain-does-not-exist-at-all-12345.com',
    expectedError: 'NavigationError',
    description: 'Should handle non-existent domains gracefully'
  },
  { 
    name: 'Invalid URL',
    url: 'not-a-valid-url',
    expectedError: 'NavigationError',
    description: 'Should reject invalid URLs'
  },
  { 
    name: 'Non-existent page',
    url: 'https://example.com/non-existent-page-12345',
    expectedError: 'NetworkError',
    description: 'Should handle 404 errors'
  }
];

/**
 * Test the retry mechanism
 */
const testRetryLogic = async () => {
  logger.info('\n=== Testing retry logic ===\n');
  
  let attempts = 0;
  
  // Create a function that fails the first two times and succeeds the third
  const flakeyFunction = async () => {
    attempts++;
    logger.info(`Attempt #${attempts}`);
    
    if (attempts < 3) {
      logger.info('Flakey function failing on purpose');
      throw new NetworkError('Simulated network error', 'https://example.com', 500);
    }
    
    logger.info('Flakey function succeeding');
    return 'Success!';
  };
  
  try {
    // Test the retry logic
    const result = await withRetry(flakeyFunction, {
      maxRetries: 3,
      initialDelay: 100, // Small delay for test
      onRetry: ({ retryCount }) => {
        logger.info(`Retry callback called for attempt ${retryCount}`);
      }
    });
    
    if (result === 'Success!' && attempts === 3) {
      logger.info('✓ Retry logic test passed: Function succeeded after retries');
    } else {
      logger.error(`✗ Retry logic test failed: Unexpected result or attempts count`);
    }
  } catch (error) {
    logger.error(`✗ Retry logic test failed: Should have succeeded after retries but got error: ${error.message}`);
  }
  
  // Reset attempts
  attempts = 0;
  
  // Test exceeding max retries
  try {
    await withRetry(flakeyFunction, {
      maxRetries: 1, // Only allow 1 retry
      initialDelay: 100
    });
    
    logger.error('✗ Max retry test failed: Should have thrown an error');
  } catch (error) {
    if (error instanceof NetworkError && attempts === 2) {
      logger.info('✓ Max retry test passed: Function correctly stopped after max retries');
    } else {
      logger.error(`✗ Max retry test failed: Unexpected error or attempts count`);
    }
  }
};

/**
 * Test the circuit breaker
 */
const testCircuitBreaker = async () => {
  logger.info('\n=== Testing circuit breaker ===\n');
  
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeout: 500, // Small timeout for test
    onOpen: () => logger.info('Circuit breaker opened'),
    onClose: () => logger.info('Circuit breaker closed'),
    onHalfOpen: () => logger.info('Circuit breaker half-opened')
  });
  
  let attempts = 0;
  
  // Create a function that always fails
  const failingFunction = async () => {
    attempts++;
    logger.info(`Failing function called, attempt #${attempts}`);
    throw new NetworkError('Simulated network error', 'https://example.com', 500);
  };
  
  // Test that circuit opens after threshold
  for (let i = 0; i < 3; i++) {
    try {
      await circuitBreaker.execute(failingFunction);
      logger.error('✗ Circuit breaker test failed: Should have thrown an error');
    } catch (error) {
      // First two calls should be NetworkError, the third should be ScraperError (circuit open)
      if (i < 2 && error instanceof NetworkError) {
        logger.info(`✓ Circuit breaker test ${i+1}: Function failed with expected error`);
      } else if (i >= 2 && error instanceof ScraperError && error.message.includes('Circuit breaker is OPEN')) {
        logger.info(`✓ Circuit breaker test ${i+1}: Circuit opened correctly after threshold`);
      } else {
        logger.error(`✗ Circuit breaker test ${i+1} failed: Unexpected error: ${error.message}`);
      }
    }
  }
  
  // Test circuit half-open state
  logger.info('Waiting for circuit to transition to half-open...');
  await new Promise(resolve => setTimeout(resolve, 600)); // Wait for reset timeout
  
  // This should allow one attempt (half-open state)
  try {
    await circuitBreaker.execute(failingFunction);
    logger.error('✗ Circuit half-open test failed: Should have thrown an error');
  } catch (error) {
    if (error instanceof NetworkError) {
      logger.info('✓ Circuit half-open test passed: Circuit allowed attempt in half-open state');
    } else {
      logger.error(`✗ Circuit half-open test failed: Unexpected error: ${error.message}`);
    }
  }
  
  // Test that circuit is open again after half-open failure
  try {
    await circuitBreaker.execute(failingFunction);
    logger.error('✗ Circuit reopen test failed: Should have thrown an error');
  } catch (error) {
    if (error instanceof ScraperError && error.message.includes('Circuit breaker is OPEN')) {
      logger.info('✓ Circuit reopen test passed: Circuit reopened after half-open failure');
    } else {
      logger.error(`✗ Circuit reopen test failed: Unexpected error: ${error.message}`);
    }
  }
  
  // Test resetting the circuit breaker
  circuitBreaker.reset();
  
  try {
    await circuitBreaker.execute(failingFunction);
    logger.error('✗ Circuit reset test failed: Should have thrown an error');
  } catch (error) {
    if (error instanceof NetworkError) {
      logger.info('✓ Circuit reset test passed: Circuit was successfully reset');
    } else {
      logger.error(`✗ Circuit reset test failed: Unexpected error: ${error.message}`);
    }
  }
};

/**
 * Test error handling for various navigation scenarios
 */
const testNavigationErrors = async () => {
  logger.info('\n=== Testing navigation error handling ===\n');
  
  let browser;
  
  try {
    browser = await initBrowser();
    const page = await createPage(browser);
    
    // Test each error case
    for (const testCase of ERROR_TEST_CASES) {
      logger.info(`\nTesting: ${testCase.name} - ${testCase.description}`);
      
      try {
        await navigateToUrl(page, testCase.url, { maxRetries: 0 }); // Disable retries for cleaner testing
        logger.error(`✗ ${testCase.name} test failed: Should have thrown an error`);
      } catch (error) {
        if (error.name === testCase.expectedError) {
          logger.info(`✓ ${testCase.name} test passed: Correct error type thrown (${error.name})`);
          logger.info(`  Error message: ${error.message}`);
        } else {
          logger.error(`✗ ${testCase.name} test failed: Expected ${testCase.expectedError} but got ${error.name}`);
          logger.error(`  Error message: ${error.message}`);
        }
      }
    }
  } finally {
    if (browser) {
      await closeBrowser().catch(err => logger.error('Error closing browser:', err));
    }
  }
};

/**
 * Test scraping error recovery and graceful degradation
 */
const testScrapingErrorRecovery = async () => {
  logger.info('\n=== Testing scraping error recovery ===\n');
  
  // Test scraping from a valid site but with potential extraction issues
  const result = await scrapeCompanyWebsite('https://example.com', {
    // Use shorter timeout to test timeout handling
    timeout: 5000,
    useRetries: true,
    maxRetries: 1,
    captureScreenshot: true
  });
  
  if (result && result.url === 'https://example.com') {
    logger.info('✓ Scraper recovery test passed: Got results with graceful degradation');
    logger.info(`  Title: ${result.title}`);
    
    // Count successful extractions
    const extractedFields = [
      result.mainContent, 
      result.aboutInfo,
      result.productInfo,
      result.teamInfo,
      result.contactInfo
    ].filter(content => content && content.length > 0).length;
    
    logger.info(`  Successfully extracted ${extractedFields}/5 content sections`);
    
    // Even if extraction failed for some parts, we should have partial results
    if (result.partial) {
      logger.info('  Note: Results are partial due to some extraction failures');
    }
  } else {
    logger.error('✗ Scraper recovery test failed: Did not get graceful degradation');
    logger.error('  Result:', result);
  }
  
  // Test complete failure recovery
  // Use a non-existent domain that will definitely fail
  const errorResult = await scrapeCompanyWebsite('https://this-domain-definitely-does-not-exist-12345.com', {
    useRetries: true,
    maxRetries: 1
  });
  
  if (errorResult && errorResult.error) {
    logger.info('✓ Complete failure test passed: Got proper error information');
    logger.info(`  Error type: ${errorResult.error.type}`);
    logger.info(`  Error message: ${errorResult.error.message}`);
  } else {
    logger.error('✗ Complete failure test failed: Did not get proper error information');
  }
};

// Self-executing async function to run tests
(async () => {
  logger.info('Running error handling tests...');
  
  try {
    // Test retry logic
    await testRetryLogic();
    
    // Test circuit breaker
    await testCircuitBreaker();
    
    // Test navigation errors
    await testNavigationErrors();
    
    // Test scraping error recovery
    await testScrapingErrorRecovery();
    
    logger.info('\nAll error handling tests completed');
  } catch (error) {
    logger.error(`Error handling tests failed with unexpected error: ${error.message}`, error);
  }
})(); 