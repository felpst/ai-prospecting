/**
 * Content Extraction Tests
 * Tests the content extraction capabilities of the scraper service
 */

import {
  scrapeCompanyWebsite,
  extractMainContent,
  extractAboutInfo,
  extractProductInfo,
  extractTeamInfo,
  extractContactInfo,
  cleanText,
  initBrowser,
  createPage,
  navigateToUrl,
  closeBrowser
} from '../services/scraperService.js';
import { logger } from '../utils/logger.js';

// Define test websites
const TEST_WEBSITES = [
  'https://example.com',                  // Simple site for basic testing
  'https://www.mozilla.org',              // Real company website with about, product pages
  'https://opensource.org',               // Organization with team info
  'https://www.wikipedia.org'             // Complex site with various content
];

/**
 * Tests the text cleaning function
 */
const testTextCleaning = () => {
  logger.info('Testing text cleaning function');
  
  // Test cases for text cleaning
  const testCases = [
    { 
      input: '  This   is  a   test   ', 
      expected: 'This is a test',
      name: 'Multiple spaces'
    },
    { 
      input: 'Line 1\n\n\nLine 2\n\nLine 3', 
      expected: 'Line 1\n\nLine 2\n\nLine 3',
      name: 'Multiple newlines'
    },
    { 
      input: 'Test with &nbsp; HTML &amp; entities &lt;tag&gt;', 
      expected: 'Test with   HTML & entities <tag>',
      name: 'HTML entities'
    },
    { 
      input: 'Text with &quot;quotes&quot; and &#39;apostrophes&#39;', 
      expected: 'Text with "quotes" and \'apostrophes\'',
      name: 'Quote entities'
    }
  ];
  
  // Run all test cases
  for (const test of testCases) {
    const result = cleanText(test.input);
    const passed = result === test.expected;
    
    if (passed) {
      logger.info(`✓ ${test.name} test passed`);
    } else {
      logger.error(`✗ ${test.name} test failed`);
      logger.error(`  Expected: "${test.expected}"`);
      logger.error(`  Received: "${result}"`);
    }
  }
};

/**
 * Tests extraction of main content
 */
const testMainContentExtraction = async (page, url) => {
  logger.info(`Testing main content extraction for ${url}`);
  
  try {
    // Navigate to the URL
    await navigateToUrl(page, url);
    
    // Extract main content
    const content = await extractMainContent(page);
    
    // Verify content was extracted
    if (content && content.length > 100) {
      logger.info(`✓ Successfully extracted main content (${content.length} chars) from ${url}`);
      return true;
    } else {
      logger.warn(`✗ Failed to extract meaningful main content from ${url}`);
      return false;
    }
  } catch (error) {
    logger.error(`✗ Error extracting main content from ${url}: ${error.message}`);
    return false;
  }
};

/**
 * Tests extraction of about information
 */
const testAboutInfoExtraction = async (page, url) => {
  logger.info(`Testing about info extraction for ${url}`);
  
  try {
    // Navigate to the URL
    await navigateToUrl(page, url);
    
    // Extract about info
    const aboutInfo = await extractAboutInfo(page);
    
    // Verify content was extracted
    if (aboutInfo && aboutInfo.length > 50) {
      logger.info(`✓ Successfully extracted about info (${aboutInfo.length} chars) from ${url}`);
      // Log a preview of the content
      logger.info(`Preview: ${aboutInfo.substring(0, 100)}...`);
      return true;
    } else {
      logger.warn(`✗ Failed to extract meaningful about info from ${url}`);
      return false;
    }
  } catch (error) {
    logger.error(`✗ Error extracting about info from ${url}: ${error.message}`);
    return false;
  }
};

/**
 * Tests extraction of product information
 */
const testProductInfoExtraction = async (page, url) => {
  logger.info(`Testing product info extraction for ${url}`);
  
  try {
    // Navigate to the URL
    await navigateToUrl(page, url);
    
    // Extract product info
    const productInfo = await extractProductInfo(page);
    
    // Verify content was extracted
    if (productInfo && productInfo.length > 50) {
      logger.info(`✓ Successfully extracted product info (${productInfo.length} chars) from ${url}`);
      // Log a preview of the content
      logger.info(`Preview: ${productInfo.substring(0, 100)}...`);
      return true;
    } else {
      logger.warn(`✗ Failed to extract meaningful product info from ${url}`);
      return false;
    }
  } catch (error) {
    logger.error(`✗ Error extracting product info from ${url}: ${error.message}`);
    return false;
  }
};

