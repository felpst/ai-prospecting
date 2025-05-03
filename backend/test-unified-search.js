/**
 * Test Script for Unified Natural Language Search API
 * 
 * This script tests the Unified Natural Language Search API implementation
 * which combines database search, web search, entity extraction, and company matching
 * with intelligent fallback mechanisms and optimizations.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import * as nlpService from './src/services/naturalLanguageQueryParser.js';
import * as searchService from './src/services/searchService.js';
import * as webSearchService from './src/services/webSearchService.js';
import * as entityExtractorService from './src/services/entityExtractorService.js';
import * as companyMatcherService from './src/services/companyMatcherService.js';
import { logger } from './src/utils/logger.js';

// Load .env from project root
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '..', '.env') });
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Test configuration
const TEST_QUERIES = [
  "Fastest growing AI companies in California",
  "Renewable energy startups in Europe founded after 2018",
  "Fintech companies that specialize in payment processing"
];
const API_URL = 'http://localhost:3001/api/search/unified';

// Set a timeout to allow for async operations
const timeout = setTimeout(() => {
  console.error('Test timed out after 2 minutes');
  process.exit(1);
}, 120000);

/**
 * Execute a unified search query
 */
async function testUnifiedSearch(query, options = {}) {
  console.log(`\n🔍 Testing unified search for: "${query}"`);
  
  try {
    // Direct call to API
    const startTime = Date.now();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, options }),
    });
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`Query executed in ${duration}ms`);
    
    if (!response.ok) {
      console.error(`❌ API Error: ${result.error || 'Unknown error'}`);
      return null;
    }
    
    // Print results summary
    console.log(`\n📊 Results Summary:`);
    console.log(`- Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`- Data sources: ${Object.keys(result.sources || {}).filter(k => result.sources[k]).join(', ')}`);
    console.log(`- Companies found: ${result.companies?.length || 0}`);
    
    if (result.pagination) {
      console.log(`- Pagination: Page ${result.pagination.currentPage} of ${result.pagination.totalPages} (${result.pagination.count} total results)`);
    }
    
    // Print performance metrics
    if (result.meta?.stages) {
      console.log(`\n⏱️ Performance Metrics:`);
      Object.entries(result.meta.stages).forEach(([stage, time]) => {
        console.log(`- ${stage}: ${time}ms`);
      });
      console.log(`- Total: ${result.meta.executionTime}`);
    }
    
    // Print error information if any
    if (result.meta?.errors) {
      console.log(`\n⚠️ Errors encountered:`);
      Object.entries(result.meta.errors).forEach(([stage, error]) => {
        console.log(`- ${stage}: ${error}`);
      });
    }
    
    // Print sample companies
    console.log(`\n🏢 Sample Companies:`);
    const sampleSize = Math.min(3, result.companies?.length || 0);
    if (sampleSize > 0) {
      result.companies.slice(0, sampleSize).forEach((company, i) => {
        console.log(`\n[${i+1}] ${company.name || 'Unknown'}`);
        if (company.industry) console.log(`   Industry: ${company.industry}`);
        if (company.location) console.log(`   Location: ${company.location}`);
        if (company.description) {
          const description = company.description.length > 100 ? 
            company.description.substring(0, 100) + '...' : 
            company.description;
          console.log(`   Description: ${description}`);
        }
        console.log(`   Source: ${company.enrichedFromWeb ? 'Database + Web' : (company._webDiscovered ? 'Web only' : 'Database')}`);
      });
    } else {
      console.log('   No companies found.');
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Test error: ${error.message}`);
    return null;
  }
}

/**
 * Test the caching mechanism by making the same request twice
 */
