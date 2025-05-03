import Company from '../models/company.js';
import { logger } from '../utils/logger.js';
import { getDatabaseConnection } from '../config/database.js';

/**
 * Company Service
 * Handles data access operations for companies
 */

/**
 * Get a single company by ID
 * @param {string} id - The company ID
 * @returns {Promise<Object|null>} The company data or null if not found
 */
export const getCompanyById = async (id) => {
  try {
    const company = await Company.findOne({ id });
    return company;
  } catch (error) {
    console.error(`Error fetching company ID ${id}:`, error);
    throw error;
  }
};

/**
 * Get a company by alternative identifier (MongoDB _id)
 * @param {string} mongoId - MongoDB ObjectId as string
 * @returns {Promise<Object|null>} The company data or null if not found
 */
export const getCompanyByMongoId = async (mongoId) => {
  try {
    const company = await Company.findById(mongoId).lean();
    return company;
  } catch (error) {
    console.error(`Error fetching company by MongoDB ID ${mongoId}:`, error);
    throw error;
  }
};

/**
 * Format company data for API response
 * @param {Object} company - Raw company data from database
 * @returns {Object} Formatted company data
 */
export const formatCompanyResponse = (company) => {
  if (!company) return null;
  
  // Create return object with formatted data
  const formattedCompany = {
    ...company,
    location: company.locality || company.region || company.country ? 
      [company.locality, company.region, company.country].filter(Boolean).join(', ') : null,
    hasEnrichment: !!company.enrichment
  };
  
  return formattedCompany;
};

/**
 * Finds a company by its domain.
 * @param {string} domain - Company domain to search for.
 * @returns {Promise<Object|null>} Company object if found, null otherwise.
 */
export const findCompanyByDomain = async (domain) => {
  if (!domain) {
    logger.warn('Invalid domain provided for company lookup');
    return null;
  }
  
  const normalizedDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  try {
    const db = await getDatabaseConnection();
    const collection = db.collection('companies');
    
    // Try to match by exact domain
    let company = await collection.findOne({
      $or: [
        { domain: normalizedDomain },
        { domain: `www.${normalizedDomain}` },
        { domain: normalizedDomain.replace(/^www\./, '') }
      ]
    });
    
    // If no exact match, try to match by website containing the domain
    if (!company) {
      company = await collection.findOne({
        website: { $regex: normalizedDomain, $options: 'i' }
      });
    }
    
    if (company) {
      logger.debug(`Found company by domain: ${domain}`);
    } else {
      logger.debug(`No company found for domain: ${domain}`);
    }
    
    return company;
  } catch (error) {
    logger.error(`Error finding company by domain ${domain}: ${error.message}`);
    throw error;
  }
};

/**
 * Finds a company by its exact name.
 * @param {string} name - Company name to search for.
 * @returns {Promise<Object|null>} Company object if found, null otherwise.
 */
export const findCompanyByExactName = async (name) => {
  if (!name) {
    logger.warn('Invalid name provided for company lookup');
    return null;
  }
  
  const normalizedName = name.trim();
  
  try {
    const db = await getDatabaseConnection();
    const collection = db.collection('companies');
    
    // Case-insensitive exact match
    const company = await collection.findOne({
      name: { $regex: `^${normalizedName}$`, $options: 'i' }
    });
    
    if (company) {
      logger.debug(`Found company by exact name: ${name}`);
    } else {
      logger.debug(`No company found for exact name: ${name}`);
    }
    
    return company;
  } catch (error) {
    logger.error(`Error finding company by exact name ${name}: ${error.message}`);
    throw error;
  }
};

/**
 * Retrieves all companies with optional filtering and pagination.
 * @param {Object} options - Query options (limit, skip, filter).
 * @returns {Promise<Array<Object>>} Array of company objects.
 */
export const getAllCompanies = async (options = {}) => {
  const { limit = 1000, skip = 0, filter = {} } = options;
  
  try {
    const db = await getDatabaseConnection();
    const collection = db.collection('companies');
    
    const companies = await collection.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    logger.debug(`Retrieved ${companies.length} companies`);
    
    return companies;
  } catch (error) {
    logger.error(`Error retrieving companies: ${error.message}`);
    throw error;
  }
};

/**
 * Searches for companies based on provided parameters.
 * @param {Object} params - Search parameters.
 * @param {Object} options - Query options (limit, skip).
 * @returns {Promise<Object>} Search results with pagination info.
 */
export const searchCompanies = async (params, options = {}) => {
  const { limit = 20, skip = 0 } = options;
  
  // Build query from parameters
  const query = {};
  
  if (params.industry) {
    query.industry = { $regex: params.industry, $options: 'i' };
  }
  
  if (params.country) {
    query['location.country'] = { $regex: params.country, $options: 'i' };
  }
  
  if (params.region) {
    query['location.region'] = { $regex: params.region, $options: 'i' };
  }
  
  if (params.locality) {
    query['location.city'] = { $regex: params.locality, $options: 'i' };
  }
  
  if (params.size) {
    query.size = { $regex: params.size, $options: 'i' };
  }
  
  if (params.founded) {
    query.foundingYear = parseInt(params.founded, 10);
  } else if (params.foundedMin || params.foundedMax) {
    query.foundingYear = {};
    if (params.foundedMin) {
      query.foundingYear.$gte = parseInt(params.foundedMin, 10);
    }
    if (params.foundedMax) {
      query.foundingYear.$lte = parseInt(params.foundedMax, 10);
    }
  }
  
  // Add general text search if provided
  if (params.query) {
    query.$text = { $search: params.query };
  }
  
  try {
    const db = await getDatabaseConnection();
    const collection = db.collection('companies');
    
    // Determine sort order
    const sortField = params.sort || 'score';
    const sortOrder = params.order === 'asc' ? 1 : -1;
    const sort = {};
    
    if (sortField === 'score' && params.query) {
      sort.score = { $meta: 'textScore' };
    } else if (sortField === 'name') {
      sort.name = sortOrder;
    } else if (sortField === 'founded') {
      sort.foundingYear = sortOrder;
    } else {
      sort._id = sortOrder; // Default sort
    }
    
    // Execute query with sort, projection, and pagination
    const projection = params.query ? { score: { $meta: 'textScore' } } : {};
    
    const companies = await collection.find(query, { projection })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Get total count for pagination
    const totalCount = await collection.countDocuments(query);
    
    return {
      results: companies,
      pagination: {
        totalCount,
        limit,
        skip,
        hasMore: skip + limit < totalCount
      },
      meta: {
        query: params,
        matchCount: companies.length
      }
    };
  } catch (error) {
    logger.error(`Error searching companies: ${error.message}`);
    throw error;
  }
};

export default {
  findCompanyByDomain,
  findCompanyByExactName,
  getAllCompanies,
  searchCompanies
}; 