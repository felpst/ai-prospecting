/**
 * Quick Scraper Test
 * A faster test for our scraper with shorter timeouts
 */

import { chromium } from 'playwright';
import { cleanText } from '../services/scraperService.js';

console.log('===============================');
console.log('QUICK SCRAPER TEST');
console.log('===============================');

const runQuickTest = async () => {
  console.log('Starting quick test...');
  let browser = null;
  
  try {
    // Use shorter timeout
    const timeout = 10000; // 10 seconds
    
    console.log('Initializing browser...');
    browser = await chromium.launch({
      headless: true
    });
    
    console.log('Creating context...');
    const context = await browser.newContext();
    
    console.log('Creating page...');
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    
    console.log('Navigating to example.com...');
    const startTime = Date.now();
    await page.goto('https://example.com', { 
      waitUntil: 'domcontentloaded',
      timeout
    });
    const loadTime = Date.now() - startTime;
    console.log(`Page loaded in ${loadTime}ms`);
    
    console.log('Getting page title...');
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    
    console.log('Extracting content...');
    const content = await page.evaluate(() => document.body.innerText);
    const cleanContent = cleanText(content);
    
    console.log(`Extracted ${cleanContent.length} characters of content`);
    console.log('Content preview:');
    console.log('-----------------');
    console.log(cleanContent.substring(0, 200) + '...');
    console.log('-----------------');
    
    return true;
  } catch (error) {
    console.error('Test failed with error:');
    console.error(error);
    return false;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed');
    }
  }
};

// Run the test
runQuickTest()
  .then(success => {
    console.log('\n===============================');
    console.log(`QUICK SCRAPER TEST ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('===============================');
    // Force exit to avoid hanging
    process.exit(0);
  })
  .catch(error => {
    console.error('\nUnexpected error:');
    console.error(error);
    console.log('===============================');
    console.log('QUICK SCRAPER TEST FAILED ❌');
    console.log('===============================');
    // Force exit with error code
    process.exit(1);
  }); 