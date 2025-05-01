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
    .description('Company unique identifier')
});

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