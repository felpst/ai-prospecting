import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as nlSearchController from './src/controllers/naturalLanguageSearchController.js';
import { logger } from './src/utils/logger.js';

// Load .env from project root
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '..', '.env') });
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Set up a minimal Express server for testing
const app = express();
const PORT = 3456; // Use a different port to avoid conflicts

app.use(cors());
app.use(express.json());

// Register the Natural Language Search endpoints
app.post('/api/search/natural-language', nlSearchController.naturalLanguageSearch);
app.post('/api/search/web', nlSearchController.webSearch);

// Start the test server
app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
  
  // Run tests
  testNaturalLanguageEndpoint();
});

// Test the Natural Language Search endpoint
async function testNaturalLanguageEndpoint() {
  console.log('Testing Natural Language Search API endpoint...');
  
  try {
    const response = await fetch(`http://localhost:${PORT}/api/search/natural-language`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'Fastest growing AR companies in Silicon Valley'
      })
    });
    
    const data = await response.json();
    console.log('Natural Language Search Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\nAPI Test completed. Press Ctrl+C to exit.');
  } catch (error) {
    console.error('Error during API test:', error.message);
  }
} 