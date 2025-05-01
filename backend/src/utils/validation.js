import Joi from 'joi';
import { ApiError } from './errorHandler.js';

/**
 * Validation schema for company search query parameters
 */
export const companySearchSchema = Joi.object({
  // Pagination parameters
  page: Joi.number().integer().min(1).default(1)
    .description('Page number, starting from 1'),
  limit: Joi.number().integer().min(1).max(100).default(10)
    .description('Number of results per page (max 100)'),
  
  // Filter parameters
  industry: Joi.string().trim()
    .description('Filter by industry name (case insensitive)'),
  country: Joi.string().trim()
    .description('Filter by country name (case insensitive)'),
  region: Joi.string().trim()
    .description('Filter by region name (case insensitive)'),
  locality: Joi.string().trim()
    .description('Filter by locality/city name (case insensitive)'),
  size: Joi.string().trim()
    .description('Filter by company size category (e.g., "1-10", "11-50")'),
  founded: Joi.alternatives().try(
    Joi.number().integer().min(1800).max(new Date().getFullYear()),
    Joi.string().pattern(/^\d{4}$/)
  ).description('Filter by founding year'),
  foundedMin: Joi.number().integer().min(1800).max(new Date().getFullYear())
    .description('Filter by minimum founding year'),
  foundedMax: Joi.number().integer().min(1800).max(new Date().getFullYear())
    .description('Filter by maximum founding year'),
  
  // Free text search
  query: Joi.string().trim()
    .description('Text search across name, industry, and location fields'),
  
  // Sorting parameters
  sort: Joi.string().default('name')
    .valid('name', 'industry', 'country', 'founded', 'size')
    .description('Field to sort results by'),
  order: Joi.string().default('asc')
    .valid('asc', 'desc')
    .description('Sort order (ascending or descending)')
}).unknown(false);

/**
 * Validate company ID parameter
 */
export const companyIdSchema = Joi.object({
  id: Joi.string().required()
    .min(10).max(50) // Typical length of IDs in the database
    .pattern(/^[a-zA-Z0-9]+$/) // Alphanumeric characters only
    .description('Company unique identifier')
});

/**
 * Company response schema for documentation
 * This schema represents what a company object looks like in API responses
 */
export const companyResponseSchema = {
  id: Joi.string().required().description('Unique company identifier'),
  name: Joi.string().required().description('Company name'),
  website: Joi.string().allow(null, '').description('Company website URL'),
  industry: Joi.string().allow(null, '').description('Industry sector'),
  founded: Joi.number().integer().allow(null).description('Year founded'),
  size: Joi.string().allow(null, '').description('Company size range (e.g., "1-10", "11-50")'),
  locality: Joi.string().allow(null, '').description('City/locality'),
  region: Joi.string().allow(null, '').description('State/province/region'),
  country: Joi.string().allow(null, '').description('Country'),
  linkedin_url: Joi.string().allow(null, '').description('LinkedIn profile URL'),
  enrichment: Joi.string().allow(null, '').description('AI-generated enrichment data'),
  last_enriched: Joi.date().allow(null).description('Date of last enrichment'),
  createdAt: Joi.date().description('Record creation timestamp'),
  updatedAt: Joi.date().description('Record last update timestamp')
};

/**
 * Middleware to validate request query parameters
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('query', 'params', 'body')
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema, property = 'query') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new ApiError(`Validation error: ${message}`, 400));
    }
    
    // Replace request property with validated value
    req[property] = value;
    return next();
  };
}; 