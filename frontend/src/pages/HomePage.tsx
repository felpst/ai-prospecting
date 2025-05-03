import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CompanyAPI, CompanySearchParams, Company, SavedCompaniesAPI } from '../services/api';
import SearchHeader from '../components/SearchHeader';
import FilterSidebar from '../components/FilterSidebar';
import ResultsHeader from '../components/ResultsHeader';
import CompanyGrid from '../components/CompanyGrid';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import Pagination from '../components/Pagination';
import CompanyDetailsModal from '../components/CompanyDetailsModal';
import './HomePage.css';

// Default search parameters
const DEFAULT_PARAMS: CompanySearchParams = {
  page: 1,
  limit: 20,
  sort: 'name',
  order: 'asc'
};

// Search metadata interface for natural language search
interface SearchMetadata {
  query: string;
  sources?: Record<string, boolean>;
  parsedQuery?: any;
  executionTime?: string;
}

// Helper to convert search params to state
const parseSearchParams = (searchParams: URLSearchParams): CompanySearchParams => {
  const params: CompanySearchParams = { ...DEFAULT_PARAMS };
  
  if (searchParams.has('query')) {
    params.query = searchParams.get('query') || undefined;
  }
  
  if (searchParams.has('industry')) {
    params.industry = searchParams.get('industry') || undefined;
  }
  
  if (searchParams.has('country')) {
    params.country = searchParams.get('country') || undefined;
  }
  
  if (searchParams.has('region')) {
    params.region = searchParams.get('region') || undefined;
  }
  
  if (searchParams.has('size')) {
    params.size = searchParams.get('size') || undefined;
  }
  
  if (searchParams.has('foundedMin')) {
    params.foundedMin = parseInt(searchParams.get('foundedMin') || '0', 10) || undefined;
  }
  
  if (searchParams.has('foundedMax')) {
    params.foundedMax = parseInt(searchParams.get('foundedMax') || '0', 10) || undefined;
  }
  
  if (searchParams.has('page')) {
    params.page = parseInt(searchParams.get('page') || '1', 10);
  }
  
  if (searchParams.has('limit')) {
    params.limit = parseInt(searchParams.get('limit') || '20', 10);
  }
  
  if (searchParams.has('sort')) {
    params.sort = searchParams.get('sort') || 'name';
  }
  
  if (searchParams.has('order')) {
    const orderValue = searchParams.get('order') || 'asc';
    params.order = (orderValue === 'asc' || orderValue === 'desc') ? orderValue : 'asc';
  }
  
  return params;
};

