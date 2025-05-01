import Company from '../models/company.js';
import { ApiError, asyncHandler } from '../utils/errorHandler.js';

/**
 * Get paginated companies with filters
 * @route GET /api/companies
 */
export const getCompanies = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10,
    industry,
    country,
    region,
    locality,
    size,
    query
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;
  
  // Build filter
  const filter = {};
  
  if (industry) filter.industry = industry;
  if (country) filter.country = country;
  if (region) filter.region = region;
  if (locality) filter.locality = locality;
  if (size) filter.size = size;
  
  // Text search if query is provided
  if (query) {
    filter.$text = { $search: query };
  }
  
  // Execute query with pagination
  const companies = await Company.find(filter)
    .skip(skip)
    .limit(limitNum)
    .lean();
  
  // Get total count for pagination
  const total = await Company.countDocuments(filter);
  
  res.json({
    companies,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  });
});

/**
 * Get a single company by ID
 * @route GET /api/companies/:id
 */
export const getCompanyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const company = await Company.findOne({ id }).lean();
  
  if (!company) {
    throw new ApiError(`Company with ID ${id} not found`, 404);
  }
  
  res.json(company);
});

/**
 * Generate AI enrichment for a company
 * @route POST /api/companies/:id/enrich
 */
export const enrichCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Get the company
  const company = await Company.findOne({ id });
  
  if (!company) {
    throw new ApiError(`Company with ID ${id} not found`, 404);
  }

  // TODO: Implement actual enrichment with web scraping and AI in a future task
  // For now, we'll just return a placeholder response
  
  // Update the company with a placeholder enrichment
  company.enrichment = `This is a placeholder AI-generated summary for ${company.name}. The actual implementation will be added in a future task.`;
  company.last_enriched = new Date();
  
  await company.save();
  
  res.json({
    message: 'Company enriched successfully',
    company
  });
}); 