/**
 * Search Service
 * 
 * This service provides optimized search functionality using MongoDB's aggregation pipeline
 * and text search features for better performance and relevance.
 */

import Company from '../models/company.js';
import { shouldUseCursorPagination, cursorPaginate, extractCursorInfo } from '../utils/paginationUtils.js';

/**
 * Perform optimized text search using MongoDB's aggregation pipeline
 * 
 * @param {Object} searchParams - Search parameters
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Search results with pagination metadata
 */
export async function searchCompanies(searchParams, options = {}) {
  const startTime = Date.now();
  const {
    query,
    industry,
    country,
    region,
    locality,
    size,
    founded,
    foundedMin,
    foundedMax,
    sort = 'score',
    order = 'desc',
    limit = 10,
    next_cursor,
    prev_cursor
  } = searchParams;
  
  // Use aggregation pipeline for better performance and flexibility
  const pipeline = [];
  
  // Match stage for text search if a query is provided
  if (query && query.trim()) {
    pipeline.push({
      $match: {
        $text: { $search: query }
      }
    });
    
    // Add text score for sorting by relevance
    pipeline.push({
      $addFields: {
        score: { $meta: 'textScore' }
      }
    });
  }
  
  // Add filters to the match stage
  const filterMatch = {};
  
  if (industry) filterMatch.industry = { $regex: new RegExp(industry, 'i') };
  if (country) filterMatch.country = { $regex: new RegExp(country, 'i') };
  if (region) filterMatch.region = { $regex: new RegExp(region, 'i') };
  if (locality) filterMatch.locality = { $regex: new RegExp(locality, 'i') };
  if (size) filterMatch.size = size;
  
  // Handle founded year (exact or range)
  if (founded) {
    filterMatch.founded = parseInt(founded, 10);
  } else if (foundedMin || foundedMax) {
    filterMatch.founded = {};
    if (foundedMin) filterMatch.founded.$gte = parseInt(foundedMin, 10);
    if (foundedMax) filterMatch.founded.$lte = parseInt(foundedMax, 10);
  }
  
  // Add cursor-based conditions if using cursor pagination
  if (next_cursor || prev_cursor) {
    try {
      const cursor = next_cursor || prev_cursor;
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      const cursorField = decodedCursor.field || sort;
      const cursorValue = decodedCursor.value;
      const cursorId = decodedCursor.id;
      const direction = next_cursor ? 1 : -1;
      const sortDirection = order === 'desc' ? -1 : 1;
      
      // Create appropriate cursor condition based on sort direction and pagination direction
      const cursorCondition = {};
      if (direction * sortDirection > 0) {
        // Moving forward in the same direction as sort
        cursorCondition.$or = [
          { [cursorField]: { $gt: cursorValue } },
          { 
            [cursorField]: cursorValue,
            _id: { $gt: cursorId }
          }
        ];
      } else {
        // Moving backward or against the sort direction
        cursorCondition.$or = [
          { [cursorField]: { $lt: cursorValue } },
          { 
            [cursorField]: cursorValue,
            _id: { $lt: cursorId }
          }
        ];
      }
      
      pipeline.push({ $match: cursorCondition });
    } catch (error) {
      console.error('Invalid cursor format:', error);
    }
  }
  
  // Add filter match if there are any filters
  if (Object.keys(filterMatch).length > 0) {
    pipeline.push({ $match: filterMatch });
  }
  
  // Sort stage
  const sortStage = {};
  
  // Special handling for score sorting
  if (sort === 'score' && query) {
    sortStage.score = order === 'desc' ? -1 : 1;
  } else if (sort === 'name') {
    sortStage.name = order === 'desc' ? -1 : 1;
  } else if (sort === 'founded') {
    sortStage.founded = order === 'desc' ? -1 : 1;
  } else {
    // Default sort
    sortStage[sort] = order === 'desc' ? -1 : 1;
  }
  
  // Always include _id in sort to ensure consistent ordering
  sortStage._id = 1;
  
  pipeline.push({ $sort: sortStage });
  
  // Limit stage (fetch one extra to check if there are more results)
  pipeline.push({ $limit: parseInt(limit, 10) + 1 });
  
  // Execute the aggregation
  const results = await Company.aggregate(pipeline);
  
  // Determine if there are more results
  const hasMore = results.length > limit;
  
  // Remove the extra document if we fetched one to check for more pages
  if (hasMore) {
    results.pop();
  }
  
  // Generate pagination cursors
  let nextPageCursor = null;
  let prevPageCursor = null;
  
  if (results.length > 0) {
    // Generate next cursor if we have more results
    if (hasMore) {
      const lastResult = results[results.length - 1];
      const cursorData = {
        field: sort,
        value: lastResult[sort],
        id: lastResult._id.toString()
      };
      nextPageCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }
    
    // Generate previous cursor if we're not on the first page
    if (next_cursor || prev_cursor) {
      const firstResult = results[0];
      const cursorData = {
        field: sort,
        value: firstResult[sort],
        id: firstResult._id.toString()
      };
      prevPageCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }
  }
  
  // Total count (optional for performance reasons)
  let totalCount;
  if (options.count) {
    // Create a count pipeline that only includes the match stages
    const countPipeline = pipeline.filter(stage => 
      stage.$match && !stage.$match.$or // Exclude cursor-based conditions
    );
    
    countPipeline.push({ $count: 'total' });
    
    const countResult = await Company.aggregate(countPipeline);
    totalCount = countResult.length > 0 ? countResult[0].total : 0;
  }
  
  const executionTime = Date.now() - startTime;
  
  return {
    results,
    pagination: {
      next_cursor: nextPageCursor,
      prev_cursor: prevPageCursor,
      has_more: hasMore,
      limit: parseInt(limit, 10),
      count: totalCount
    },
    meta: {
      executionTime
    }
  };
}

