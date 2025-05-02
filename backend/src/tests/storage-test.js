/**
 * Storage Test
 * Tests our storage functionality with MongoDB
 */

import mongoose from 'mongoose';
import {
  saveScrapedContent,
  getScrapedContent,
  updateScrapedContentStatus,
  getStorageStats
} from '../services/storageService.js';

console.log('===============================');
console.log('STORAGE TEST');
console.log('===============================');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webscraper_test';

// Test content
const testContent = {
  url: 'https://test-example.com/storage-test',
  title: 'Test Example Page',
  mainContent: 'This is test main content for the storage test.',
  aboutInfo: 'About information for test company.',
  productInfo: 'Product information for test company.',
  teamInfo: 'Team information for test company.',
  contactInfo: 'Contact information for test company.'
};

// Run storage tests
const runStorageTest = async () => {
  console.log('Starting storage tests...');
  
  try {
    // Connect to MongoDB
    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully ✅');
    
    // Test 1: Save content
    console.log('\n--- Test 1: Save content ---');
    const savedContent = await saveScrapedContent(testContent, {
      statusCode: 200,
      scrapeDuration: 500,
      companyId: 'test-company-123'
    });
    
    console.log(`Content saved with ID: ${savedContent._id} ✅`);
    
    // Test 2: Retrieve content
    console.log('\n--- Test 2: Retrieve content ---');
    const retrievedContent = await getScrapedContent(testContent.url);
    
    if (retrievedContent && retrievedContent.url === testContent.url) {
      console.log('Content retrieved successfully ✅');
      console.log(`Title: "${retrievedContent.title}"`);
      console.log(`Status: ${retrievedContent.status}`);
    } else {
      console.error('Failed to retrieve content ❌');
      return false;
    }
    
    // Test 3: Update content status
    console.log('\n--- Test 3: Update content status ---');
    const updatedContent = await updateScrapedContentStatus(testContent.url, 'processed');
    
    if (updatedContent && updatedContent.status === 'processed') {
      console.log('Content status updated successfully ✅');
      console.log(`New status: ${updatedContent.status}`);
    } else {
      console.error('Failed to update content status ❌');
      return false;
    }
    
    // Test 4: Get storage statistics
    console.log('\n--- Test 4: Get storage statistics ---');
    const stats = await getStorageStats();
    
    console.log('Storage statistics:');
    console.log(`- Total documents: ${stats.totalDocuments}`);
    if (stats.byStatus) {
      console.log('- Status breakdown:');
      for (const [status, count] of Object.entries(stats.byStatus)) {
        console.log(`  - ${status}: ${count}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Storage test failed with error:');
    console.error(error);
    return false;
  } finally {
    // Disconnect from MongoDB
    try {
      console.log('\nDisconnecting from MongoDB...');
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
  }
};

// Run the test
runStorageTest()
  .then(success => {
    console.log('\n===============================');
    console.log(`STORAGE TEST ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log('===============================');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nUnexpected error:');
    console.error(error);
    console.log('===============================');
    console.log('STORAGE TEST FAILED ❌');
    console.log('===============================');
    process.exit(1);
  }); 