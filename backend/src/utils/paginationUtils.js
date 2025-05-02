/**
 * Pagination Utilities
 * 
 * This module provides utilities for implementing efficient pagination strategies
 * for MongoDB, including cursor-based pagination which performs better than
 * skip/limit for large datasets.
 */

/**
 * Extract cursor information from request parameters
 * @param {Object} req - Express request object
 * @returns {Object} Cursor information
 */
export function extractCursorInfo(req) {
  const {
    next_cursor = null,
    prev_cursor = null,
    limit = 10
  } = req.query;
  
  return {
    nextCursor: next_cursor,
    prevCursor: prev_cursor,
    limit: parseInt(limit, 10)
  };
}

/**
 * Create cursor-based query for forward pagination
 * @param {Object} model - Mongoose model
 * @param {Object} filter - Query filter conditions
 * @param {Object} sortOptions - Sort options ({ field: 1|-1 })
 * @param {Object} cursorInfo - Cursor information
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Query results with pagination metadata
 */
export async function cursorPaginate(model, filter = {}, sortOptions = { _id: 1 }, cursorInfo = {}, options = {}) {
  // Destructure parameters with defaults
  const { 
    nextCursor = null,
    prevCursor = null,
    limit = 10
  } = cursorInfo;
  
  // Ensure valid limit
  const validLimit = Math.min(Math.max(1, limit), 100); // Between 1 and 100
  
  // Need to determine the primary sort field for cursor
  const sortFields = Object.keys(sortOptions);
  if (sortFields.length === 0) {
    sortFields.push('_id');
    sortOptions._id = 1;
  }
  const primarySortField = sortFields[0];
  const sortDirection = sortOptions[primarySortField] === -1 ? -1 : 1;
  
  // Clone the original filter to avoid modifying it
  const queryFilter = { ...filter };
  
  // Direction (1 for forward, -1 for backward)
  const direction = prevCursor ? -1 : 1;
  
  // Handle cursor-based conditions
  if (nextCursor || prevCursor) {
    const cursor = nextCursor || prevCursor;
    
    try {
      // Decode and parse the cursor
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      const cursorValue = decodedCursor.value;
      const cursorId = decodedCursor.id;
      
      // Create the cursor query condition
      if (direction === 1) {
        // Next page: find documents after the cursor
        if (sortDirection === 1) {
          // Ascending order
          queryFilter.$or = [
            { [primarySortField]: { $gt: cursorValue } },
            { 
              [primarySortField]: cursorValue,
              _id: { $gt: cursorId }
            }
          ];
        } else {
          // Descending order
          queryFilter.$or = [
            { [primarySortField]: { $lt: cursorValue } },
            { 
              [primarySortField]: cursorValue,
              _id: { $gt: cursorId }
            }
          ];
        }
      } else {
        // Previous page: find documents before the cursor
        if (sortDirection === 1) {
          // Ascending order
          queryFilter.$or = [
            { [primarySortField]: { $lt: cursorValue } },
            { 
              [primarySortField]: cursorValue,
              _id: { $lt: cursorId }
            }
          ];
        } else {
          // Descending order
          queryFilter.$or = [
            { [primarySortField]: { $gt: cursorValue } },
            { 
              [primarySortField]: cursorValue,
              _id: { $lt: cursorId }
            }
          ];
        }
      }
    } catch (error) {
      console.error('Invalid cursor format:', error);
      // Invalid cursor, proceed without cursor conditions
    }
  }
  
  // Execute query
  let query = model.find(queryFilter);
  
  // Sort in the right direction
  if (direction === -1) {
    // Invert the sort for previous page
    const invertedSort = {};
    for (const field of sortFields) {
      invertedSort[field] = sortOptions[field] * -1;
    }
    query = query.sort(invertedSort);
  } else {
    query = query.sort(sortOptions);
  }
  
  // Apply limit
  query = query.limit(validLimit + 1); // +1 to determine if there are more pages
  
  // Apply projection if provided
  if (options.projection) {
    query = query.select(options.projection);
  }
  
  // Add lean option for better performance when appropriate
  if (options.lean !== false) {
    query = query.lean();
  }
  
  // Execute the query
  let documents = await query.exec();
  
  // Determine if there are more results
  const hasMore = documents.length > validLimit;
  
  // Remove the extra document if we fetched one to check for more pages
  if (hasMore) {
    documents = documents.slice(0, validLimit);
  }
  
  // If we fetched the previous page, reverse the documents to get correct order
  if (direction === -1) {
    documents = documents.reverse();
  }
  
  // Skip total count by default for performance, unless explicitly requested
  let totalCount = undefined;
  if (options.count) {
    totalCount = await model.countDocuments(filter).exec();
  }
  
  // Create cursors for pagination
  let nextPageCursor = null;
  let prevPageCursor = null;
  
  if (documents.length > 0) {
    // Generate the next cursor if we have more results
    if (hasMore) {
      const lastDoc = documents[documents.length - 1];
      nextPageCursor = Buffer.from(
        JSON.stringify({
          value: lastDoc[primarySortField],
          id: lastDoc._id.toString()
        })
      ).toString('base64');
    }
    
    // Generate the previous cursor if we're not on the first page
    if (nextCursor || prevCursor) {
      const firstDoc = documents[0];
      prevPageCursor = Buffer.from(
        JSON.stringify({
          value: firstDoc[primarySortField],
          id: firstDoc._id.toString()
        })
      ).toString('base64');
    }
  }
  
  return {
    results: documents,
    pagination: {
      next_cursor: nextPageCursor,
      prev_cursor: prevPageCursor,
      has_more: hasMore,
      limit: validLimit,
      count: totalCount
    }
  };
}

