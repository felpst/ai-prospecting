/**
 * Test Script for Company Matcher Service
 * 
 * This script tests the Company Matcher Service implementation for matching
 * extracted company entities to database entries using embeddings.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

// Set a timeout to allow for async operations
const timeout = setTimeout(() => {
  console.error('Test timed out after 120 seconds');
  process.exit(1);
}, 120000);

// Test the embedding generation
async function testEmbeddingGeneration() {
  console.log('Testing Embedding Generation...');
  
  try {
    // Generate an embedding for a sample text
    const sampleText = "Alphabet Inc. is an American multinational technology conglomerate holding company headquartered in Mountain View, California. It was created through a restructuring of Google on October 2, 2015.";
    
    console.log(`Generating embedding for text: "${sampleText.substring(0, 50)}..."`);
    
    const embedding = await companyMatcherService.generateEmbedding(sampleText);
    
    console.log(`Generated embedding with ${embedding.length} dimensions.`);
    console.log(`First 5 dimensions: ${embedding.slice(0, 5).map(d => d.toFixed(4)).join(', ')}`);
    
    // Test batch embedding generation
    const textBatch = [
      "Google is a technology company focused on search, cloud, and AI.",
      "Microsoft Corporation is an American multinational technology company producing computer software and consumer electronics.",
      "Apple Inc. is an American multinational technology company that specializes in consumer electronics, software and online services."
    ];
    
    console.log(`\nGenerating embeddings for a batch of ${textBatch.length} texts...`);
    
    const embeddings = await companyMatcherService.generateEmbeddingsBatch(textBatch);
    
    console.log(`Generated ${embeddings.length} embeddings in batch.`);
    
    // Test similarity calculation
    console.log('\nTesting similarity calculation...');
    const similarity = companyMatcherService.calculateCosineSimilarity(embeddings[0], embeddings[1]);
    console.log(`Similarity between "Google" and "Microsoft" texts: ${similarity.toFixed(4)}`);
    
    console.log('Embedding generation tests completed successfully ✅');
    return true;
  } catch (error) {
    console.error('Error during embedding generation test:', error.message);
    if (error.message.includes('OpenAI service is not configured')) {
      console.error('\nMake sure OPENAI_API_KEY is set in your .env file');
    }
    return false;
  }
}

// Test the full company matching flow
async function testCompanyMatching() {
  console.log('\nTesting Full Company Matching Flow...');
  
  try {
    // First, get some web search results using the web search service
    const searchParams = {
      industry: 'Technology',
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
    
    // Step 3: Match extracted entities to database entries
    console.log('\nStep 3: Matching companies to database...');
    const matchResults = await companyMatcherService.matchCompanies(extractedEntities.companies);
    
    // Display match statistics
    console.log('\nMatch statistics:');
    console.log(`- Total companies: ${matchResults.meta.totalExtractedCompanies}`);
    console.log(`- Exact matches: ${matchResults.meta.exactMatches}`);
    console.log(`- Fuzzy matches: ${matchResults.meta.fuzzyMatches}`);
    console.log(`- No matches: ${matchResults.meta.noMatches}`);
    
    // Show examples of matched companies
    console.log('\nSample of matched companies:');
    const sampleCount = Math.min(3, matchResults.matchedCompanies.length);
    for (let i = 0; i < sampleCount; i++) {
      const matchResult = matchResults.matchedCompanies[i];
      console.log(`\nOriginal company: ${matchResult.original.name}`);
      
      if (matchResult.matches.length > 0) {
        matchResult.matches.forEach((match, idx) => {
          console.log(`  Match ${idx + 1}: ${match.company.name}`);
          console.log(`    Match type: ${match.matchType}`);
          console.log(`    Match field: ${match.matchField}`);
          console.log(`    Similarity score: ${match.score.toFixed(4)}`);
        });
      } else {
        console.log('  No matches found');
      }
    }
    
    console.log('\nCompany matching test completed successfully ✅');
    return true;
  } catch (error) {
    console.error('Error during company matching test:', error.message);
    if (error.message.includes('OpenAI service is not configured')) {
      console.error('\nMake sure OPENAI_API_KEY is set in your .env file');
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('Starting Company Matcher Service Tests\n');
  console.log('OPENAI_API_KEY is ' + (process.env.OPENAI_API_KEY ? 'set ✅' : 'not set ❌'));
  
  const embeddingSuccess = await testEmbeddingGeneration();
  const matchingSuccess = await testCompanyMatching();
  
  console.log('\n--- Test Summary ---');
  console.log(`Embedding Generation: ${embeddingSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Company Matching: ${matchingSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  clearTimeout(timeout);
  process.exit(embeddingSuccess && matchingSuccess ? 0 : 1);
}

runTests().catch(err => {
  console.error('Unexpected error in test runner:', err);
  clearTimeout(timeout);
  process.exit(1);
}); 