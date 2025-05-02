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
  
  // Apply exact match filters when possible for better index usage
  if (industry) {
    // If exact match is indicated with a prefixed '=' or contains no special chars
    if (industry.startsWith('=') || !/[*?^$()[\]{}|\\]/.test(industry)) {
      // Use exact match for better performance with indexes
      filter.industry = industry.startsWith('=') ? industry.substring(1) : industry;
    } else {
      // Fall back to case-insensitive regex when needed
      filter.industry = new RegExp(industry.replace(/[*?^$()[\]{}|\\]/g, '\\$&'), 'i');
    }
  }
  
  // Apply same optimization to other text fields
  if (country) {
    if (country.startsWith('=') || !/[*?^$()[\]{}|\\]/.test(country)) {
      filter.country = country.startsWith('=') ? country.substring(1) : country;
    } else {
      filter.country = new RegExp(country.replace(/[*?^$()[\]{}|\\]/g, '\\$&'), 'i');
    }
  }
  
  if (region) {
    if (region.startsWith('=') || !/[*?^$()[\]{}|\\]/.test(region)) {
      filter.region = region.startsWith('=') ? region.substring(1) : region;
    } else {
      filter.region = new RegExp(region.replace(/[*?^$()[\]{}|\\]/g, '\\$&'), 'i');
    }
  }
  
  if (locality) {
    if (locality.startsWith('=') || !/[*?^$()[\]{}|\\]/.test(locality)) {
      filter.locality = locality.startsWith('=') ? locality.substring(1) : locality;
    } else {
      filter.locality = new RegExp(locality.replace(/[*?^$()[\]{}|\\]/g, '\\$&'), 'i');
    }
  }
  
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
  if (query && query.trim()) {
    // Use MongoDB text search for better performance
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
  
  // Special handling for text score sorting
  if (params.query && params.query.trim() && sort === 'relevance') {
    // Sort by text score for better relevance
    return { score: { $meta: 'textScore' } };
  }
  
  sortOptions[sort] = order === 'desc' ? -1 : 1;
  
  // When using text search, optionally include text score
  if (params.query && params.query.trim() && params.includeScore === 'true') {
    return { ...sortOptions, score: { $meta: 'textScore' } };
  }
  
  // Always include _id in sort to ensure consistent ordering with pagination
  if (sort !== '_id') {
    sortOptions._id = 1;
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
  
  // Ensure page is at least 1
  const pageNum = Math.max(1, parseInt(page, 10));
  
  // Limit the max number of results per page to prevent excessive memory usage
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 100);
  
  const skip = (pageNum - 1) * limitNum;
  
  return { skip, limit: limitNum };
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
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const totalPages = Math.ceil(total / limitNum);
  
  // Generate pagination links
  const links = {};
  
  // Base URL for pagination links (would need req object in real implementation)
  const baseUrl = '/api/companies';
  
  // Create query string without page parameter
  const queryParams = { ...params };
  delete queryParams.page;
  
  const queryString = Object.entries(queryParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  // Add pagination links
  if (pageNum > 1) {
    links.prev = `${baseUrl}?page=${pageNum - 1}&${queryString}`;
    links.first = `${baseUrl}?page=1&${queryString}`;
  }
  
  if (pageNum < totalPages) {
    links.next = `${baseUrl}?page=${pageNum + 1}&${queryString}`;
    links.last = `${baseUrl}?page=${totalPages}&${queryString}`;
  }
  
  return {
    companies: data,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: totalPages
    },
    links,
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