/**
 * Format pagination links for API response
 * @param {Object} req - Express request object
 * @param {Object} pagination - Pagination metadata
 * @returns {Object} Formatted pagination links and metadata
 */
export function formatPaginationLinks(req, pagination) {
  const { next_cursor, prev_cursor, has_more, limit, count } = pagination;
  
  // Base URL
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  
  // Current query parameters
  const query = { ...req.query };
  
  // Format links
  const links = {};
  
  // Next page link
  if (next_cursor) {
    const nextQuery = { ...query, next_cursor, prev_cursor: null };
    delete nextQuery.page; // Remove old pagination params if present
    const queryString = new URLSearchParams(nextQuery).toString();
    links.next = `${baseUrl}?${queryString}`;
  }
  
  // Previous page link
  if (prev_cursor) {
    const prevQuery = { ...query, prev_cursor, next_cursor: null };
    delete prevQuery.page; // Remove old pagination params if present
    const queryString = new URLSearchParams(prevQuery).toString();
    links.prev = `${baseUrl}?${queryString}`;
  }
  
  // First page link
  const firstQuery = { ...query };
  delete firstQuery.prev_cursor;
  delete firstQuery.next_cursor;
  delete firstQuery.page;
  const firstQueryString = new URLSearchParams(firstQuery).toString();
  links.first = `${baseUrl}?${firstQueryString}`;
  
  return {
    links,
    meta: {
      has_more,
      limit,
      count
    }
  };
}

/**
 * Determine if cursor-based pagination should be used
 * @param {Object} params - Request parameters
 * @returns {boolean} True if cursor-based pagination should be used
 */
export function shouldUseCursorPagination(params) {
  // Use cursor pagination if a cursor is provided
  if (params.next_cursor || params.prev_cursor) {
    return true;
  }
  
  // Use cursor pagination for large page numbers
  const page = parseInt(params.page || '1', 10);
  if (page > 5) {
    return true;
  }
  
  // Use cursor pagination for specific sort fields that benefit from it
  if (params.sort && ['name', 'founded'].includes(params.sort)) {
    return true;
  }
  
  return false;
}

/**
 * Convert from offset-based pagination params to cursor-based params
 * This is a helper function to maintain backward compatibility
 * 
 * @param {Object} params - Request parameters with page/limit
 * @param {Array} results - Previous results to use for cursor generation
 * @returns {Object} Updated parameters with cursor information
 */
export function convertToCursorParams(params, results = []) {
  // If we don't have results, we can't generate a cursor
  if (!results.length) {
    return params;
  }
  
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '10', 10);
  
  // Only convert if we're past page 1
  if (page <= 1) {
    return params;
  }
  
  // Generate a cursor from the last result
  const lastItem = results[results.length - 1];
  
  // Determine sort field
  const sortField = params.sort || '_id';
  
  // Generate cursor
  const cursor = Buffer.from(
    JSON.stringify({
      value: lastItem[sortField],
      id: lastItem._id.toString()
    })
  ).toString('base64');
  
  // Update params
  const newParams = { ...params };
  delete newParams.page; // Remove page parameter
  newParams.next_cursor = cursor;
  
  return newParams;
} 