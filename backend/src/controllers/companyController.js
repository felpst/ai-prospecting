import Company from '../models/company.js';
import { ApiError, asyncHandler } from '../utils/errorHandler.js';
import { 
  buildCompanyFilter, 
  buildSortOptions, 
  calculatePagination, 
  formatResponse 
} from '../utils/queryBuilder.js';
import * as companyService from '../services/companyService.js';
import * as enrichmentService from '../services/enrichmentService.js';

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
    
    // Build filter, sort options, and pagination
    const filter = buildCompanyFilter(req.query);
    const sortOptions = buildSortOptions(req.query);
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
    console.log(`[PERF] Company search completed in ${executionTime}ms, found ${total} results`);
    
    // Check performance against target (1 second)
    if (executionTime > 1000) {
      console.warn(`[WARN] Slow company search query: ${executionTime}ms, filters: ${JSON.stringify(filter)}`);
    }
    
    // Format the response
    const response = formatResponse(companies, req.query, total, executionTime);
    
    // Add cache control headers
    res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
    
    // Add performance header
    res.set('X-Response-Time', `${executionTime}ms`);
    
    // Send JSON response
    res.json(response);
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
  try {
    const { id } = req.params;
    
    console.log(`[API] POST /api/companies/${id}/enrich`);
    
    // Get the company
    const company = await Company.findOne({ id });
    
    if (!company) {
      console.log(`[API] Company not found for enrichment: ${id}`);
      throw new ApiError(`Company with ID ${id} not found`, 404);
    }

    // TODO: Implement actual enrichment with web scraping and AI in a future task
    // For now, we'll just return a placeholder response
    
    // Update the company with a placeholder enrichment
    company.enrichment = `This is a placeholder AI-generated summary for ${company.name}. The actual implementation will be added in a future task.`;
    company.last_enriched = new Date();
    
    await company.save();
    
    console.log(`[API] Enrichment completed for company: ${id}`);
    
    res.json({
      message: 'Company enriched successfully',
      company
    });
  } catch (error) {
    console.error(`[ERROR] Company enrichment failed: ${error.message}`);
    throw error;
  }
}); 