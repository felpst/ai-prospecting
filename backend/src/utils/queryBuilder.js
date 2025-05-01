/**
 * Query Builder for MongoDB queries
 * Helps build optimized queries for the companies collection
 */

/**
 * Build a MongoDB filter object from search parameters
 * @param {Object} params - Search parameters from request
 * @returns {Object} MongoDB filter object
 */
export const buildCompanyFilter = (params) => {
  const {
    industry,
    country,
    region,
    locality,
    size,
    founded,
    foundedMin,
    foundedMax,
    query
  } = params;

  const filter = {};
  
  // Apply text filters (case-insensitive for better matching)
  if (industry) filter.industry = new RegExp(industry, 'i');
  if (country) filter.country = new RegExp(country, 'i');
  if (region) filter.region = new RegExp(region, 'i');
  if (locality) filter.locality = new RegExp(locality, 'i');
  
  // Size is an exact match filter
  if (size) filter.size = size;
  
  // Apply founding year filter (exact or range)
  if (founded) {
    filter.founded = parseInt(founded, 10);
  } else {
    // Handle range filters for founding year
    if (foundedMin || foundedMax) {
      filter.founded = {};
      if (foundedMin) filter.founded.$gte = parseInt(foundedMin, 10);
      if (foundedMax) filter.founded.$lte = parseInt(foundedMax, 10);
    }
  }
  
  // Apply text search if query is provided
  if (query) {
    filter.$text = { $search: query };
  }
  
  return filter;
};

/**
 * Build MongoDB sort options from request parameters
 * @param {Object} params - Sort parameters from request
 * @returns {Object} MongoDB sort options
 */
export const buildSortOptions = (params) => {
  const { sort = 'name', order = 'asc' } = params;
  
  const sortOptions = {};
  sortOptions[sort] = order === 'desc' ? -1 : 1;
  
  // When using text search, sort by text score first if available
  if (params.query) {
    return { score: { $meta: 'textScore' }, ...sortOptions };
  }
  
  return sortOptions;
};

/**
 * Calculate pagination values
 * @param {Object} params - Pagination parameters from request
 * @returns {Object} Skip and limit values for MongoDB
 */
export const calculatePagination = (params) => {
  const { page = 1, limit = 10 } = params;
  
  const skip = (page - 1) * limit;
  
  return { skip, limit };
};

/**
 * Format the API response
 * @param {Array} data - Query results
 * @param {Object} params - Request parameters
 * @param {number} total - Total count of matching documents
 * @param {number} executionTime - Query execution time in ms
 * @returns {Object} Formatted API response
 */
export const formatResponse = (data, params, total, executionTime) => {
  const { page = 1, limit = 10 } = params;
  
  return {
    companies: data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    meta: {
      filters: {
        industry: params.industry,
        country: params.country,
        region: params.region,
        locality: params.locality,
        size: params.size,
        founded: params.founded,
        foundedMin: params.foundedMin,
        foundedMax: params.foundedMax,
        query: params.query
      },
      sort: {
        field: params.sort || 'name',
        order: params.order || 'asc'
      },
      executionTime: `${executionTime}ms`
    }
  };
}; 