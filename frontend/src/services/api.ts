import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interface for search params
export interface CompanySearchParams {
  page?: number;
  limit?: number;
  industry?: string;
  country?: string;
  region?: string;
  locality?: string;
  size?: string;
  query?: string;
  founded?: number;
  foundedMin?: number;
  foundedMax?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Interface for company data
export interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  founded?: number;
  size?: string;
  locality?: string;
  region?: string;
  country?: string;
  linkedin_url?: string;
  enrichment?: string;
  last_enriched?: string;
  location?: string;
  hasEnrichment?: boolean;
}

// Interface for enrichment error response
export interface EnrichmentError {
  message: string;
  category?: string;
  technicalDetails?: string;
}

// Interface for enrichment response
export interface EnrichmentResponse {
  success: boolean;
  message: string;
  companyId: string;
  scrapeSource?: string;
  enrichment?: {
    summary: string;
    timestamp: string;
  };
  error?: EnrichmentError;
}

// API functions
export const CompanyAPI = {
  // Get companies with search filtering
  searchCompanies: async (params: CompanySearchParams) => {
    try {
      const response = await api.get('/companies', { params });
      return response.data;
    } catch (error) {
      console.error('Error in searchCompanies:', error);
      throw error;
    }
  },

  // Natural language search using unified API
  naturalLanguageSearch: async (query: string, options: any = {}) => {
    try {
      const response = await api.post('/search/unified', { query, options });
      return response.data;
    } catch (error) {
      console.error('Error in naturalLanguageSearch:', error);
      throw error;
    }
  },

  // Get a single company by ID
  getCompany: async (id: string) => {
    try {
      const response = await api.get(`/companies/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error in getCompany:', error);
      throw error;
    }
  },

  // Request AI enrichment for a company
  enrichCompany: async (id: string): Promise<EnrichmentResponse> => {
    try {
      const response = await api.post(`/companies/${id}/enrich`);
      return response.data;
    } catch (error) {
      console.error('Error in enrichCompany:', error);

      let errorMessage = 'Failed to enrich company data. Please try again.';
      let technicalDetails = error instanceof Error ? error.message : 'Unknown error';
      let errorCategory = 'unknown_error';
      
      // Check if it's an Axios error with a response from the backend
      if (axios.isAxiosError(error) && error.response && error.response.data) {
        const backendError = error.response.data.error;
        errorMessage = error.response.data.message || errorMessage;
        if (backendError) {
          technicalDetails = backendError.technicalDetails || backendError.message || technicalDetails;
          errorCategory = backendError.category || errorCategory;
        }
      }
      
      // Return a structured error compatible with EnrichmentResponse
      return {
        success: false,
        message: errorMessage, // Use the more specific message from backend if available
        companyId: id,
        error: {
          message: errorMessage, // Keep the main message user-friendly
          category: errorCategory,
          technicalDetails: technicalDetails // Pass the detailed technical info
        }
      };
    }
  }
};

// Saved companies API
export const SavedCompaniesAPI = {
  // Get all saved companies
  getSavedCompanies: async () => {
    try {
      const response = await api.get('/saved');
      return response.data;
    } catch (error) {
      console.error('Error in getSavedCompanies:', error);
      throw error;
    }
  },

  // Save a company
  saveCompany: async (companyId: string) => {
    try {
      const response = await api.post(`/saved/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('Error in saveCompany:', error);
      throw error;
    }
  },

  // Remove a company from saved list
  unsaveCompany: async (companyId: string) => {
    try {
      const response = await api.delete(`/saved/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('Error in unsaveCompany:', error);
      throw error;
    }
  }
};

// Add request interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle error or pass it along
    console.error('API Error:', error.response?.data || error.message);
    
    // Preserve the original error with the response data for better error handling
    if (error.response?.data) {
      error.responseData = error.response.data;
    }
    
    return Promise.reject(error);
  }
);

export default api; 