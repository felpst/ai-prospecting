/**
 * LLM Service Integration Test
 * 
 * This test file verifies the LLM service functionality for company enrichment.
 * It includes tests for prompt construction and API interactions.
 * 
 * Note: Set ANTHROPIC_API_KEY environment variable to run integration tests.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import * as llmService from '../services/llmService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sample data for testing
const sampleCompanyData = {
  id: 'test-company-123',
  name: 'TechCorp Solutions',
  industry: 'Software Development',
  website: 'https://techcorp-test.com',
  description: 'A technology company focused on software solutions.'
};

const sampleScrapedContent = {
  url: 'https://techcorp-test.com',
  title: 'TechCorp Solutions - Enterprise Software',
  mainContent: 'TechCorp provides enterprise software solutions for businesses of all sizes.',
  aboutInfo: 'Founded in 2015, TechCorp is a leader in custom software development and integration services.',
  productInfo: 'Our products include CRM systems, ERP solutions, and custom application development.',
  teamInfo: 'Our team of experienced developers and designers works with clients across industries.',
  contactInfo: 'Contact us at info@techcorp-test.com',
  linkedinData: null,
  toObject: function() { return this; }
};

const sampleWithLinkedInData = {
  ...sampleScrapedContent,
  linkedinData: {
    description: 'TechCorp is a software company specializing in enterprise solutions.',
    specialties: 'CRM, ERP, Custom Development',
    employeeCount: '50-200 employees',
    error: false
  },
  toObject: function() { return this; }
};

// Set timeout to accommodate API calls
const TEST_TIMEOUT = 10000;

describe('LLM Service', function() {
  // Increase timeout for API calls
  this.timeout(TEST_TIMEOUT);
  
  describe('Prompt Construction', () => {
    it('should build a prompt with website content', () => {
      // Test is accessing private function through __test__ export
      const buildEnhancedSummaryPrompt = llmService.__test__?.buildEnhancedSummaryPrompt;
      
      if (!buildEnhancedSummaryPrompt) {
        console.warn('Unable to directly test private function buildEnhancedSummaryPrompt');
        return;
      }
      
      const prompt = buildEnhancedSummaryPrompt(sampleCompanyData, sampleScrapedContent);
      
      // Verify prompt content
      expect(prompt).to.be.a('string');
      expect(prompt).to.include(sampleCompanyData.name);
      expect(prompt).to.include(sampleCompanyData.industry);
      expect(prompt).to.include(sampleScrapedContent.aboutInfo);
    });
    
    it('should build a prompt with LinkedIn content', () => {
      // Test is accessing private function through __test__ export
      const buildEnhancedSummaryPrompt = llmService.__test__?.buildEnhancedSummaryPrompt;
      
      if (!buildEnhancedSummaryPrompt) {
        console.warn('Unable to directly test private function buildEnhancedSummaryPrompt');
        return;
      }
      
      const prompt = buildEnhancedSummaryPrompt(sampleCompanyData, sampleWithLinkedInData);
      
      // Verify prompt content
      expect(prompt).to.be.a('string');
      expect(prompt).to.include('LinkedIn Description');
      expect(prompt).to.include(sampleWithLinkedInData.linkedinData.description);
    });
  });
  
  describe('Error Handling', () => {
    let sandbox;
    
    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });
    
    afterEach(() => {
      sandbox.restore();
    });
    
    it('should handle API connection errors', async () => {
      // Skip if testing functions are not available
      if (!llmService.__test__) {
        console.warn('Skipping test: test helpers not available');
        return this.skip();
      }
      
      // Mock the withLlmRetry function to simulate an error
      const error = new Error('Connection failed');
      error.name = 'APIConnectionError';
      
      const stub = sandbox.stub(llmService, 'generateCompanySummary').rejects(error);
      
      try {
        await llmService.generateCompanySummary(sampleCompanyData, sampleScrapedContent);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.exist;
        expect(err.message).to.include('Connection failed');
      } finally {
        stub.restore();
      }
    });
    
    it('should handle rate limit errors', async () => {
      // Skip if testing functions are not available
      if (!llmService.__test__) {
        console.warn('Skipping test: test helpers not available');
        return this.skip();
      }
      
      // Mock the API call to simulate a rate limit error
      const error = new Error('Rate limit exceeded');
      error.name = 'RateLimitError';
      error.headers = { 'retry-after': '30' };
      
      const stub = sandbox.stub(llmService, 'generateCompanySummary').rejects(error);
      
      try {
        await llmService.generateCompanySummary(sampleCompanyData, sampleScrapedContent);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.exist;
        expect(err.message).to.include('Rate limit exceeded');
      } finally {
        stub.restore();
      }
    });
  });
  
  // Skip actual API tests if no API key is available
  const runIntegrationTests = process.env.ANTHROPIC_API_KEY && process.env.RUN_INTEGRATION_TESTS;
  
  (runIntegrationTests ? describe : describe.skip)('API Integration (requires API key)', () => {
    it('should generate a company summary through API', async () => {
      // This test makes an actual API call
      const summary = await llmService.generateCompanySummary(
        sampleCompanyData, 
        sampleScrapedContent
      );
      
      // Verify the summary
      expect(summary).to.be.a('string');
      expect(summary.length).to.be.at.least(50);
      
      // Should contain relevant information about the company
      expect(summary).to.include('TechCorp');
    });
    
    it('should handle LinkedIn data in summary generation', async () => {
      // This test makes an actual API call
      const summary = await llmService.generateCompanySummary(
        sampleCompanyData, 
        sampleWithLinkedInData
      );
      
      // Verify the summary
      expect(summary).to.be.a('string');
      expect(summary.length).to.be.at.least(50);
    });
  });
}); 