/**
 * Rate Limiting Tests
 * Tests the rate limiting capabilities of the scraper service
 */

import { scrapeCompanyWebsite, navigateToUrl, initBrowser, createPage, closeBrowser } from '../services/scraperService.js';
import { RateLimiter, getRateLimiter } from '../utils/rateLimiter.js';
import { logger } from '../utils/logger.js';

// List of test URLs to use for rate limiting tests
const TEST_URLS = [
  'https://example.com',
  'https://www.iana.org',
  'https://www.w3.org',
  'https://www.mozilla.org',
  'https://www.wikipedia.org'
];

// Test the rate limiter directly
const testRateLimiterDirect = async () => {
  logger.info('\n=== Testing rate limiter directly ===\n');
  
  // Create a custom rate limiter instance for this test
  const rateLimiter = new RateLimiter({
    minDelay: 500,    // Short delay for testing
    maxDelay: 1000,
    maxConcurrent: 2,
    maxPerMinute: 10
  });
  
  // Create test functions that just record their execution time
  const createTestFn = (url, shouldSucceed = true) => {
    return async () => {
      const start = Date.now();
      const result = { url, executedAt: start };
      
      // Simulate a request that takes some time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Optionally simulate an error
      if (!shouldSucceed) {
        throw new Error('Simulated rate limit error');
      }
      
      result.duration = Date.now() - start;
      return result;
    };
  };
  
  // Schedule multiple requests and collect their promises
  logger.info('Scheduling 10 requests to test rate limiting...');
  
  const results = [];
  const startTime = Date.now();
  
  // Schedule multiple requests to the same domain to trigger rate limiting
  const promises = TEST_URLS.flatMap(url => [
    rateLimiter.schedule(createTestFn(url), url, 5),
    rateLimiter.schedule(createTestFn(url), url, 5)
  ]);
  
  // Wait for all requests to complete
  try {
    const requestResults = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    logger.info(`All requests completed in ${totalTime}ms`);
    
    // Analyze the results to verify rate limiting occurred
    const timeBetweenRequests = [];
    const requestTimes = requestResults.map(r => r.executedAt).sort((a, b) => a - b);
    
    for (let i = 1; i < requestTimes.length; i++) {
      timeBetweenRequests.push(requestTimes[i] - requestTimes[i-1]);
    }
    
    const avgTimeBetween = timeBetweenRequests.reduce((sum, t) => sum + t, 0) / timeBetweenRequests.length;
    
    // Check if rate limiting is working correctly
    if (avgTimeBetween >= 400) {
      logger.info(`✓ Rate limiting test passed: Average time between requests is ${avgTimeBetween.toFixed(2)}ms (expected > 400ms)`);
    } else {
      logger.error(`✗ Rate limiting test failed: Average time between requests is ${avgTimeBetween.toFixed(2)}ms (expected > 400ms)`);
    }
    
    // Log rate limiter stats
    logger.info('Rate limiter stats:', rateLimiter.getStats());
  } catch (error) {
    logger.error(`Rate limiter test failed with error: ${error.message}`, error);
  }
};

// Test rate limiting with actual scraper
const testRateLimitingWithScraper = async () => {
  logger.info('\n=== Testing rate limiting with actual scraper ===\n');
  
  // Reset the rate limiter singleton with test-appropriate values
  getRateLimiter({
    minDelay: 1000,
    maxDelay: 2000,
    maxConcurrent: 2,
    maxPerMinute: 10
  });
  
  const startTime = Date.now();
  
  try {
    // Attempt to scrape multiple pages in parallel
    // This should be automatically rate limited
    logger.info('Scraping multiple pages in parallel...');
    
    const scrapePromises = TEST_URLS.slice(0, 3).map(url => 
      scrapeCompanyWebsite(url, { timeout: 10000 })
    );
    
    const results = await Promise.all(scrapePromises);
    const totalTime = Date.now() - startTime;
    
    // Check timing to verify rate limiting
    logger.info(`All scrape operations completed in ${totalTime}ms`);
    
    // With 3 pages and a minimum delay of 1000ms, this should take at least 3000ms
    // but with parallelism of 2, it should be less than 4000ms
    if (totalTime >= 3000 && totalTime < 10000) {
      logger.info(`✓ Scraper rate limiting test passed: Total time ${totalTime}ms is reasonable for rate limited scraping`);
    } else if (totalTime < 3000) {
      logger.error(`✗ Scraper rate limiting test failed: Total time ${totalTime}ms is too short, rate limiting may not be working`);
    } else {
      logger.warn(`? Scraper rate limiting test suspicious: Total time ${totalTime}ms seems too long, may indicate issues`);
    }
    
    // Check that we got valid results
    const validResults = results.filter(r => r.title && !r.error);
    logger.info(`Successfully scraped ${validResults.length} of ${TEST_URLS.slice(0, 3).length} pages`);
    
    // Log rate limiter stats
    const stats = getRateLimiter().getStats();
    logger.info('Rate limiter stats after scraping:', stats);
  } catch (error) {
    logger.error(`Scraper rate limiting test failed with error: ${error.message}`, error);
  }
};

