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
  const data = await CompanyAPI.getCompany(id);
  
  // Store in cache
  if (data.company) {
    companyCache.set(id, { 
      data: data.company, 
      timestamp: now 
    });
  }
  
  return data.company;
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