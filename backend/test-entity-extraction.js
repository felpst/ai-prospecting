/**
 * Test Script for Entity Extractor Service
 * 
 * This script tests the Entity Extractor Service implementation for extracting
 * structured company entities from web search results.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as webSearchService from './src/services/webSearchService.js';
import * as entityExtractorService from './src/services/entityExtractorService.js';
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
  console.error('Test timed out after 60 seconds');
  process.exit(1);
}, 60000);

// Test the full entity extraction flow
async function testEntityExtraction() {
  console.log('Testing Entity Extractor Service...');
  
  try {
    // First, get some web search results using the web search service
    const searchParams = {
      industry: 'AI',
      region: 'California'
    };
    
    console.log(`Search parameters: ${JSON.stringify(searchParams)}`);
    
    // Step 1: Get web search results
    console.log('\nStep 1: Retrieving web search results...');
    const searchResults = await webSearchService.searchWeb(searchParams);
    console.log(`Retrieved ${searchResults.companies.length} companies from web search.`);
    
    // Step 2: Extract structured entities from search results
    console.log('\nStep 2: Extracting structured entities...');
    const extractedEntities = await entityExtractorService.extractCompanies(searchResults);
    console.log(`Extracted ${extractedEntities.companies.length} structured company entities.`);
    
    // Print sample of the extracted entities
    console.log('\nSample of extracted entities:');
    const sampleCount = Math.min(3, extractedEntities.companies.length);
    for (let i = 0; i < sampleCount; i++) {
      console.log(`\nEntity ${i + 1}:`);
      console.log(JSON.stringify(extractedEntities.companies[i], null, 2));
    }
    
    console.log('\nExtraction metadata:');
    console.log(JSON.stringify(extractedEntities.meta, null, 2));
    
    console.log('\nEntity extraction test completed successfully ✅');
    return true;
  } catch (error) {
    console.error('Error during entity extraction test:', error.message);
    if (error.message.includes('OpenAI service is not configured')) {
      console.error('\nMake sure OPENAI_API_KEY is set in your .env file');
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('Starting Entity Extractor Service Tests\n');
  console.log('OPENAI_API_KEY is ' + (process.env.OPENAI_API_KEY ? 'set ✅' : 'not set ❌'));
  
  const entityExtractionSuccess = await testEntityExtraction();
  
  console.log('\n--- Test Summary ---');
  console.log(`Entity Extraction: ${entityExtractionSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  clearTimeout(timeout);
  process.exit(entityExtractionSuccess ? 0 : 1);
}

runTests().catch(err => {
  console.error('Unexpected error in test runner:', err);
  clearTimeout(timeout);
  process.exit(1);
}); 