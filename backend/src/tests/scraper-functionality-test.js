/**
 * Scraper Functionality Test
 * Tests key functions from our scraperService.js
 */

import { 
  initBrowser, 
  createPage, 
  navigateToUrl,
  closeBrowser,
  extractMainContent,
  scrapeCompanyWebsite,
  testScraper
} from '../services/scraperService.js';

console.log('===============================');
console.log('SCRAPER FUNCTIONALITY TEST');
console.log('===============================');

const testScraperFunctionality = async () => {
  console.log('Testing core scraper functionality...');
  
  try {
    // Test 1: Basic scraper test
    console.log('\n--- Test 1: Basic scraper test ---');
    const basicResult = await testScraper('https://example.com');
    
    if (basicResult.success) {
      console.log(`✅ Basic test passed: Successfully loaded "${basicResult.title}" from ${basicResult.url}`);
    } else {
      console.error(`❌ Basic test failed: ${basicResult.error?.message || 'Unknown error'}`);
      return false;
    }
    
    // Test 2: Manual navigation and content extraction
    console.log('\n--- Test 2: Manual navigation and content extraction ---');
    console.log('Initializing browser...');
    const browser = await initBrowser();
    console.log('Creating page...');
    const page = await createPage(browser);
    
    console.log('Navigating to example.com...');
    await navigateToUrl(page, 'https://example.com');
    console.log('Extracting main content...');
    const content = await extractMainContent(page);
    
    if (content && content.length > 0) {
      console.log(`✅ Content extraction passed: Extracted ${content.length} characters`);
      console.log('Content preview: ' + content.substring(0, 100) + '...');
    } else {
      console.error('❌ Content extraction failed: No content extracted');
    }
    
    console.log('Closing browser...');
    await closeBrowser();
    
    // Test 3: Full website scraping
    console.log('\n--- Test 3: Full website scraping ---');
    console.log('Scraping mozilla.org...');
    const scrapeResult = await scrapeCompanyWebsite('https://www.mozilla.org');
    
    if (scrapeResult.error) {
      console.error(`❌ Website scraping failed: ${scrapeResult.error.message}`);
      return false;
    }
    
    console.log(`✅ Website scraping passed: Scraped ${scrapeResult.url} in ${scrapeResult.duration}ms`);
    console.log(`Title: ${scrapeResult.title}`);
    console.log(`Main content length: ${scrapeResult.mainContent.length} characters`);
    console.log(`About info length: ${scrapeResult.aboutInfo.length} characters`);
    console.log(`Product info length: ${scrapeResult.productInfo.length} characters`);
    console.log(`Team info length: ${scrapeResult.teamInfo.length} characters`);
    console.log(`Contact info length: ${scrapeResult.contactInfo.length} characters`);
    
    return true;
  } catch (error) {
    console.error('Test execution failed with error:');
    console.error(error);
    return false;
  }
};

// Run the tests
testScraperFunctionality()
  .then(success => {
    console.log('\n===============================');
    console.log(`SCRAPER FUNCTIONALITY TEST ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('===============================');
  })
  .catch(error => {
    console.error('\nUnexpected error in test execution:');
    console.error(error);
    console.log('===============================');
    console.log('SCRAPER FUNCTIONALITY TEST FAILED ❌');
    console.log('===============================');
  }); 