/**
 * Real-World Enrichment Test Script
 * 
 * This script tests the company enrichment flow with real-world company data.
 * It runs through the entire process from scraping to LLM summary generation.
 * 
 * Usage: NODE_ENV=test node src/scripts/test-enrichment-e2e.js [--save-results]
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import necessary services
import * as scraperService from '../services/scraperService.js';
import * as storageService from '../services/storageService.js';
import * as llmService from '../services/llmService.js';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Command line flags
const saveResults = process.argv.includes('--save-results');

// Test companies (name, website, linkedin_url)
const testCompanies = [
  {
    id: 'apple-test',
    name: 'Apple Inc.',
    website: 'https://www.apple.com',
    linkedin_url: 'https://www.linkedin.com/company/apple',
    industry: 'Technology'
  },
  {
    id: 'tesla-test',
    name: 'Tesla',
    website: 'https://www.tesla.com',
    linkedin_url: 'https://www.linkedin.com/company/tesla-motors',
    industry: 'Automotive'
  },
  {
    id: 'microsoft-test',
    name: 'Microsoft',
    website: 'https://www.microsoft.com',
    linkedin_url: 'https://www.linkedin.com/company/microsoft',
    industry: 'Technology'
  },
  {
    id: 'linkedin-only-test',
    name: 'Small Consulting Firm',
    website: '',
    linkedin_url: 'https://www.linkedin.com/company/accenture',
    industry: 'Consulting'
  }
];

// Create results directory if saving results
const resultsDir = path.join(__dirname, '../../test-results');
if (saveResults && !fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Main function to test enrichment
 */
async function testEnrichment() {
  console.log('🔍 Starting Real-World Enrichment Test');
  console.log('======================================');
  
  // Setup database connection if needed
  if (process.env.MONGODB_URI) {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  }
  
  const results = {
    testDate: new Date().toISOString(),
    summary: {
      total: testCompanies.length,
      success: 0,
      failed: 0,
      partialSuccess: 0
    },
    companies: []
  };
  
  // Test each company
  for (const company of testCompanies) {
    console.log(`\n📊 Testing company: ${company.name} (${company.id})`);
    console.log(`Website: ${company.website || 'Not available'}`);
    console.log(`LinkedIn: ${company.linkedin_url || 'Not available'}`);
    
    try {
      // Start timing
      const startTime = Date.now();
      
      // 1. Determine data source (website or LinkedIn)
      const dataSource = company.website ? 'website' : 'linkedin';
      console.log(`Using ${dataSource} as primary data source`);
      
      // 2. Scrape content
      let scrapedContentData;
      let scrapeSource = 'live_scrape';
      
      // Use website if available, otherwise try to use LinkedIn
      const primaryUrl = company.website || company.linkedin_url;
      const sourceType = company.website ? 'website' : 'linkedin';
      
      // Clear any previous content from storage for testing purposes
      // Check if the delete function exists before calling it
      try {
        if (typeof storageService.deleteScrapedContent === 'function') {
          await storageService.deleteScrapedContent(primaryUrl);
        }
      } catch (error) {
        console.log(`Note: Could not clear previous cached content. This is fine for testing.`);
      }
      
      if (sourceType === 'website') {
        // Standard website scraping
        console.log(`Scraping website: ${primaryUrl}`);
        const scrapeOptions = {
          saveToStorage: true,
          companyId: company.id,
          linkedinUrl: company.linkedin_url || null
        };
        
        const scrapeResult = await scraperService.scrapeCompanyWebsite(primaryUrl, scrapeOptions);
        
        if (scrapeResult.error) {
          throw new Error(`Scraping failed: ${scrapeResult.error.message}`);
        }
        
        console.log(`✅ Scraped website successfully`);
        // Retrieve the saved content from storage
        scrapedContentData = await storageService.getScrapedContent(primaryUrl);
      } else {
        // LinkedIn-only scraping
        console.log(`Scraping LinkedIn profile: ${primaryUrl}`);
        const linkedInScrapeResult = await scraperService.scrapeLinkedInCompanyPage(primaryUrl);
        
        if (linkedInScrapeResult.error) {
          throw new Error(`LinkedIn scraping failed: ${linkedInScrapeResult.message || 'Unknown error'}`);
        }
        
        console.log(`✅ Scraped LinkedIn profile successfully`);
        
        // Store LinkedIn data as mock website content
        const mockWebsiteContent = {
          url: company.linkedin_url,
          title: `${company.name} - LinkedIn Profile`,
          mainContent: linkedInScrapeResult.description || `LinkedIn profile for ${company.name}`,
          aboutInfo: linkedInScrapeResult.description || '',
          productInfo: linkedInScrapeResult.specialties || '',
          teamInfo: '',
          contactInfo: '',
          linkedinData: linkedInScrapeResult
        };
        
        // Save the mock website content to storage
        await storageService.saveScrapedContent(
          {
            url: company.linkedin_url,
            title: mockWebsiteContent.title,
            mainContent: mockWebsiteContent.mainContent,
            aboutInfo: mockWebsiteContent.aboutInfo,
            productInfo: mockWebsiteContent.productInfo,
            teamInfo: mockWebsiteContent.teamInfo,
            contactInfo: mockWebsiteContent.contactInfo,
            linkedinData: linkedInScrapeResult,
            rawHtml: ''
          },
          {
            statusCode: 200,
            scrapeDuration: 0,
            companyId: company.id
          }
        );
        
        // Get the saved content
        scrapedContentData = await storageService.getScrapedContent(company.linkedin_url);
      }
      
      // Ensure we have content before proceeding
      if (!scrapedContentData) {
        throw new Error('Failed to obtain scraped content for enrichment');
      }
      
      // 3. Generate summary using LLM
      console.log('Calling LLM service to generate summary...');
      const generatedSummary = await llmService.generateCompanySummary(
        company, 
        scrapedContentData
      );
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      console.log(`✅ Generated summary in ${executionTime}ms`);
      console.log('\nSUMMARY:');
      console.log('=========');
      console.log(generatedSummary);
      console.log('=========\n');
      
      // Store results
      results.companies.push({
        id: company.id,
        name: company.name,
        dataSource,
        scrapeSource,
        executionTime,
        success: true,
        summary: generatedSummary
      });
      
      results.summary.success++;
      
    } catch (error) {
      console.error(`❌ Error enriching ${company.name}: ${error.message}`);
      
      // Store error results
      results.companies.push({
        id: company.id,
        name: company.name,
        success: false,
        error: {
          message: error.message,
          stack: error.stack
        }
      });
      
      results.summary.failed++;
    }
  }
  
  // Print summary
  console.log('\n📋 TEST SUMMARY');
  console.log('==============');
  console.log(`Total companies tested: ${results.summary.total}`);
  console.log(`✅ Successful: ${results.summary.success}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  
  // Save results if requested
  if (saveResults) {
    const resultsFile = path.join(resultsDir, `enrichment-test-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);
  }
  
  // Cleanup and exit
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testEnrichment()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 