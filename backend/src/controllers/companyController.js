import Company from '../models/company.js';
import { ApiError, asyncHandler } from '../utils/errorHandler.js';
import { 
  buildCompanyFilter, 
  buildSortOptions, 
  calculatePagination, 
  formatResponse 
} from '../utils/queryBuilder.js';
import { 
  shouldUseCursorPagination, 
  extractCursorInfo, 
  cursorPaginate, 
  formatPaginationLinks 
} from '../utils/paginationUtils.js';
import * as companyService from '../services/companyService.js';
import * as enrichmentService from '../services/enrichmentService.js';
import * as scraperService from '../services/scraperService.js';
import * as storageService from '../services/storageService.js';
import * as llmService from '../services/llmService.js';
import logger from '../utils/logger.js';

/**
 * Get paginated companies with filters
 * @route GET /api/companies
 */
export const getCompanies = asyncHandler(async (req, res) => {
  try {
    // Add performance monitoring
    const startTime = Date.now();
    
    // Log the incoming request for debugging
    console.log(`[API] GET /api/companies with filters: ${JSON.stringify(req.query)}`);
    
    // Build filter from query parameters
    const filter = buildCompanyFilter(req.query);
    const sortOptions = buildSortOptions(req.query);
    
    // Determine if we should use cursor-based pagination for better performance
    if (shouldUseCursorPagination(req.query)) {
      // Extract cursor information from request
      const cursorInfo = extractCursorInfo(req);
      
      // Use cursor-based pagination
      const { results, pagination } = await cursorPaginate(
        Company,
        filter,
        sortOptions,
        cursorInfo,
        { count: req.query.count === 'true' } // Only count when explicitly requested
      );
      
      // Format response with pagination links
      const paginationData = formatPaginationLinks(req, pagination);
      
      // Calculate query execution time
      const executionTime = Date.now() - startTime;
      
      // Log performance metrics
      console.log(`[PERF] Company search with cursor pagination completed in ${executionTime}ms, found ${results.length} results`);
      
      // Add cache control and performance headers
      res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
      res.set('X-Response-Time', `${executionTime}ms`);
      res.set('X-Pagination-Type', 'cursor');
      
      // Send JSON response
      res.json({
        companies: results,
        pagination: paginationData.meta,
        links: paginationData.links,
        meta: {
          filters: req.query,
          executionTime: `${executionTime}ms`
        }
      });
    } else {
      // Fallback to traditional skip/limit pagination for backward compatibility
      const { skip, limit } = calculatePagination(req.query);
      
      // Execute query with pagination and sorting
      const companies = await Company.find(filter, null, { timeout: 30000 }) // Add 30s timeout
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Get total count for pagination
      const total = await Company.countDocuments(filter);
      
      // Calculate query execution time
      const executionTime = Date.now() - startTime;
      
      // Log performance metrics
      console.log(`[PERF] Company search with offset pagination completed in ${executionTime}ms, found ${total} results`);
      
      // Check performance against target (1 second)
      if (executionTime > 1000) {
        console.warn(`[WARN] Slow company search query: ${executionTime}ms, filters: ${JSON.stringify(filter)}`);
        
        // Recommend cursor pagination for slow queries
        if (parseInt(req.query.page || '1', 10) > 3) {
          console.warn('[WARN] Consider using cursor-based pagination for better performance');
        }
      }
      
      // Format the response
      const response = formatResponse(companies, req.query, total, executionTime);
      
      // Add cache control headers
      res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
      
      // Add performance header
      res.set('X-Response-Time', `${executionTime}ms`);
      res.set('X-Pagination-Type', 'offset');
      
      // Send JSON response
      res.json(response);
    }
  } catch (error) {
    console.error(`[ERROR] Company search failed: ${error.message}`);
    
    // Let the global error handler handle it
    throw error;
  }
});

/**
 * Get a single company by ID
 * @route GET /api/companies/:id
 */