async function testCaching(queryBase) {
  // Add a timestamp to the query to ensure uniqueness and avoid previous cache hits
  const uniqueQuery = `${queryBase} ${Date.now()}`;
  console.log(`\n♻️ Testing caching with unique query: "${uniqueQuery}"`);
  
  try {
    // First request (should be uncached)
    console.log('\nFirst request (should be uncached):');
    const uncachedStartTime = Date.now();
    const uncachedResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: uniqueQuery }),
    });
    const uncachedResult = await uncachedResponse.json();
    const uncachedDuration = Date.now() - uncachedStartTime;
    console.log(`- First request time: ${uncachedDuration}ms`);
    
    // Check X-Cache header if available
    const cacheStatus1 = uncachedResponse.headers.get('X-Cache');
    console.log(`- Cache status: ${cacheStatus1 || 'Unknown'}`);
    
    // Wait briefly
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Second request (should be cached)
    console.log('\nSecond request (should be cached):');
    const cachedStartTime = Date.now();
    const cachedResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: uniqueQuery }),
    });
    const cachedResult = await cachedResponse.json();
    const cachedDuration = Date.now() - cachedStartTime;
    console.log(`- Second request time: ${cachedDuration}ms`);
    
    // Check X-Cache header if available
    const cacheStatus2 = cachedResponse.headers.get('X-Cache');
    console.log(`- Cache status: ${cacheStatus2 || 'Unknown'}`);
    
    // Calculate improvement
    const improvement = ((uncachedDuration - cachedDuration) / uncachedDuration) * 100;
    console.log(`\n🚀 Performance improvement: ${improvement.toFixed(2)}%`);
    
    return {
      uncachedDuration,
      cachedDuration,
      improvement
    };
  } catch (error) {
    console.error(`❌ Cache test error: ${error.message}`);
    return null;
  }
}

/**
 * Test pagination functionality
 */
async function testPagination(query) {
  console.log(`\n📄 Testing pagination with query: "${query}"`);
  
  try {
    // First page request
    console.log('\nFirst page (limit=5):');
    const page1Response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query,
        options: { limit: 5, offset: 0 }
      }),
    });
    const page1Result = await page1Response.json();
    
    if (!page1Result.success) {
      console.error(`❌ API Error: ${page1Result.error || 'Unknown error'}`);
      return null;
    }
    
    console.log(`- Retrieved ${page1Result.companies?.length || 0} companies`);
    if (page1Result.pagination) {
      console.log(`- Page ${page1Result.pagination.currentPage} of ${page1Result.pagination.totalPages}`);
      console.log(`- Total items: ${page1Result.pagination.count}`);
    }
    
    if (!page1Result.pagination?.links?.next) {
      console.log('- No next page available.');
      return { pagination: false };
    }
    
    console.log('\nSecond page:');
    // Extract offset and limit from next link
    const url = new URL(page1Result.pagination.links.next);
    const offset = url.searchParams.get('offset');
    const limit = url.searchParams.get('limit');
    
    // Second page request
    const page2Response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query,
        options: { 
          limit: parseInt(limit, 10), 
          offset: parseInt(offset, 10) 
        }
      }),
    });
    const page2Result = await page2Response.json();
    
    if (!page2Result.success) {
      console.error(`❌ API Error: ${page2Result.error || 'Unknown error'}`);
      return null;
    }
    
    console.log(`- Retrieved ${page2Result.companies?.length || 0} companies`);
    if (page2Result.pagination) {
      console.log(`- Page ${page2Result.pagination.currentPage} of ${page2Result.pagination.totalPages}`);
    }
    
    // Check different companies
    const firstPageIds = new Set(page1Result.companies.map(c => c._id || c.name));
    const secondPageIds = new Set(page2Result.companies.map(c => c._id || c.name));
    const differentCompanies = Array.from(secondPageIds).filter(id => !firstPageIds.has(id));
    
    console.log(`- Different companies between pages: ${differentCompanies.length}/${page2Result.companies.length}`);
    
    return {
      pagination: true,
      page1: page1Result.companies.length,
      page2: page2Result.companies.length,
      differentCompanies: differentCompanies.length
    };
  } catch (error) {
    console.error(`❌ Pagination test error: ${error.message}`);
    return null;
  }
}

/**
 * Test graceful degradation by requesting a query that would fail in some component
 */
