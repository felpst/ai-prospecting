/**
 * Natural Language Search Controller
 * 
 * Handles natural language search requests, leveraging both the NL parser and search services.
 */

import * as nlpService from '../services/naturalLanguageQueryParser.js';
import * as searchService from '../services/searchService.js';
import * as entityExtractorService from '../services/entityExtractorService.js';
import * as webSearchService from '../services/webSearchService.js';
import * as companyMatcherService from '../services/companyMatcherService.js';
import { formatPaginationLinks } from '../utils/paginationUtils.js';
import { logger } from '../utils/logger.js';

/**
 * Process a natural language search query and return search results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const naturalLanguageSearch = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'A valid search query is required'
      });
    }
    
    logger.info(`Natural language search request received: "${query}"`);
    
    // Parse the natural language query into structured search parameters
    const searchParams = await nlpService.parseQuery(query);
    logger.debug(`Parsed search parameters: ${JSON.stringify(searchParams)}`);
    
    // Execute the search with the parsed parameters
    const searchResults = await searchService.executeSearch(searchParams);
    
    // Return the search results along with the parsed parameters for transparency
    return res.status(200).json({
      success: true,
      parsedQuery: searchParams,
      results: searchResults.results,
      pagination: searchResults.pagination,
      meta: {
        ...searchResults.meta,
        originalQuery: query
      }
    });
  } catch (error) {
    logger.error(`Error in natural language search: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while processing your search query'
    });
  }
};

/**
 * Process a natural language query using web search and return matching companies
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const webSearch = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'A valid search query is required'
      });
    }
    
    logger.info(`Web search request received: "${query}"`);
    
    // Perform web search and company extraction
    const searchResults = await nlpService.webSearch(query);
    
    // Return the search results
    return res.status(200).json({
      success: true,
      results: searchResults,
      meta: {
        originalQuery: query
      }
    });
  } catch (error) {
    logger.error(`Error in web search: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while processing your web search query'
    });
  }
};

/**
 * Extract structured company entities from web search results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const extractCompanyEntities = async (req, res) => {
  try {
    const { searchResults } = req.body;
    const options = req.body.options || {};
    
    if (!searchResults || !searchResults.companies || !Array.isArray(searchResults.companies)) {
      return res.status(400).json({
        success: false,
        error: 'Valid search results with a companies array are required'
      });
    }
    
    logger.info(`Company entity extraction request received for ${searchResults.companies.length} results`);
    
    // Extract structured company entities from search results
    const extractedEntities = await entityExtractorService.extractCompanies(searchResults, options);
    
    // Return the extracted entities
    return res.status(200).json({
      success: true,
      entities: extractedEntities.companies,
      meta: {
        ...extractedEntities.meta,
        originalResults: searchResults.companies.length
      }
    });
  } catch (error) {
    logger.error(`Error in company entity extraction: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while extracting company entities'
    });
  }
};

/**
 * Unified Natural Language Search API
 * Provides a comprehensive search experience combining database search, web search,
 * entity extraction, and company matching with intelligent fallbacks.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const unifiedSearch = async (req, res) => {
  const startTime = Date.now();
  let stages = {}; // Store timing for each stage
  let errors = {}; // Track errors in each stage
  let result = {
    success: true,
    sources: {}, // Track which data sources contributed
    companies: [],
    extractedEntities: [],
    matchedCompanies: []
  };
  
  try {
    const { query } = req.body;
    const options = req.body.options || {};
    
    // Validate input
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'A valid search query is required'
      });
    }
    
    logger.info(`Unified search request received: "${query}"`);
    
    // Get pagination parameters
    const limit = parseInt(options.limit || '20', 10);
    const offset = parseInt(options.offset || '0', 10);
    
    // Stage 1: Parse the natural language query into structured search parameters
    try {
      const parseStart = Date.now();
      const searchParams = await nlpService.parseQuery(query);
      stages.parsing = Date.now() - parseStart;
      
      logger.debug(`[Unified Search] Parsed parameters: ${JSON.stringify(searchParams)}`);
      result.parsedQuery = searchParams;
      result.sources.nlParser = true;
      
      // Stage 2a: Search the database with parsed parameters
      try {
        const dbSearchStart = Date.now();
        const searchResults = await searchService.executeSearch({
          ...searchParams,
          limit,
          offset
        });
        stages.dbSearch = Date.now() - dbSearchStart;
        
        // Store database search results
        result.companies = searchResults.results;
        result.sources.database = true;
        result.pagination = searchResults.pagination;
        
        // If we have sufficient results from the database, don't do web search
        if (result.companies.length >= limit) {
          result.sources.webSearch = false;
          logger.debug(`[Unified Search] Sufficient results from database (${result.companies.length}), skipping web search`);
        }
      } catch (dbError) {
        errors.dbSearch = dbError.message;
        logger.error(`[Unified Search] Database search failed: ${dbError.message}`);
        result.sources.database = false;
      }
      
    } catch (parseError) {
      errors.parsing = parseError.message;
      logger.error(`[Unified Search] Query parsing failed: ${parseError.message}`);
      result.sources.nlParser = false;
      // Set a default structured query if parsing fails
      result.parsedQuery = { query: query.trim() };
    }
    
    // Stage 2b: Perform web search if database results are insufficient or errored
    if (!result.sources.database || result.companies.length < limit) {
      try {
        const webSearchStart = Date.now();
        const webSearchResults = await webSearchService.searchWeb({ 
          query, 
          ...result.parsedQuery 
        }, options);
        stages.webSearch = Date.now() - webSearchStart;
        
        result.webSearchResults = webSearchResults;
        result.sources.webSearch = true;
        
        // Stage 3: Extract structured entities from web search results
        try {
          const extractionStart = Date.now();
          const extractedEntities = await entityExtractorService.extractCompanies(webSearchResults, options);
          stages.entityExtraction = Date.now() - extractionStart;
          
          result.extractedEntities = extractedEntities.companies;
          result.sources.entityExtractor = true;
          
          // Stage 4: Match extracted entities to database
          try {
            const matchingStart = Date.now();
            const matchResults = await companyMatcherService.matchCompanies(extractedEntities.companies, {
              ...options,
              maxMatches: 3,
              similarityThreshold: 0.70
            });
            stages.matching = Date.now() - matchingStart;
            
            result.matchedCompanies = matchResults.matchedCompanies;
            result.sources.companyMatcher = true;
            
            // Enhance local database results with web search findings
            const enhancedCompanies = enhanceResultsWithWebFindings(
              result.companies, 
              result.matchedCompanies
            );
            
            // Apply ranking to combined results
            result.companies = rankResults(enhancedCompanies, query, result.parsedQuery);
            
          } catch (matchError) {
            errors.matching = matchError.message;
            logger.error(`[Unified Search] Company matching failed: ${matchError.message}`);
            result.sources.companyMatcher = false;
          }
        } catch (extractionError) {
          errors.entityExtraction = extractionError.message;
          logger.error(`[Unified Search] Entity extraction failed: ${extractionError.message}`);
          result.sources.entityExtractor = false;
        }
      } catch (webSearchError) {
        errors.webSearch = webSearchError.message;
        logger.error(`[Unified Search] Web search failed: ${webSearchError.message}`);
        result.sources.webSearch = false;
      }
    }
    
    // Calculate total execution time
    const executionTime = Date.now() - startTime;
    
    // Add performance metrics
    result.meta = {
      originalQuery: query,
      executionTime: `${executionTime}ms`,
      stages,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      dataSources: result.sources
    };
    
    // Format pagination if available
    if (result.pagination) {
      result.pagination = formatPaginationForResponse(req, result.pagination, limit, offset);
    }
    
    // Add response time header
    res.set('X-Response-Time', `${executionTime}ms`);
    res.set('X-Data-Sources', Object.keys(result.sources).filter(key => result.sources[key]).join(','));
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // Return the unified search results
    return res.status(200).json(result);
    
  } catch (error) {
    logger.error(`Error in unified search: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'An error occurred while processing your search query',
      meta: {
        executionTime: `${Date.now() - startTime}ms`,
        stages,
        errors: { ...errors, global: error.message }
      }
    });
  }
};

/**
 * Enhance database results with web findings by merging matching companies
 * and adding unique web-only discoveries
 * 
 * @param {Array} dbCompanies - Companies from database
 * @param {Array} matchedCompanies - Matched companies from web search
 * @returns {Array} Enhanced list of companies
 */