/**
 * Tests extraction of team information
 */
const testTeamInfoExtraction = async (page, url) => {
  logger.info(`Testing team info extraction for ${url}`);
  
  try {
    // Navigate to the URL
    await navigateToUrl(page, url);
    
    // Extract team info
    const teamInfo = await extractTeamInfo(page);
    
    // Verify content was extracted
    if (teamInfo && teamInfo.length > 50) {
      logger.info(`✓ Successfully extracted team info (${teamInfo.length} chars) from ${url}`);
      // Log a preview of the content
      logger.info(`Preview: ${teamInfo.substring(0, 100)}...`);
      return true;
    } else {
      logger.warn(`✗ Failed to extract meaningful team info from ${url}`);
      return false;
    }
  } catch (error) {
    logger.error(`✗ Error extracting team info from ${url}: ${error.message}`);
    return false;
  }
};

/**
 * Tests extraction of contact information
 */
const testContactInfoExtraction = async (page, url) => {
  logger.info(`Testing contact info extraction for ${url}`);
  
  try {
    // Navigate to the URL
    await navigateToUrl(page, url);
    
    // Extract contact info
    const contactInfo = await extractContactInfo(page);
    
    // Verify content was extracted
    if (contactInfo && contactInfo.length > 0) {
      logger.info(`✓ Successfully extracted contact info (${contactInfo.length} chars) from ${url}`);
      // Log a preview of the content
      logger.info(`Preview: ${contactInfo.substring(0, 100)}...`);
      return true;
    } else {
      logger.warn(`✗ Failed to extract meaningful contact info from ${url}`);
      return false;
    }
  } catch (error) {
    logger.error(`✗ Error extracting contact info from ${url}: ${error.message}`);
    return false;
  }
};

/**
 * Tests full company website scraping
 */
const testFullScraping = async (url) => {
  logger.info(`Testing full website scraping for ${url}`);
  
  try {
    // Scrape the entire website
    const result = await scrapeCompanyWebsite(url);
    
    // Check if we got data
    if (result && result.url === url && !result.error) {
      // Count how many data points we successfully extracted
      const successCount = [
        result.mainContent,
        result.aboutInfo,
        result.productInfo,
        result.teamInfo,
        result.contactInfo
      ].filter(item => item && item.length > 50).length;
      
      logger.info(`✓ Successfully scraped website: ${url}`);
      logger.info(`  Title: ${result.title}`);
      logger.info(`  Description: ${result.description ? result.description.substring(0, 100) + '...' : 'None'}`);
      logger.info(`  Successfully extracted ${successCount}/5 content sections`);
      
      return true;
    } else {
      logger.warn(`✗ Failed to fully scrape website: ${url}`);
      if (result.error) {
        logger.warn(`  Error: ${result.error}`);
      }
      return false;
    }
  } catch (error) {
    logger.error(`✗ Error during full website scrape of ${url}: ${error.message}`);
    return false;
  }
};

// Self-executing async function to run tests
(async () => {
  logger.info('Running content extraction tests...');
  
  try {
    // Test text cleaning
    testTextCleaning();
    
    let browser;
    try {
      // Initialize browser for page-level tests
      browser = await initBrowser();
      const page = await createPage(browser);
      
      // Test extraction functions on each test website
      for (const website of TEST_WEBSITES) {
        logger.info(`\n=== Testing extraction on ${website} ===\n`);
        
        await testMainContentExtraction(page, website);
        await testAboutInfoExtraction(page, website);
        await testProductInfoExtraction(page, website);
        await testTeamInfoExtraction(page, website);
        await testContactInfoExtraction(page, website);
      }
    } finally {
      // Ensure browser is closed
      if (browser) await closeBrowser();
    }
    
    // Test full scraping function
    logger.info('\n=== Testing full website scraping ===\n');
    
    for (const website of TEST_WEBSITES) {
      await testFullScraping(website);
    }
    
    logger.info('\nAll content extraction tests completed');
  } catch (error) {
    logger.error(`Content extraction tests failed: ${error.message}`);
  }
})(); 