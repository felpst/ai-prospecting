/**
 * Tests for Natural Language Query Parser Service
 * 
 * These tests verify the functionality of parsing natural language queries into structured search parameters.
 */

import chai from 'chai';
import sinon from 'sinon';
import { parseQuery, webSearch } from '../services/naturalLanguageQueryParser.js';
import * as llmCacheService from '../services/llmCacheService.js';
import OpenAI from 'openai';

const { expect } = chai;

describe('Natural Language Query Parser Service', () => {
  let openaiStub;
  let cacheStub;
  
  beforeEach(() => {
    // Mock OpenAI client
    openaiStub = sinon.stub(OpenAI.prototype.chat.completions, 'create');
    
    // Mock cache service
    cacheStub = sinon.stub(llmCacheService, 'getCachedLlmResponse').resolves(null);
    sinon.stub(llmCacheService, 'cacheLlmResponse').resolves(true);
  });
  
  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });
  
  describe('parseQuery', () => {
    it('should extract structured parameters from a natural language query', async () => {
      // Setup OpenAI response mock with function call
      openaiStub.resolves({
        choices: [{
          message: {
            role: 'assistant',
            tool_calls: [{
              function: {
                name: 'extractSearchParameters',
                arguments: JSON.stringify({
                  industry: 'AI',
                  country: 'USA',
                  region: 'California',
                  locality: 'Silicon Valley',
                  size: 'startup'
                })
              }
            }]
          }
        }]
      });
      
      const query = 'Find AI startups in Silicon Valley';
      const result = await parseQuery(query);
      
      expect(result).to.deep.equal({
        industry: 'AI',
        country: 'USA',
        region: 'California',
        locality: 'Silicon Valley',
        size: 'startup'
      });
      
      expect(openaiStub.calledOnce).to.be.true;
      const callArgs = openaiStub.firstCall.args[0];
      expect(callArgs.messages[1].content).to.equal(query);
    });
    
    it('should handle queries where no function call is made', async () => {
      // Setup OpenAI response mock without function call
      openaiStub.resolves({
        choices: [{
          message: {
            role: 'assistant',
            content: 'AI companies'
          }
        }]
      });
      
      const query = 'AI companies';
      const result = await parseQuery(query);
      
      expect(result).to.deep.equal({
        query: 'AI companies'
      });
    });
    
    it('should use cached response if available', async () => {
      // Setup cache hit
      const cachedResponse = {
        industry: 'Fintech',
        region: 'Europe'
      };
      cacheStub.resolves(cachedResponse);
      
      const query = 'Find fintech companies in Europe';
      const result = await parseQuery(query);
      
      expect(result).to.deep.equal(cachedResponse);
      expect(openaiStub.called).to.be.false;
    });
    
    it('should remove empty parameters from the result', async () => {
      // Setup OpenAI response mock with empty parameters
      openaiStub.resolves({
        choices: [{
          message: {
            role: 'assistant',
            tool_calls: [{
              function: {
                name: 'extractSearchParameters',
                arguments: JSON.stringify({
                  industry: 'E-commerce',
                  country: '',
                  region: null,
                  size: undefined
                })
              }
            }]
          }
        }]
      });
      
      const query = 'E-commerce companies';
      const result = await parseQuery(query);
      
      expect(result).to.deep.equal({
        industry: 'E-commerce'
      });
    });
    
    it('should handle malformed function arguments gracefully', async () => {
      // Setup OpenAI response mock with invalid JSON
      openaiStub.resolves({
        choices: [{
          message: {
            role: 'assistant',
            tool_calls: [{
              function: {
                name: 'extractSearchParameters',
                arguments: '{invalid-json'
              }
            }]
          }
        }]
      });
      
      const query = 'Find healthcare companies';
      
      try {
        await parseQuery(query);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).to.equal('ApiError');
        expect(error.message).to.include('Failed to parse search parameters');
      }
    });
  });
  
  describe('webSearch', () => {
    it('should call OpenAI web search and extract companies', async () => {
      // Setup OpenAI web search response
      openaiStub.onFirstCall().resolves({
        choices: [{
          message: {
            role: 'assistant',
            content: 'Here are some companies I found...',
            tool_calls: [{ type: 'web_search' }]
          }
        }]
      });
      
      // Setup OpenAI extraction response
      openaiStub.onSecondCall().resolves({
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              companies: [
                { name: 'OpenAI', domain: 'openai.com', industry: 'AI' },
                { name: 'Anthropic', domain: 'anthropic.com', industry: 'AI' }
              ]
            })
          }
        }]
      });
      
      const query = 'Top AI companies';
      const result = await webSearch(query);
      
      expect(result).to.deep.equal({
        companies: [
          { name: 'OpenAI', domain: 'openai.com', industry: 'AI' },
          { name: 'Anthropic', domain: 'anthropic.com', industry: 'AI' }
        ]
      });
      
      expect(openaiStub.calledTwice).to.be.true;
    });
    
    it('should use cached web search results if available', async () => {
      // Setup cache hit
      const cachedResponse = {
        companies: [
          { name: 'Fintech Inc', domain: 'fintech.com' }
        ]
      };
      cacheStub.resolves(cachedResponse);
      
      const query = 'Top fintech companies';
      const result = await webSearch(query);
      
      expect(result).to.deep.equal(cachedResponse);
      expect(openaiStub.called).to.be.false;
    });
    
    it('should handle malformed JSON response from extraction gracefully', async () => {
      // Setup OpenAI web search response
      openaiStub.onFirstCall().resolves({
        choices: [{
          message: {
            role: 'assistant',
            content: 'Web search results',
            tool_calls: [{ type: 'web_search' }]
          }
        }]
      });
      
      // Setup invalid JSON in extraction response
      openaiStub.onSecondCall().resolves({
        choices: [{
          message: {
            role: 'assistant',
            content: '{invalid-json'
          }
        }]
      });
      
      const query = 'Top AI companies';
      
      try {
        await webSearch(query);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).to.equal('ApiError');
        expect(error.message).to.include('Failed to parse companies from web search response');
      }
    });
  });
}); 