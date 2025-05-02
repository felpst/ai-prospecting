import Company from '../models/company.js';

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