function enhanceResultsWithWebFindings(dbCompanies, matchedCompanies) {
  if (!matchedCompanies || matchedCompanies.length === 0) {
    return dbCompanies;
  }
  
  // Create a map of existing company IDs for quick lookup
  const existingCompanyMap = new Map();
  dbCompanies.forEach(company => {
    existingCompanyMap.set(company._id?.toString(), company);
    if (company.name) {
      existingCompanyMap.set(company.name.toLowerCase(), company);
    }
  });
  
  // Enhanced result list starts with all DB companies
  const enhancedResults = [...dbCompanies];
  
  // Add web-discovered companies that weren't in the database
  matchedCompanies.forEach(match => {
    // Look for exact matches in DB results
    const exactMatches = match.matches.filter(m => m.isExactMatch);
    
    if (exactMatches.length > 0) {
      // Found an exact match - enrich the existing company with web data
      const dbMatch = exactMatches[0].company;
      const dbCompany = existingCompanyMap.get(dbMatch._id?.toString()) || 
                        existingCompanyMap.get(dbMatch.name?.toLowerCase());
      
      if (dbCompany) {
        // Merge web data with existing DB data where DB is missing info
        Object.keys(match.original).forEach(key => {
          if (!dbCompany[key] && match.original[key]) {
            dbCompany[key] = match.original[key];
          }
        });
        
        // Add a flag indicating this was enriched with web data
        dbCompany.enrichedFromWeb = true;
      }
    } else if (match.matches.length === 0) {
      // No DB match found - add the web-only company to results
      enhancedResults.push({
        ...match.original,
        _webDiscovered: true
      });
    }
  });
  
  return enhancedResults;
}

