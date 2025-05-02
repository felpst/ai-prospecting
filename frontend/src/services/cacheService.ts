import { Company, CompanyAPI } from './api';

// Cache configuration
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Cache types
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Company cache
const companyCache = new Map<string, CacheEntry<Company>>();

/**
 * Get company data with caching
 * Fetches from cache if available and not expired, otherwise fetches from API
 */
export const getCompanyWithCache = async (id: string): Promise<Company> => {
  const cached = companyCache.get(id);
  const now = Date.now();
  
  // Return from cache if valid
  if (cached && now - cached.timestamp < CACHE_EXPIRY) {
    console.log(`Using cached data for company ${id}`);
    return cached.data;
  }
  
  // Fetch fresh data
  console.log(`Fetching fresh data for company ${id}`);
  const responseData = await CompanyAPI.getCompany(id);
  
  // Log the raw response to debug the structure
  console.log('Raw API response from getCompany:', JSON.stringify(responseData, null, 2));
  
  // Extract the nested company object if necessary
  let rawCompanyObject = responseData && responseData.company ? responseData.company : responseData;
  
  // Convert Mongoose doc to plain JS object if needed by accessing _doc
  let plainCompanyData: Company;
  if (rawCompanyObject && rawCompanyObject._doc) {
    console.log('Detected Mongoose document, extracting from _doc');
    plainCompanyData = rawCompanyObject._doc;
  } else {
    console.log('Assuming plain JS object');
    plainCompanyData = rawCompanyObject;
  }
  
  // Ensure essential fields are present, even if extracted from _doc
  // Mongoose virtuals like 'id' might not be in _doc
  if (plainCompanyData && !plainCompanyData.id && rawCompanyObject.id) {
     plainCompanyData.id = rawCompanyObject.id;
  }
   if (plainCompanyData && !plainCompanyData.name && rawCompanyObject.name) {
     plainCompanyData.name = rawCompanyObject.name;
  }
  
  // Add other top-level fields from the Mongoose object if they exist and aren't in _doc
  // (e.g., calculated fields or fields added by formatCompanyResponse)
  if (plainCompanyData && rawCompanyObject.location && !plainCompanyData.location) {
    plainCompanyData.location = rawCompanyObject.location;
  }
   if (plainCompanyData && rawCompanyObject.hasEnrichment && !plainCompanyData.hasEnrichment) {
    plainCompanyData.hasEnrichment = rawCompanyObject.hasEnrichment;
  }
   if (plainCompanyData && rawCompanyObject.enrichment && !plainCompanyData.enrichment) {
    plainCompanyData.enrichment = rawCompanyObject.enrichment;
  }
   if (plainCompanyData && rawCompanyObject.last_enriched && !plainCompanyData.last_enriched) {
    plainCompanyData.last_enriched = rawCompanyObject.last_enriched;
  }

  console.log('Final plain company data:', JSON.stringify(plainCompanyData, null, 2));
  
  // Store the plain data in cache
  companyCache.set(id, { 
    data: plainCompanyData, 
    timestamp: now 
  });
  
  return plainCompanyData;
};

/**
 * Clear the entire cache or specific entry
 */
export const clearCompanyCache = (id?: string): void => {
  if (id) {
    companyCache.delete(id);
  } else {
    companyCache.clear();
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): { size: number, entries: string[] } => {
  return {
    size: companyCache.size,
    entries: Array.from(companyCache.keys())
  };
}; 