/**
 * Execute a faceted search using MongoDB's aggregation framework
 * Significantly more efficient than running multiple queries
 * 
 * @param {Object} params - Search parameters
 * @param {Array<string>} facetFields - Fields to generate facets for
 * @returns {Promise<Object>} Search results with facets
 */
export async function facetedSearch(params, facetFields = ['country', 'industry', 'size']) {
  const { industry, query } = params;
  const limit = parseInt(params.limit || 10, 10);
  
  // Build match stage based on params
  const matchStage = {};
  
  if (industry) {
    matchStage.industry = new RegExp(industry, 'i');
  }
  
  if (query) {
    matchStage.$text = { $search: query };
  }
  
  // Build facet configuration
  const facets = {};
  
  // Add results facet
  facets.results = [
    { $match: matchStage },
    { $sort: query ? { score: { $meta: 'textScore' } } : { name: 1 } },
    { $limit: limit + 1 } // Get one extra to check if there are more results
  ];
  
  // Add count facet
  facets.count = [
    { $match: matchStage },
    { $count: 'total' }
  ];
  
  // Add facets for each requested field
  for (const field of facetFields) {
    // Skip if field is not valid
    if (!['country', 'industry', 'size', 'region', 'locality'].includes(field)) {
      continue;
    }
    
    facets[field] = [
      { $match: matchStage },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } }, // Filter out null values
      { $sort: { count: -1 } },
      { $limit: 10 }
    ];
  }
  
  // Execute aggregation with facets
  const [result] = await Company.aggregate([
    { $facet: facets }
  ]).exec();
  
  // Determine if there are more results
  const hasMore = Array.isArray(result.results) && result.results.length > limit;
  
  // Format the response
  const formattedResponse = {
    results: result.results.slice(0, limit),
    total: result.count[0]?.total || 0,
    pagination: {
      has_more: hasMore,
      limit
    },
    facets: {}
  };
  
  // Format facets
  for (const field of facetFields) {
    if (result[field]) {
      formattedResponse.facets[field] = result[field].map(item => ({
        value: item._id,
        count: item.count
      }));
    }
  }
  
  return formattedResponse;
}

/**
 * Execute a search query with optimized configuration
 * 
 * @param {Object} params - Search parameters
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Search results with metadata
 */
export async function executeSearch(params, options = {}) {
  // If facets are requested, use faceted search
  if (params.includeFacets) {
    return await facetedSearch(params, options.facetFields);
  }
  
  // If exact ID lookup
  if (params.id) {
    const company = await Company.findOne({ id: params.id }).lean();
    return { result: company };
  }
  
  // Use searchCompanies for other queries
  return await searchCompanies(params, options);
} 