/**
 * Rank search results based on relevance to the query
 * 
 * @param {Array} companies - Companies to rank
 * @param {string} originalQuery - Original search query
 * @param {Object} parsedQuery - Structured query parameters
 * @returns {Array} Ranked companies
 */
function rankResults(companies, originalQuery, parsedQuery) {
  if (!companies || companies.length === 0) {
    return [];
  }
  
  // Create scoring functions
  const scoreFunctions = [
    // Score function: Web discovery (highest priority)
    company => company._webDiscovered ? 20 : 0,
    
    // Score function: Web enrichment
    company => company.enrichedFromWeb ? 10 : 0,
    
    // Score function: Name match with query terms
    company => {
      if (!company.name || !originalQuery) return 0;
      const queryTerms = originalQuery.toLowerCase().split(/\s+/);
      const nameTerms = company.name.toLowerCase().split(/\s+/);
      return queryTerms.filter(term => nameTerms.some(nameTerm => nameTerm.includes(term))).length * 5;
    },
    
    // Score function: Industry match
    company => {
      if (!company.industry || !parsedQuery.industry) return 0;
      return company.industry.toLowerCase().includes(parsedQuery.industry.toLowerCase()) ? 15 : 0;
    },
    
    // Score function: Location match
    company => {
      let score = 0;
      if (company.location && parsedQuery.locality && 
          company.location.toLowerCase().includes(parsedQuery.locality.toLowerCase())) {
        score += 10;
      }
      if (company.location && parsedQuery.region && 
          company.location.toLowerCase().includes(parsedQuery.region.toLowerCase())) {
        score += 8;
      }
      if (company.location && parsedQuery.country && 
          company.location.toLowerCase().includes(parsedQuery.country.toLowerCase())) {
        score += 5;
      }
      return score;
    }
  ];
  
  // Calculate scores
  const scoredCompanies = companies.map(company => {
    let totalScore = 0;
    scoreFunctions.forEach(scoreFunc => {
      totalScore += scoreFunc(company);
    });
    return { ...company, _relevanceScore: totalScore };
  });
  
  // Sort by score (descending)
  return scoredCompanies
    .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0))
    .map(company => {
      // Remove scoring fields from final results
      const { _relevanceScore, _webDiscovered, ...cleanCompany } = company;
      return cleanCompany;
    });
}

/**
 * Format pagination data for API response
 * 
 * @param {Object} req - Express request object
 * @param {Object} pagination - Pagination data
 * @param {number} limit - Items per page
 * @param {number} offset - Starting offset
 * @returns {Object} Formatted pagination data
 */
function formatPaginationForResponse(req, pagination, limit, offset) {
  const totalCount = pagination.count || pagination.total || 0;
  
  // Create pagination links
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);
  
  // Base URL 
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  
  // Create query string without pagination params
  const queryParams = { ...req.body };
  delete queryParams.offset;
  delete queryParams.limit;
  
  // Build links
  const links = {};
  
  if (currentPage > 1) {
    const prevOffset = Math.max(0, offset - limit);
    links.prev = `${baseUrl}?offset=${prevOffset}&limit=${limit}`;
    links.first = `${baseUrl}?offset=0&limit=${limit}`;
  }
  
  if (currentPage < totalPages) {
    const nextOffset = offset + limit;
    links.next = `${baseUrl}?offset=${nextOffset}&limit=${limit}`;
    links.last = `${baseUrl}?offset=${(totalPages - 1) * limit}&limit=${limit}`;
  }
  
  return {
    count: totalCount,
    limit,
    offset,
    currentPage,
    totalPages,
    links
  };
}

export default {
  naturalLanguageSearch,
  webSearch,
  extractCompanyEntities,
  unifiedSearch
}; 