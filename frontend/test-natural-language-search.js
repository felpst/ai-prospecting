/**
 * Test Script for Natural Language Search Frontend Integration
 * 
 * This script tests the frontend integration with the unified natural language search API.
 */

const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('🧪 Starting Natural Language Search Frontend Test\n');
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log('📊 Browser launched successfully');
    
    // Go to homepage
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    console.log('🌐 Navigated to homepage');
    
    // Wait for search input to be available
    await page.waitForSelector('.search-input', { timeout: 5000 });
    console.log('✅ Search input found');
    
    // Test natural language queries
    const queries = [
      'Best companies that offer a CRM',
      'AI startups in New York',
      'Fastest growing VR companies in California'
    ];
    
    for (const query of queries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      
      // Clear previous search if any
      await page.click('.search-input');
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      
      // Type the query
      await page.type('.search-input', query);
      console.log('📝 Entered search query');
      
      // Submit the search
      await page.click('.search-button');
      console.log('🚀 Submitted search');
      
      // Wait for results to load
      try {
        await page.waitForSelector('.search-metadata, .results-error', { timeout: 10000 });
        console.log('📦 Search results or metadata loaded');
        
        // Check if we got search metadata (indicates natural language search was used)
        const hasMetadata = await page.evaluate(() => {
          return !!document.querySelector('.search-metadata');
        });
        
        if (hasMetadata) {
          console.log('✅ Natural language search metadata displayed');
          
          // Check for search sources
          const sources = await page.evaluate(() => {
            const sourceElement = document.querySelector('.search-sources');
            return sourceElement ? sourceElement.textContent : null;
          });
          
          if (sources) {
            console.log(`📊 Search sources: ${sources.trim()}`);
          }
          
          // Check for parsed query
          const parsedQuery = await page.evaluate(() => {
            const queryElement = document.querySelector('.parsed-query');
            return queryElement ? queryElement.textContent : null;
          });
          
          if (parsedQuery) {
            console.log(`🔄 Parsed query: ${parsedQuery.trim()}`);
          }
        } else {
          console.log('❌ Natural language search metadata not found');
        }
        
        // Check for companies in results
        const companyCount = await page.evaluate(() => {
          const companyElements = document.querySelectorAll('.company-card');
          return companyElements.length;
        });
        
        console.log(`🏢 Found ${companyCount} companies in results`);
        
      } catch (error) {
        console.error(`❌ Error waiting for search results: ${error.message}`);
      }
    }
    
    console.log('\n🏁 Tests completed');
    await browser.close();
    console.log('🔒 Browser closed');
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
})(); 