async function testGracefulDegradation() {
  console.log('\n🛡️ Testing Graceful Degradation');
  
  try {
    // Intentionally complex query that might fail in some component but succeed overall
    const query = "Ultra-specialized non-existent xyzcompanies in imaginary sector with impossible parameters";
    
    console.log(`Testing with intentionally difficult query: "${query}"`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    
    const result = await response.json();
    
    console.log(`\n📊 Degradation Test Results:`);
    console.log(`- API Status: ${response.status} (${response.ok ? 'OK' : 'Failed'})`);
    console.log(`- Overall Success: ${result.success ? '✅ Success' : '❌ Failed'}`);
    
    // Check which components worked
    if (result.sources) {
      console.log('\nComponents status:');
      Object.entries(result.sources).forEach(([component, status]) => {
        console.log(`- ${component}: ${status ? '✅ Worked' : '❌ Failed'}`);
      });
    }
    
    // Check error information
    if (result.meta?.errors) {
      console.log('\nComponent errors:');
      Object.entries(result.meta.errors).forEach(([component, error]) => {
        console.log(`- ${component}: ${error}`);
      });
    }
    
    return {
      success: result.success,
      failedComponents: result.sources ? 
        Object.entries(result.sources)
          .filter(([_, status]) => !status)
          .map(([name]) => name) 
        : [],
      status: response.status
    };
  } catch (error) {
    console.error(`❌ Degradation test error: ${error.message}`);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting Unified Natural Language Search API Tests\n');
  console.log('OPENAI_API_KEY is ' + (process.env.OPENAI_API_KEY ? 'set ✅' : 'not set ❌'));
  
  // Track test results
  const results = {
    basicSearch: [],
    caching: null,
    pagination: null,
    gracefulDegradation: null
  };
  
  // Run basic search tests for different queries
  for (const query of TEST_QUERIES) {
    const result = await testUnifiedSearch(query);
    results.basicSearch.push({
      query,
      success: !!result?.success,
      companies: result?.companies?.length || 0
    });
  }
  
  // Test caching
  results.caching = await testCaching(TEST_QUERIES[0]);
  
  // Test pagination
  results.pagination = await testPagination(TEST_QUERIES[0]);
  
  // Test graceful degradation
  results.gracefulDegradation = await testGracefulDegradation();
  
  // Print summary
  console.log('\n==============================================');
  console.log('📋 UNIFIED SEARCH API TEST SUMMARY');
  console.log('==============================================');
  
  console.log('\nBasic Search Tests:');
  results.basicSearch.forEach(result => {
    console.log(`- Query: "${result.query.substring(0, 30)}...":`);
    console.log(`  ${result.success ? '✅ SUCCESS' : '❌ FAIL'}, ${result.companies} companies found`);
  });
  
  console.log('\nCaching Test:');
  if (results.caching) {
    console.log(`- First call: ${results.caching.uncachedDuration}ms`);
    console.log(`- Second call: ${results.caching.cachedDuration}ms`);
    console.log(`- Improvement: ${results.caching.improvement.toFixed(2)}%`);
    console.log(`- Status: ${results.caching.improvement > 30 ? '✅ SUCCESS' : '⚠️ SUBOPTIMAL'}`);
  } else {
    console.log(`- Status: ❌ FAILED TO TEST`);
  }
  
  console.log('\nPagination Test:');
  if (results.pagination) {
    if (results.pagination.pagination) {
      console.log(`- First page: ${results.pagination.page1} items`);
      console.log(`- Second page: ${results.pagination.page2} items`);
      console.log(`- Different items: ${results.pagination.differentCompanies}`);
      console.log(`- Status: ${results.pagination.differentCompanies > 0 ? '✅ SUCCESS' : '❌ FAIL'}`);
    } else {
      console.log(`- Status: ⚠️ NOT ENOUGH DATA FOR PAGINATION`);
    }
  } else {
    console.log(`- Status: ❌ FAILED TO TEST`);
  }
  
  console.log('\nGraceful Degradation Test:');
  if (results.gracefulDegradation) {
    console.log(`- API returned: ${results.gracefulDegradation.status}`);
    console.log(`- Failed components: ${results.gracefulDegradation.failedComponents.join(', ') || 'None'}`);
    console.log(`- Overall success: ${results.gracefulDegradation.success ? '✅ Yes' : '❌ No'}`);
    console.log(`- Status: ${results.gracefulDegradation.status < 500 ? '✅ SUCCESS' : '❌ FAIL'}`);
  } else {
    console.log(`- Status: ❌ FAILED TO TEST`);
  }
  
  // Calculate overall success
  const searchSuccess = results.basicSearch.every(r => r.success);
  const cachingSuccess = results.caching && results.caching.improvement > 30;
  const paginationSuccess = results.pagination && 
    (results.pagination.pagination ? results.pagination.differentCompanies > 0 : true);
  const degradationSuccess = results.gracefulDegradation && results.gracefulDegradation.status < 500;
  
  const allTestsSuccess = searchSuccess && cachingSuccess && paginationSuccess && degradationSuccess;
  
  console.log('\n==============================================');
  console.log(`OVERALL TEST RESULT: ${allTestsSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('==============================================');
  
  clearTimeout(timeout);
  process.exit(allTestsSuccess ? 0 : 1);
}

// Run the tests
runTests().catch(err => {
  console.error('Unexpected error in test runner:', err);
  clearTimeout(timeout);
  process.exit(1);
});