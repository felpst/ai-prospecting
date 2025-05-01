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
}

// API functions
export const CompanyAPI = {
  // Get companies with search filtering
  searchCompanies: async (params: CompanySearchParams) => {
    const response = await api.get('/companies', { params });
    return response.data;
  },

  // Get a single company by ID
  getCompany: async (id: string) => {
    const response = await api.get(`/companies/${id}`);
    return response.data;
  },

  // Request AI enrichment for a company
  enrichCompany: async (id: string) => {
    const response = await api.post(`/companies/${id}/enrich`);
    return response.data;
  }
};

// Saved companies API
export const SavedCompaniesAPI = {
  // Get all saved companies
  getSavedCompanies: async () => {
    const response = await api.get('/saved');
    return response.data;
  },

  // Save a company
  saveCompany: async (companyId: string) => {
    const response = await api.post(`/saved/${companyId}`);
    return response.data;
  },

  // Remove a company from saved list
  unsaveCompany: async (companyId: string) => {
    const response = await api.delete(`/saved/${companyId}`);
    return response.data;
  }
};

// Add request interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle error or pass it along
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api; 