// Test domain-specific rate limiting
const testDomainSpecificRateLimiting = async () => {
  logger.info('\n=== Testing domain-specific rate limiting ===\n');
  
  // Create a fresh rate limiter
  const rateLimiter = new RateLimiter({
    minDelay: 500,
    maxDelay: 1000,
    maxConcurrent: 3,
    maxPerMinute: 20
  });
  
  // Set specific config for one domain
  rateLimiter.setDomainConfig('example.com', {
    minDelay: 2000,  // Much slower than default
    maxDelay: 3000
  });
  
  logger.info('Testing domain-specific rate limits...');
  
  const startTime = Date.now();
  
  try {
    // Schedule requests to different domains
    const normalUrl = 'https://www.iana.org';
    const slowUrl = 'https://example.com';
    
    const normalPromises = Array(3).fill().map(() => 
      rateLimiter.schedule(() => new Promise(r => setTimeout(() => r({ success: true }), 100)), normalUrl)
    );
    
    const slowPromises = Array(3).fill().map(() => 
      rateLimiter.schedule(() => new Promise(r => setTimeout(() => r({ success: true }), 100)), slowUrl)
    );
    
    // Wait for normal domain requests to complete
    const normalStart = Date.now();
    await Promise.all(normalPromises);
    const normalTime = Date.now() - normalStart;
    
    // Wait for slow domain requests to complete
    const slowStart = Date.now();
    await Promise.all(slowPromises);
    const slowTime = Date.now() - slowStart;
    
    // Verify the timing differences
    logger.info(`Normal domain requests took ${normalTime}ms`);
    logger.info(`Rate-limited domain requests took ${slowTime}ms`);
    
    if (slowTime > normalTime * 2) {
      logger.info(`✓ Domain-specific rate limiting test passed: Slow domain took significantly longer (${slowTime}ms vs ${normalTime}ms)`);
    } else {
      logger.error(`✗ Domain-specific rate limiting test failed: Slow domain didn't take significantly longer (${slowTime}ms vs ${normalTime}ms)`);
    }
  } catch (error) {
    logger.error(`Domain-specific rate limiting test failed with error: ${error.message}`, error);
  }
};

// Test rate limit detection and backoff
const testRateLimitDetection = async () => {
  logger.info('\n=== Testing rate limit detection and backoff ===\n');
  
  // Create a fresh rate limiter
  const rateLimiter = new RateLimiter({
    minDelay: 100,
    maxDelay: 200,
    maxConcurrent: 5,
    maxPerMinute: 30
  });
  
  // Create a test function that simulates rate limiting
  let requestCount = 0;
  const simulateRateLimitedRequest = async (url) => {
    requestCount++;
    
    // Simulate a rate limit error after 3 requests
    if (requestCount > 3) {
      const error = new Error('Too many requests');
      error.statusCode = 429;
      throw error;
    }
    
    return { success: true, count: requestCount };
  };
  
  try {
    logger.info('Testing rate limit detection...');
    
    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const result = await rateLimiter.schedule(() => simulateRateLimitedRequest('https://test-api.example.com'), 'https://test-api.example.com');
      logger.info(`Request ${i+1} succeeded`);
    }
    
    // Get the current delay configuration
    const initialConfig = rateLimiter.getDomainConfig('test-api.example.com');
    logger.info(`Initial delay config: ${JSON.stringify(initialConfig)}`);
    
    // The 4th request should trigger rate limit detection
    try {
      await rateLimiter.schedule(() => simulateRateLimitedRequest('https://test-api.example.com'), 'https://test-api.example.com');
      logger.error('✗ Rate limit detection test failed: 4th request should have triggered rate limiting');
    } catch (error) {
      // Get the new delay configuration
      const newConfig = rateLimiter.getDomainConfig('test-api.example.com');
      logger.info(`New delay config after rate limit: ${JSON.stringify(newConfig)}`);
      
      // Verify the delay was increased
      if (newConfig.minDelay > initialConfig.minDelay) {
        logger.info(`✓ Rate limit detection test passed: Delay increased from ${initialConfig.minDelay}ms to ${newConfig.minDelay}ms`);
      } else {
        logger.error(`✗ Rate limit detection test failed: Delay was not increased`);
      }
      
      const stats = rateLimiter.getStats();
      logger.info('Rate limiter stats after detection:', stats);
      
      if (stats.throttledRequests > 0) {
        logger.info(`✓ Rate limit tracking test passed: Counted ${stats.throttledRequests} throttled requests`);
      } else {
        logger.error(`✗ Rate limit tracking test failed: No throttled requests counted`);
      }
    }
  } catch (error) {
    logger.error(`Rate limit detection test failed with error: ${error.message}`, error);
  }
};

// Self-executing async function to run tests
(async () => {
  logger.info('Running rate limiting tests...');
  
  try {
    // Test the rate limiter directly
    await testRateLimiterDirect();
    
    // Test with the actual scraper
    await testRateLimitingWithScraper();
    
    // Test domain-specific rate limiting
    await testDomainSpecificRateLimiting();
    
    // Test rate limit detection and backoff
    await testRateLimitDetection();
    
    logger.info('\nAll rate limiting tests completed');
  } catch (error) {
    logger.error(`Rate limiting tests failed with unexpected error: ${error.message}`, error);
  }
})(); 