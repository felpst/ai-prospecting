import Company from '../models/company.js';

/**
 * Enrichment Service
 * Handles integration for company data enrichment
 */

/**
 * Get enrichment data for a company
 * @param {Object} company - The company data
 * @returns {Promise<Object|null>} The enrichment data or null if not available
 */
export const getEnrichmentData = async (company) => {
  if (!company) return null;
  
  // If the company already has enrichment data, return it
  if (company.enrichment && company.last_enriched) {
    return {
      summary: company.enrichment,
      lastUpdated: company.last_enriched,
      source: 'database'
    };
  }
  
  // Otherwise return null (enrichment data not available)
  return null;
};

/**
 * Check if enrichment data needs to be refreshed
 * @param {Object} company - The company data
 * @returns {boolean} Whether enrichment data should be refreshed
 */
export const shouldRefreshEnrichment = (company) => {
  if (!company) return false;
  if (!company.last_enriched) return true;
  
  // Check if last enrichment was more than 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return company.last_enriched < thirtyDaysAgo;
};

/**
 * Merge company data with enrichment data
 * @param {Object} company - The company data
 * @param {Object} enrichment - The enrichment data
 * @returns {Object} Combined company and enrichment data
 */
export const mergeCompanyWithEnrichment = (company, enrichment) => {
  if (!company) return null;
  if (!enrichment) return company;
  
  // Merge enrichment fields directly onto the company object
  return {
    ...company,
    enrichment: enrichment.summary, // Use 'enrichment' key
    last_enriched: enrichment.lastUpdated // Use 'last_enriched' key
  };
}; 