export const getCompanyById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[API] GET /api/companies/${id}`);
    
    const startTime = Date.now();
    
    // Get the company data
    const company = await companyService.getCompanyById(id);
    
    // If company not found, return 404
    if (!company) {
      console.log(`[API] Company not found: ${id}`);
      throw new ApiError(`Company with ID ${id} not found`, 404);
    }
    
    // Get enrichment data if available
    const enrichment = await enrichmentService.getEnrichmentData(company);
    
    // Merge company with enrichment data
    const enrichedCompany = enrichmentService.mergeCompanyWithEnrichment(
      companyService.formatCompanyResponse(company), 
      enrichment
    );
    
    // Calculate if enrichment refresh is needed
    const needsRefresh = enrichmentService.shouldRefreshEnrichment(company);
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    console.log(`[PERF] Company retrieval for ${id} completed in ${executionTime}ms`);
    
    // Add cache control headers for individual companies
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.set('X-Response-Time', `${executionTime}ms`);
    
    // Add a header to indicate if enrichment refresh is needed
    res.set('X-Enrichment-Refresh-Needed', needsRefresh.toString());
    
    // Return the enhanced company data
    res.json({
      company: enrichedCompany,
      meta: {
        executionTime: `${executionTime}ms`,
        enrichmentAvailable: !!enrichment,
        needsRefresh
      }
    });
  } catch (error) {
    console.error(`[ERROR] Company retrieval failed: ${error.message}`);
    throw error;
  }
});

/**
 * Generate AI enrichment for a company
 * @route POST /api/companies/:id/enrich
 */
export const enrichCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();
  console.log(`[API] POST /api/companies/${id}/enrich - Starting enrichment process`);

  // 1. Get the company data
  const company = await Company.findOne({ id });
  if (!company) {
    console.log(`[API] Company not found for enrichment: ${id}`);
    throw new ApiError(`Company with ID ${id} not found`, 404);
  }

  // 2. Check for website URL or LinkedIn URL
  if (!company.website && !company.linkedin_url) {
    console.log(`[API] Company ${id} (${company.name}) has no website or LinkedIn URL. Cannot enrich.`);
    throw new ApiError(`Company ${id} has no website or LinkedIn URL for enrichment`, 422); // Unprocessable Entity
  }

  let scrapedContentData;
  let scrapeSource = 'cache';
  let errorDetails = null;
  let dataSource = company.website ? 'website' : 'linkedin';

  try {
    // Use website if available, otherwise try to use LinkedIn
    const primaryUrl = company.website || company.linkedin_url;
    const sourceType = company.website ? 'website' : 'linkedin';
    
    // 3. Check for recently scraped content in storage
    console.log(`[Enrich] Checking for cached scraped content for ${primaryUrl}`);
    const recentContent = await storageService.getScrapedContent(primaryUrl);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (recentContent && recentContent.scrapeDate > thirtyDaysAgo) {
      console.log(`[Enrich] Using cached content scraped on ${recentContent.scrapeDate.toISOString()}`);
      scrapedContentData = recentContent; // Use the stored content object
    } else {
      // 4. If no recent content, trigger web scraper
      scrapeSource = 'live_scrape';
      console.log(`[Enrich] No recent cached content found. Starting live scrape for ${primaryUrl} (type: ${sourceType})`);
      
      // Include LinkedIn URL if website is primary source
      const scrapeOptions = {
        saveToStorage: true,
        companyId: company.id,
        linkedinUrl: company.linkedin_url || null
      };
      
      // If LinkedIn is primary source, adjust behavior
      let scrapeTarget = primaryUrl;
      
      if (sourceType === 'linkedin') {
        console.log(`[Enrich] Using LinkedIn as primary source for ${company.name}`);
        scrapeOptions.isLinkedInPrimary = true;
        // For LinkedIn-only scraping we create a mock object for the website content
        // but include LinkedIn data from direct scraping
        const linkedInScrapeResult = await scraperService.scrapeLinkedInCompanyPage(primaryUrl);
        
        if (linkedInScrapeResult.error) {
          console.error(`[Enrich] LinkedIn scraping failed for ${primaryUrl}: ${linkedInScrapeResult.message || 'Unknown error'}`);
          throw new ApiError(`Failed to scrape LinkedIn profile: ${linkedInScrapeResult.message || 'Unknown error'}`, 500);
        }
        
        // Store LinkedIn data directly
        const mockWebsiteContent = {
          url: company.linkedin_url,
          title: `${company.name} - LinkedIn Profile`,
          mainContent: linkedInScrapeResult.description || `LinkedIn profile for ${company.name}`,
          aboutInfo: linkedInScrapeResult.description || '',
          productInfo: linkedInScrapeResult.specialties || '',
          teamInfo: '',
          contactInfo: '',
          linkedinData: linkedInScrapeResult,
          scrapedAt: new Date().toISOString(),
          duration: 0
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
        
        // Update status to processed
        await storageService.updateScrapedContentStatus(company.linkedin_url, 'processed');
        
        // Get the saved content
        scrapedContentData = await storageService.getScrapedContent(company.linkedin_url);
        if (!scrapedContentData) {
          throw new ApiError(`Failed to retrieve LinkedIn scraped content for ${company.name}`, 500);
        }
        
        console.log(`[Enrich] Successfully created content from LinkedIn data for ${company.name}`);
      } else {
        // Standard website scraping
        const scrapeResult = await scraperService.scrapeCompanyWebsite(scrapeTarget, scrapeOptions);

        if (scrapeResult.error) {
          console.warn(`[Enrich] Website scraping failed for ${scrapeTarget}: ${scrapeResult.error.message}`);
          
          // Website failed, check if LinkedIn URL exists as a fallback
          if (company.linkedin_url) {
            console.log(`[Enrich] Website scrape failed. Attempting fallback to LinkedIn: ${company.linkedin_url}`);
            scrapeSource = 'live_scrape_linkedin_fallback'; // Indicate fallback source
            dataSource = 'linkedin'; // Update dataSource
            
            const linkedInScrapeResult = await scraperService.scrapeLinkedInCompanyPage(company.linkedin_url);
            
            if (linkedInScrapeResult.error) {
              console.error(`[Enrich] Fallback LinkedIn scraping failed for ${company.linkedin_url}: ${linkedInScrapeResult.message || 'Unknown error'}`);
              // Both website and LinkedIn failed
              errorDetails = {
                message: `Failed to enrich "${company.name}". Could not access website (${scrapeTarget}) or LinkedIn profile (${company.linkedin_url}).`,
                category: 'no_enrichable_source',
                technicalDetails: `Website error: ${scrapeResult.error.message}; LinkedIn error: ${linkedInScrapeResult.message || 'Unknown error'}`
              };
              throw new ApiError(errorDetails.message, 500); // Throw combined failure
            } else {
              // LinkedIn fallback succeeded, construct content data
              console.log(`[Enrich] Fallback LinkedIn scrape successful for ${company.name}`);
              const mockWebsiteContent = {
                url: company.linkedin_url,
                title: `${company.name} - LinkedIn Profile`,
                 mainContent: linkedInScrapeResult.description || `LinkedIn profile for ${company.name}`,
                 aboutInfo: linkedInScrapeResult.description || '',
                 productInfo: linkedInScrapeResult.specialties || '',
                 teamInfo: '',
                 contactInfo: '',
                 linkedinData: linkedInScrapeResult,
                 scrapedAt: new Date().toISOString(),
                 duration: 0
              };
              // Save this synthesized content
              await storageService.saveScrapedContent(
                {
                  url: company.linkedin_url, // Save under LinkedIn URL for cache consistency
                  title: mockWebsiteContent.title,
                  mainContent: mockWebsiteContent.mainContent,
                  aboutInfo: mockWebsiteContent.aboutInfo,
                  productInfo: mockWebsiteContent.productInfo,
                  teamInfo: mockWebsiteContent.teamInfo,
                  contactInfo: mockWebsiteContent.contactInfo,
                  linkedinData: linkedInScrapeResult,
                  rawHtml: '' 
                },
                { statusCode: 200, scrapeDuration: 0, companyId: company.id }
              );
              await storageService.updateScrapedContentStatus(company.linkedin_url, 'processed');
              scrapedContentData = await storageService.getScrapedContent(company.linkedin_url);
              if (!scrapedContentData) {
                 throw new ApiError(`Failed to retrieve LinkedIn fallback content for ${company.name}`, 500);
              }
            }
          } else {
            // Website failed and no LinkedIn URL available
            console.error(`[Enrich] Website scraping failed for ${scrapeTarget} and no LinkedIn URL available.`);
            const errorCategory = scrapeResult.error.category || 'general_error';
            const userFriendlyMessages = {
              'website_access_denied': `The website for "${company.name}" (${scrapeTarget}) is blocking access. Enrichment requires website or LinkedIn access.`,
              'website_timeout': `The website for "${company.name}" (${scrapeTarget}) took too long to respond. Enrichment requires website or LinkedIn access.`,
              'website_not_found': `The website for "${company.name}" (${scrapeTarget}) could not be found. Enrichment requires a valid website or LinkedIn URL.`,
              'network_error': `A network error occurred while trying to access "${company.name}" website (${scrapeTarget}). Please check your connection and try again.`,
              'invalid_url': `The URL for "${company.name}" (${scrapeTarget}) appears to be invalid. Please update the company record with a valid website URL.`,
              'general_error': `An error occurred while scraping the website for "${company.name}" (${scrapeTarget}). No LinkedIn profile available as fallback.`
            };
            errorDetails = {
              message: userFriendlyMessages[errorCategory] || scrapeResult.error.message,
              category: errorCategory,
              technicalDetails: scrapeResult.error.message
            };
            throw new ApiError(`Failed to scrape ${sourceType} ${scrapeTarget}: ${scrapeResult.error.message}`, 500); // Throw original website error
          }
        } else {
           // Website scrape was successful
           console.log(`[Enrich] Live website scrape successful for ${scrapeTarget}`);
           scrapedContentData = await storageService.getScrapedContent(scrapeTarget);
           if (!scrapedContentData) {
             throw new ApiError(`Failed to retrieve newly scraped content for ${scrapeTarget}`, 500);
           }
        }
      }
    }

    // Ensure scrapedContentData is valid before proceeding
    if (!scrapedContentData) {
      throw new ApiError('Failed to obtain scraped content for enrichment', 500);
    }

    // 5. Call the LLM service to generate the summary
    console.log(`[Enrich] Calling LLM service for company ${id} using content from ${scrapeSource}`);
    try {
      const generatedSummary = await llmService.generateCompanySummary(
        company.toObject(), // Pass basic company data
        scrapedContentData.toObject() // Pass the scraped content object
      );

      // 6. Update the company with the actual enrichment result and timestamp
      console.log(`[Enrich] Storing generated summary for company ${id}`);
      company.enrichment = generatedSummary;
      company.last_enriched = new Date();
      await company.save();
      // Add confirmation logging
      logger.info(`[Enrich] Successfully saved enrichment for company ${id}. Last enriched: ${company.last_enriched}`);
      // Log the actual saved data for verification
      // logger.debug('[Enrich] Saved company data with enrichment:', company.toObject()); 

      const executionTime = Date.now() - startTime;
      console.log(`[API] Enrichment process for company ${id} completed in ${executionTime}ms`);

      // 7. Return 200 OK with the result (since it's synchronous for now)
      res.status(200).json({
        success: true,
        message: 'Company enrichment successful.',
        companyId: id,
        scrapeSource,
        dataSource,
        enrichment: {
          summary: company.enrichment,
          timestamp: company.last_enriched
        }
      });
    } catch (llmError) {
      // Handle LLM-specific errors
      // Log the full error object for better debugging
      console.error(`[ERROR] LLM service error for company ${id}:`, llmError);
      
      // Define LLM error categories and user-friendly messages
      let llmErrorCategory = 'llm_general_error';
      let userFriendlyMessage = `An error occurred while generating the AI summary for "${company.name}". Please try again later.`;
      
      // Map common LLM errors to categories
      if (llmError.message.includes('API key')) {
        llmErrorCategory = 'llm_auth_error';
        userFriendlyMessage = 'Authentication error with AI service. Please contact support.';
      } else if (llmError.message.includes('rate limit') || llmError.message.includes('quota')) {
        llmErrorCategory = 'llm_rate_limit';
        userFriendlyMessage = 'The AI service is currently experiencing high demand. Please try again later.';
      } else if (llmError.message.includes('timeout')) {
        llmErrorCategory = 'llm_timeout';
        userFriendlyMessage = 'The AI service took too long to respond. Please try again later.';
      } else if (llmError.message.includes('content policy') || llmError.message.includes('content filter')) {
        llmErrorCategory = 'llm_content_policy';
        userFriendlyMessage = 'The content could not be processed due to AI service content policies.';
      }
      
      errorDetails = {
        message: userFriendlyMessage,
        category: llmErrorCategory,
        technicalDetails: llmError.message,
        source: 'llm_service'
      };
      
      // Store partial results - the scraped content was successful
      // This allows resuming from scraping next time
      const executionTime = Date.now() - startTime;
      
      // Return error but include partial success info
      res.status(500).json({
        success: false,
        message: 'Content was successfully scraped, but AI summary generation failed.',
        error: errorDetails,
        companyId: id,
        scrapeSource,
        dataSource,
        partialSuccess: {
          scrapingCompleted: true,
          contentAvailable: true
        },
        executionTime
      });
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[ERROR] Company enrichment failed for ${id} after ${executionTime}ms: ${error.message}`, error.stack); // Add stack trace for better debugging

    // Prioritize using errorDetails if it was populated by a specific failure (e.g., scraping)
    const finalErrorDetails = errorDetails || {
      message: error.message || 'An unknown error occurred during enrichment.',
      category: error.cause?.category || (error instanceof ApiError ? 'api_error' : 'general_error'),
      technicalDetails: error.stack // Include stack trace in technical details
    };

    // Construct the detailed error response
    const detailedError = {
      success: false,
      message: finalErrorDetails.message, // Use the refined message
      error: finalErrorDetails, // Send the whole details object
      companyId: id,
      dataSource, // Include dataSource if available
      executionTime
    };

    // Send the detailed error response
    // Use the status code from ApiError if available, otherwise default to 500
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    res.status(statusCode).json(detailedError);
  }
}); 