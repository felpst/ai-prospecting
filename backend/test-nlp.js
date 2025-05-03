import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseQuery, webSearch } from './src/services/naturalLanguageQueryParser.js';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

// Set a timeout to allow for async operations
const timeout = setTimeout(() => {
  console.error('Test timed out after 30 seconds');
  process.exit(1);
}, 30000);

// Test natural language parsing
async function testNLParse() {
  console.log('Testing Natural Language Query Parser...');
  
  try {
    const query = 'Fastest growing AR companies in Silicon Valley';
    console.log(`Query: "${query}"`);
    
    const result = await parseQuery(query);
    console.log('Parsed parameters:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\nTest completed successfully ✅');
    return true;
  } catch (error) {
    console.error('Error during parse test:', error.message);
    if (error.message.includes('OpenAI service is not configured')) {
      console.error('\nMake sure OPENAI_API_KEY is set in your .env file');
    }
    return false;
  }
}

// Test web search functionality
async function testWebSearch() {
  console.log('\nTesting Web Search Functionality...');
  
  try {
    const query = 'Top fintech companies in Europe';
    console.log(`Query: "${query}"`);
    
    const result = await webSearch(query);
    console.log('Search results:');
    console.log(JSON.stringify(result, null, 2));
    
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

// Run the tests
async function runTests() {
  console.log('Starting Natural Language Parser Tests\n');
  console.log('OPENAI_API_KEY is ' + (process.env.OPENAI_API_KEY ? 'set ✅' : 'not set ❌'));
  
  const parseSuccess = await testNLParse();
  const webSearchSuccess = await testWebSearch();
  
  console.log('\n--- Test Summary ---');
  console.log(`Natural Language Parse: ${parseSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Web Search: ${webSearchSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  clearTimeout(timeout);
  process.exit(parseSuccess && webSearchSuccess ? 0 : 1);
}

runTests().catch(err => {
  console.error('Unexpected error in test runner:', err);
  clearTimeout(timeout);
  process.exit(1);
}); 