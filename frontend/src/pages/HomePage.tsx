import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CompanyAPI, CompanySearchParams, Company } from '../services/api';
import SearchForm from '../components/SearchForm';
import SearchResults from '../components/SearchResults';
import Pagination from '../components/Pagination';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import './HomePage.css';

// Default search parameters
const DEFAULT_PARAMS: CompanySearchParams = {
  page: 1,
  limit: 10,
  sort: 'name',
  order: 'asc'
};

// Helper to convert search params to state
const parseSearchParams = (searchParams: URLSearchParams): CompanySearchParams => {
  const params: CompanySearchParams = { ...DEFAULT_PARAMS };
  
  // Extract query parameters
  for (const [key, value] of searchParams.entries()) {
    if (key === 'page' || key === 'limit' || key === 'foundedMin' || key === 'foundedMax') {
      // Type assertion to handle the dynamic property assignment
      (params as any)[key] = parseInt(value, 10) || (DEFAULT_PARAMS as any)[key];
    } else if (key in params || key === 'query' || key === 'industry' || key === 'country' || 
               key === 'region' || key === 'locality' || key === 'size' || key === 'founded' || 
               key === 'sort' || key === 'order') {
      // Only assign known keys to prevent issues
      (params as any)[key] = value;
    }
  }
  
  return params;
};

const HomePage = () => {
  // State management
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<CompanySearchParams>(
    parseSearchParams(searchParams)
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCompanies, setTotalCompanies] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCompanies, setSavedCompanies] = useState<string[]>([]);

  // Save company IDs to local storage
  const saveCompany = useCallback((id: string) => {
    setSavedCompanies(prev => {
      const updated = [...prev, id];
      localStorage.setItem('savedCompanies', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove company ID from local storage
  const unsaveCompany = useCallback((id: string) => {
    setSavedCompanies(prev => {
      const updated = prev.filter(companyId => companyId !== id);
      localStorage.setItem('savedCompanies', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Load saved companies from localStorage on initial load
  useEffect(() => {
    const savedData = localStorage.getItem('savedCompanies');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSavedCompanies(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Error parsing saved companies:', e);
      }
    }
  }, []);

  // Fetch companies based on current filters
  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await CompanyAPI.searchCompanies(filters);
      
      setCompanies(response.companies);
      setTotalCompanies(response.pagination.total);
      setTotalPages(response.pagination.pages);
      
      // Update search params in URL
      setSearchParams(
        Object.entries(filters).reduce((params, [key, value]) => {
          // Check if value exists and is different from default
          const defaultValue = (DEFAULT_PARAMS as any)[key];
          if (value !== undefined && value !== '' && value !== defaultValue) {
            params.set(key, String(value));
          } else if (params.has(key)) {
            params.delete(key);
          }
          return params;
        }, new URLSearchParams())
      );
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Failed to load companies. Please try again.');
      setCompanies([]);
      setTotalCompanies(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [filters, setSearchParams]);

  // Sync with URL params on initial load
  useEffect(() => {
    setFilters(parseSearchParams(searchParams));
  }, []);

  // Update results when filters change
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Handle search form submission
  const handleSearch = (newFilters: CompanySearchParams) => {
    setFilters(newFilters);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle retry after error
  const handleRetry = () => {
    fetchCompanies();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>AI-Prospecting</h1>
        <p className="tagline">Find and enrich company data for B2B sales intelligence</p>
      </div>

      <div className="search-container">
        <SearchForm
          initialFilters={filters}
          onSearch={handleSearch}
          isLoading={isLoading}
        />
      </div>

      {error ? (
        <ErrorMessage 
          message={error} 
          onAction={handleRetry} 
        />
      ) : (
        <>
          <SearchResults
            companies={companies}
            total={totalCompanies}
            isLoading={isLoading}
            onSaveCompany={saveCompany}
            savedCompanies={savedCompanies}
          />
          
          {!isLoading && companies.length > 0 && (
            <Pagination
              currentPage={filters.page || 1}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              disabled={isLoading}
            />
          )}
        </>
      )}
    </div>
  );
};

export default HomePage; 