const HomePage: React.FC = () => {
  // State to track active tab
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  
  // Get URL search parameters
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for discover tab
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // State for saved prospects tab
  const [savedCompanies, setSavedCompanies] = useState<Company[]>([]);
  const [savedCompanyIds, setSavedCompanyIds] = useState<string[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [errorSaved, setErrorSaved] = useState<string | null>(null);
  const [searchQuerySaved, setSearchQuerySaved] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  
  // State for company details modal
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for search metadata
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata | null>(null);
  
  // Store the parsed params in a ref to prevent it from causing re-renders
  const paramsRef = useRef(parseSearchParams(searchParams));
  
  // Update params ref when search params change
  useEffect(() => {
    paramsRef.current = parseSearchParams(searchParams);
  }, [searchParams]);
  
  // Update the useEffect for checking tab to also handle search synchronization
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'saved') {
      setActiveTab('saved');
      // Use the query parameter for saved search if it exists
      const queryParam = searchParams.get('query');
      if (queryParam) {
        setSearchQuerySaved(queryParam);
      }
    }
  }, [searchParams]);
  
  // Fetch companies based on search parameters
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log('[HomePage] Fetching companies with params:', paramsRef.current);
    
    try {
      const result = await CompanyAPI.searchCompanies(paramsRef.current);
      console.log('[HomePage] Received API result:', result);
      
      // Check if the response has the expected structure from the backend
      if (result && typeof result === 'object' && result.companies && result.pagination) {
        const { companies = [], pagination = {} } = result;
        const total = pagination.total || 0;
        
        const companiesArray = Array.isArray(companies) ? companies : [];
        console.log('[HomePage] Parsed companies:', companiesArray);
        console.log('[HomePage] Parsed total:', total);
        
        setCompanies(companiesArray);
        setTotalResults(total);
        setSearchPerformed(true);
      } else {
        // Handle unexpected response format
        console.error('Unexpected API response format:', result);
        setError('Received invalid data from the server. Please try again.');
        setCompanies([]);
        setTotalResults(0);
        setSearchPerformed(true);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Failed to fetch companies. Please try again.');
      setCompanies([]);
      setTotalResults(0);
      setSearchPerformed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch saved companies
  const fetchSavedCompanies = useCallback(async () => {
    // Set loading state only in the saved tab to avoid loading indicator when in discover tab
    if (activeTab === 'saved') {
      setLoadingSaved(true);
    }
    setErrorSaved(null);
    
    try {
      const savedCompanies = await SavedCompaniesAPI.getSavedCompanies();
      
      // Ensure we have a valid array of companies with IDs
      if (Array.isArray(savedCompanies)) {
        const savedIds = savedCompanies
          .filter(company => company && company.id)
          .map(company => company.id);
        
        setSavedCompanies(savedCompanies);
        setSavedCompanyIds(savedIds);
      } else {
        console.error('Unexpected response from getSavedCompanies:', savedCompanies);
        setSavedCompanies([]);
        setSavedCompanyIds([]);
      }
    } catch (err) {
      console.error('Error fetching saved companies:', err);
      setErrorSaved('Failed to load your saved companies. Please try again.');
      setSavedCompanies([]);
      setSavedCompanyIds([]);
    } finally {
      if (activeTab === 'saved') {
        setLoadingSaved(false);
      }
    }
  }, [activeTab]);
  
  // Handle saving a company
  const handleSaveCompany = async (id: string) => {
    try {
      await SavedCompaniesAPI.saveCompany(id);
      setSavedCompanyIds((prev: string[]) => [...prev, id]);
      // Refresh saved companies if we're in the saved tab
      if (activeTab === 'saved') {
        fetchSavedCompanies();
      }
    } catch (err) {
      console.error('Error saving company:', err);
      setError('Failed to save company. Please try again.');
    }
  };
  
  // Handle removing a company from saved list
  const handleUnsaveCompany = async (id: string) => {
    try {
      await SavedCompaniesAPI.unsaveCompany(id);
      setSavedCompanyIds((prev: string[]) => prev.filter((savedId: string) => savedId !== id));
      // If in saved tab, also remove from the list
      if (activeTab === 'saved') {
        setSavedCompanies((prev: Company[]) => prev.filter((company: Company) => company.id !== id));
      }
    } catch (err) {
      console.error('Error removing saved company:', err);
      setError('Failed to remove company from saved list. Please try again.');
    }
  };
  
  // Check if a search query is likely a natural language query
  const isNaturalLanguageQuery = (query: string): boolean => {
    // If query contains multiple words and is a sentence-like structure
    return query.split(' ').length > 3 && 
           !query.includes(':') && // Not containing special search operators
           /[a-zA-Z]/.test(query); // Contains letters (not just numbers/symbols)
  };

  // Handle natural language search
  const handleNaturalLanguageSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    console.log('[HomePage] Natural language search:', query);
    
    try {
      const result = await CompanyAPI.naturalLanguageSearch(query);
      console.log('[HomePage] Natural language search result:', result);
      
      if (result && result.success) {
        // Extract companies from the unified search API response
        const companiesArray = Array.isArray(result.companies) ? result.companies : [];
        
        // Ensure each company has an id property
        const normalizedCompanies = companiesArray.map((company: any) => ({
          ...company,
          // If company already has id use it, otherwise use _id as fallback
          id: company.id || company._id,
          // Ensure other required properties exist to avoid render errors
          name: company.name || 'Unknown Company',
          industry: company.industry || 'Unspecified',
          location: [company.locality, company.region, company.country]
            .filter(Boolean)
            .join(', ') || 'Unknown'
        }));
        
        console.log('[HomePage] Normalized companies:', normalizedCompanies);
        
        setCompanies(normalizedCompanies);
        setTotalResults(normalizedCompanies.length);
        setSearchPerformed(true);
        
        // Update metadata for results display
        setSearchMetadata({
          query,
          sources: result.sources,
          parsedQuery: result.parsedQuery,
          executionTime: result.meta?.executionTime
        });
      } else {
        console.error('Unexpected API response format:', result);
        setError(result.error || 'Received invalid data from the server. Please try again.');
        setCompanies([]);
        setTotalResults(0);
        setSearchPerformed(true);
      }
    } catch (err) {
      console.error('Error in natural language search:', err);
      setError('Failed to perform natural language search. Please try again.');
      setCompanies([]);
      setTotalResults(0);
      setSearchPerformed(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle header search (can be natural language or regular search)
  const handleHeaderSearch = (query: string) => {
    // If empty query, reset filters
    if (!query) {
      setSearchParams({});
      return;
    }
    
    // Check if this appears to be a natural language query
    if (isNaturalLanguageQuery(query)) {
      handleNaturalLanguageSearch(query);
    } else {
      // Regular search - update search params
      const newParams = {
        ...paramsRef.current,
        query,
        page: '1'
      };
      
      // Using setSearchParams
      const urlParams = new URLSearchParams();
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) urlParams.set(key, String(value));
      });
      setSearchParams(urlParams);
    }
  };
  
  // Handle applying filters
  const handleApplyFilters = (filters: CompanySearchParams) => {
    const newParams = new URLSearchParams();
    
    // Preserve the tab parameter if it exists
    if (searchParams.has('tab')) {
      newParams.set('tab', searchParams.get('tab') || '');
    }
    
    // Add the query parameter if it exists in current search params
    if (searchParams.has('query')) {
      newParams.set('query', searchParams.get('query') || '');
    }
    
    // Add all filter parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        newParams.set(key, value.toString());
      }
    });
    
    // Reset to page 1 when applying filters
    newParams.set('page', '1');
    
    setSearchParams(newParams);
  };
  
  // Handle sort change for discover tab
  const handleSortChange = (sort: string, order: 'asc' | 'desc') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', sort);
    newParams.set('order', order);
    setSearchParams(newParams);
  };
  
  // Handle sort change for saved tab
  const handleSortChangeSaved = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value);
  };
  
  // Handle sort change for saved tab (new version)
  const handleSavedSortChange = (sort: string, order: 'asc' | 'desc') => {
    setSortOption(`${sort}-${order}`);
  };

  // Get current sort field and order from saved tab
  const getSavedSortInfo = () => {
    const [field, order] = sortOption.split('-');
    return {
      sort: field,
      order: order as 'asc' | 'desc'
    };
  };
  
  // Handle view mode change
  const handleViewChange = (view: 'grid' | 'list') => {
    setViewMode(view);
  };
  
  // Toggle mobile filters
  const toggleMobileFilters = () => {
    setShowMobileFilters(!showMobileFilters);
  };
  
  // Handle tab change
  const handleTabChange = (tab: 'discover' | 'saved') => {
    // If already on the selected tab, don't do anything
    if (tab === activeTab) return;
    
    setActiveTab(tab);
    
    // Update URL without triggering a navigation
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'saved') {
      newParams.set('tab', 'saved');
      
      // Preserve discover tab parameters
      if (paramsRef.current.query) {
        setSearchQuerySaved(paramsRef.current.query);
      }
    } else {
      newParams.delete('tab');
    }
    
    // Don't reset searchPerformed flag when switching tabs
    setSearchParams(newParams, { replace: true });
  };
  
  // Filter and sort saved companies based on search query and sort option
  const filteredAndSortedSavedCompanies = useCallback(() => {
    // First filter by search query and other filters
    let filtered = savedCompanies;
    
    // Apply search query filter
    if (searchQuerySaved.trim() !== '') {
      const query = searchQuerySaved.toLowerCase();
      filtered = filtered.filter((company: Company) => 
        company.name.toLowerCase().includes(query) ||
        (company.industry && company.industry.toLowerCase().includes(query)) ||
        (company.country && company.country.toLowerCase().includes(query))
      );
    }
    
    // Apply industry filter
    if (paramsRef.current.industry) {
      filtered = filtered.filter((company: Company) => 
        company.industry && company.industry.toLowerCase() === paramsRef.current.industry?.toLowerCase()
      );
    }
    
    // Apply country filter
    if (paramsRef.current.country) {
      filtered = filtered.filter((company: Company) => 
        company.country && company.country.toLowerCase() === paramsRef.current.country?.toLowerCase()
      );
    }
    
    // Apply region filter
    if (paramsRef.current.region) {
      filtered = filtered.filter((company: Company) => 
        company.region && company.region.toLowerCase().includes(paramsRef.current.region?.toLowerCase() || '')
      );
    }
    
    // Apply company size filter
    if (paramsRef.current.size) {
      filtered = filtered.filter((company: Company) => 
        company.size === paramsRef.current.size
      );
    }
    
    // Apply founded year range filter
    if (paramsRef.current.foundedMin) {
      filtered = filtered.filter((company: Company) => 
        company.founded && company.founded >= (paramsRef.current.foundedMin || 0)
      );
    }
    
    if (paramsRef.current.foundedMax) {
      filtered = filtered.filter((company: Company) => 
        company.founded && company.founded <= (paramsRef.current.foundedMax || 9999)
      );
    }

    // Then sort based on selected option
    const { sort, order } = getSavedSortInfo();
    return [...filtered].sort((a: Company, b: Company) => {
      let valA = a[sort as keyof Company] || '';
      let valB = b[sort as keyof Company] || '';
      
      // Convert to strings for comparison
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
      
      return order === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }, [savedCompanies, searchQuerySaved, sortOption, paramsRef]);
  
  // Close mobile filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const sidebar = document.querySelector('.filter-sidebar');
      const filterButton = document.querySelector('.mobile-filter-button');
      
      if (
        showMobileFilters && 
        sidebar && 
        filterButton &&
        !sidebar.contains(target) && 
        !filterButton.contains(target)
      ) {
        setShowMobileFilters(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMobileFilters]);
  
  // Fetch companies when search params change or on mount - only when in discover tab
  useEffect(() => {
    if (activeTab === 'discover' && (searchParams.toString() !== '' || searchPerformed)) {
      console.log('[HomePage] useEffect triggered for fetchCompanies');
      fetchCompanies();
    }
  }, [fetchCompanies, searchParams, activeTab]);
  
  // Fetch saved companies on initial mount or when explicitly needed
  // Changed dependency from activeTab to a more specific condition
  useEffect(() => {
    if (savedCompanies.length === 0 || activeTab === 'saved') {
      console.log('[HomePage] useEffect triggered for fetchSavedCompanies');
      fetchSavedCompanies();
    }
  }, [fetchSavedCompanies, activeTab]);
  
  // Handle page change for discover tab
  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
    window.scrollTo(0, 0); // Scroll to top when changing pages
  };
  
  // Handle opening company details modal
  const handleOpenCompanyDetails = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setIsModalOpen(true);
  };
  
  // Handle closing company details modal
  const handleCloseCompanyDetails = () => {
    setIsModalOpen(false);
  };
  
  // Render the natural language search metadata if available
  const renderSearchMetadata = () => {
    if (!searchMetadata) return null;
    
    return (
      <div className="search-metadata">
        <div className="metadata-header">
          <h3>Natural Language Search Results</h3>
          {searchMetadata.executionTime && (
            <span className="execution-time">Processed in {searchMetadata.executionTime}</span>
          )}
        </div>
        
        {searchMetadata.parsedQuery && (
          <div className="parsed-query">
            <p>
              <strong>We understood your query as:</strong> {' '}
              {Object.entries(searchMetadata.parsedQuery)
                .filter(([key, value]) => value && key !== 'query')
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')}
              {Object.keys(searchMetadata.parsedQuery).length <= 1 && searchMetadata.parsedQuery.query && (
                <span>Looking for "<strong>{searchMetadata.parsedQuery.query}</strong>"</span>
              )}
            </p>
          </div>
        )}
        
        {searchMetadata.sources && (
          <div className="search-sources">
            <p>
              <strong>Data sources:</strong> {' '}
              {Object.entries(searchMetadata.sources)
                .filter(([_, active]) => active)
                .map(([source]) => source)
                .join(', ')}
            </p>
          </div>
        )}
      </div>
    );
  };
  
  // Tab content for discover tab
  const renderDiscoverTab = () => (
    <>
      {loading ? (
        <div className="results-loading">
          <LoadingIndicator size="large" text="Searching for companies..." />
        </div>
      ) : error ? (
        <div className="results-error">
          <ErrorMessage 
            type="error"
            title="Search Error"
            message={error}
            actions={[{
              text: "Try Again",
              onClick: fetchCompanies
            }]}
          />
        </div>
      ) : searchPerformed ? (
        <>
          <ResultsHeader
            count={companies.length}
            total={totalResults}
            onSortChange={handleSortChange}
            onViewChange={handleViewChange}
            currentSort={paramsRef.current.sort || 'name'}
            currentOrder={paramsRef.current.order || 'asc'}
            currentView={viewMode}
          />
          
          {/* Display search metadata for natural language searches */}
          {renderSearchMetadata()}
          
          <CompanyGrid
            companies={companies}
            isLoading={loading}
            onSaveCompany={handleSaveCompany}
            onUnsaveCompany={handleUnsaveCompany}
            onViewDetails={handleOpenCompanyDetails}
            savedCompanies={savedCompanyIds}
            viewMode={viewMode}
          />
          
          {/* Add pagination for discover tab */}
          {totalResults > 0 && (
            <Pagination
              currentPage={parseInt(searchParams.get('page') || '1')}
              totalPages={Math.ceil(totalResults / (paramsRef.current.limit || 20))}
              onPageChange={handlePageChange}
            />
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-content">
            <h2>Search for companies</h2>
            <p>Use the search bar above to find companies by name, industry, or keywords.</p>
            <p>You can also filter by industry, company size, location, and founding year.</p>
          </div>
        </div>
      )}
    </>
  );
  
  // Tab content for saved prospects tab
  const renderSavedTab = () => {
    const filteredSavedCompanies = filteredAndSortedSavedCompanies();
    const ITEMS_PER_PAGE = 20; // Same as discover tab for consistency
    
    // Implement pagination for saved companies
    const savedPageParam = searchParams.get('savedPage') || '1';
    const currentSavedPage = parseInt(savedPageParam, 10);
    const totalSavedPages = Math.ceil(filteredSavedCompanies.length / ITEMS_PER_PAGE);
    
    // Paginate the filtered companies
    const paginatedSavedCompanies = filteredSavedCompanies.slice(
      (currentSavedPage - 1) * ITEMS_PER_PAGE,
      currentSavedPage * ITEMS_PER_PAGE
    );
    
    // Handle page change for saved tab
    const handleSavedPageChange = (page: number) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('savedPage', page.toString());
      setSearchParams(newParams);
      window.scrollTo(0, 0); // Scroll to top when changing pages
    };
    
    // Render loading state
    if (loadingSaved) {
      return (
        <div className="results-loading">
          <LoadingIndicator size="large" text="Loading saved companies..." />
        </div>
      );
    }
    
    // Render error state
    if (errorSaved) {
      return (
        <div className="results-error">
          <ErrorMessage 
            type="error"
            title="Error Loading Saved Companies"
            message={errorSaved}
            actions={[{
              text: "Try Again",
              onClick: fetchSavedCompanies
            }]}
          />
        </div>
      );
    }
    
    if (savedCompanies.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-content">
            <h2>No Saved Companies</h2>
            <p>You haven't saved any companies yet.</p>
            <p>Use the Discover tab to search and save companies you're interested in.</p>
            <button 
              className="switch-tab-button"
              onClick={() => handleTabChange('discover')}
            >
              Go to Discover
            </button>
          </div>
        </div>
      );
    }
    
    const { sort, order } = getSavedSortInfo();
    
    return (
      <>
        <ResultsHeader
          count={filteredSavedCompanies.length}
          total={savedCompanies.length}
          onSortChange={handleSavedSortChange}
          onViewChange={handleViewChange}
          currentSort={sort}
          currentOrder={order}
          currentView={viewMode}
        />
        
        {filteredSavedCompanies.length > 0 ? (
          <>
            <CompanyGrid
              companies={paginatedSavedCompanies}
              isLoading={false}
              onSaveCompany={handleSaveCompany}
              onUnsaveCompany={handleUnsaveCompany}
              onViewDetails={handleOpenCompanyDetails}
              savedCompanies={savedCompanyIds}
              viewMode={viewMode}
            />
            
            {/* Add pagination for saved tab */}
            {filteredSavedCompanies.length > ITEMS_PER_PAGE && (
              <Pagination
                currentPage={currentSavedPage}
                totalPages={totalSavedPages}
                onPageChange={handleSavedPageChange}
              />
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-content">
              <h2>No Matching Saved Companies</h2>
              <p>No saved companies match your search criteria.</p>
              <p>Try adjusting your search query or filters to see more results.</p>
            </div>
          </div>
        )}
      </>
    );
  };
  
  return (
    <div className="home-page">
      <div className="content-container">
        {/* Filter Sidebar - Show for both tabs */}
        <FilterSidebar
          filters={paramsRef.current}
          onApplyFilters={handleApplyFilters}
          className={showMobileFilters ? 'open' : ''}
        />
        
        <div className="main-area">
          {/* Search Header */}
          <SearchHeader
            onSearch={handleHeaderSearch}
            defaultValue={activeTab === 'discover' ? (paramsRef.current.query || '') : searchQuerySaved}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
          
          {/* Main Content */}
          <div className="main-content">
            {/* Results Area */}
            <main className="results-area">
              {/* Mobile Filter Button - Show for both tabs */}
              <button 
                className="mobile-filter-button"
                onClick={toggleMobileFilters}
                aria-label="Toggle filters"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                Filters
              </button>
              
              {showMobileFilters && (
                <div className="mobile-filters-backdrop" onClick={() => setShowMobileFilters(false)}></div>
              )}
              
              {/* Render active tab content */}
              {activeTab === 'discover' ? renderDiscoverTab() : renderSavedTab()}
            </main>
          </div>
        </div>
      </div>
      
      {/* Company Details Modal */}
      <CompanyDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseCompanyDetails}
        companyId={selectedCompanyId}
      />
    </div>
  );
};

export default HomePage; 