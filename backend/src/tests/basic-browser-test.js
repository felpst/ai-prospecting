/**
 * Basic Browser Test
 * Just tests if Playwright can initialize and navigate to a page
 */

import { chromium } from 'playwright';

console.log('===============================');
console.log('BASIC BROWSER TEST STARTING');
console.log('===============================');

const basicTest = async () => {
  console.log('Starting browser test...');
  let browser = null;
  
  try {
    console.log('Initializing browser...');
    browser = await chromium.launch({
      headless: false // Run in non-headless mode to see the browser
    });
    
    console.log('Browser initialized successfully ✅');
    console.log('Creating browser context...');
    const context = await browser.newContext();
    
    console.log('Creating page...');
    const page = await context.newPage();
    
    console.log('Navigating to example.com...');
    await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded'
    });
    
    console.log('Page loaded successfully');
    const title = await page.title();
    console.log(`Page title: "${title}" ✅`);
    
    // Take a screenshot to verify
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'logs/example-screenshot.png' });
    console.log('Screenshot saved to logs/example-screenshot.png');
    
    return true;
  } catch (error) {
    console.error('Browser test failed:');
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

// Run the test and print result
basicTest()
  .then(success => {
    console.log('===============================');
    console.log(`BASIC BROWSER TEST ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('===============================');
  })
  .catch(error => {
    console.error('Unexpected error in test execution:');
    console.error(error);
    console.log('===============================');
    console.log('BASIC BROWSER TEST FAILED ❌');
    console.log('===============================');
  }); 