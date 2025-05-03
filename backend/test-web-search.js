/**
 * Test Script for Web Search Service
 * 
 * This script tests the Web Search Service implementation for retrieving 
 * real-time company information from the web.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as webSearchService from './src/services/webSearchService.js';
import { logger } from './src/utils/logger.js';

// Load .env from project root
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '..', '.env') });
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Set a timeout to allow for async operations
const timeout = setTimeout(() => {
  console.error('Test timed out after 30 seconds');
  process.exit(1);
}, 30000);

// Test the basic web search functionality
async function testWebSearch() {
  console.log('Testing Web Search Service...');
  
  try {
    // Test with structured parameters
    const searchParams = {
      industry: 'AI',
      locality: 'Silicon Valley'
    };
    
    console.log(`Search parameters: ${JSON.stringify(searchParams)}`);
    
    const result = await webSearchService.searchWeb(searchParams);
    console.log('Search results:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log(`\nFound ${result.companies.length} companies`);
    console.log('\nTest completed successfully ✅');
    return true;
  } catch (error) {
    console.error('Error during web search test:', error.message);
    if (error.message.includes('OpenAI service is not configured')) {
      console.error('\nMake sure OPENAI_API_KEY is set in your .env file');
    }
    return false;
  }
}

// Test the aggregated search functionality
async function testAggregateSearch() {
  console.log('\nTesting Aggregate Search Functionality...');
  
  try {
    // Test with simple parameters for aggregation
    const searchParams = {
      industry: 'Fintech',
      region: 'Europe'
    };
    
    console.log(`Search parameters: ${JSON.stringify(searchParams)}`);
    
    const result = await webSearchService.aggregateSearchResults(searchParams, 10);
    console.log('Aggregated search results:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log(`\nFound ${result.companies.length} companies in aggregate search`);
    console.log('\nTest completed successfully ✅');
    return true;
  } catch (error) {
    console.error('Error during aggregate search test:', error.message);
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('Starting Web Search Service Tests\n');
  console.log('OPENAI_API_KEY is ' + (process.env.OPENAI_API_KEY ? 'set ✅' : 'not set ❌'));
  
  const webSearchSuccess = await testWebSearch();
  const aggregateSearchSuccess = await testAggregateSearch();
  
  console.log('\n--- Test Summary ---');
  console.log(`Web Search: ${webSearchSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Aggregate Search: ${aggregateSearchSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  clearTimeout(timeout);
  process.exit(webSearchSuccess && aggregateSearchSuccess ? 0 : 1);
}

runTests().catch(err => {
  console.error('Unexpected error in test runner:', err);
  clearTimeout(timeout);
  process.exit(1);
}); 