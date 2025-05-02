import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Company, SavedCompaniesAPI } from '../services/api';
import CompanyCard from '../components/CompanyCard';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import CompanyDetailsModal from '../components/CompanyDetailsModal';
import './SavedCompaniesPage.css';

// Sort options for the dropdown
const sortOptions = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'industry-asc', label: 'Industry (A-Z)' },
  { value: 'industry-desc', label: 'Industry (Z-A)' },
  { value: 'founded-asc', label: 'Founded (Oldest first)' },
  { value: 'founded-desc', label: 'Founded (Newest first)' }
];

const SavedCompaniesPage = () => {
  // State management
  const [savedCompanies, setSavedCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  
  // State for company details modal
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  // Close the sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortMenuRef.current && 
        sortButtonRef.current && 
        !sortMenuRef.current.contains(event.target as Node) &&
        !sortButtonRef.current.contains(event.target as Node)
      ) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle sort menu
  const toggleSortMenu = () => {
    setSortMenuOpen(!sortMenuOpen);
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

  // Fetch saved companies
  const fetchSavedCompanies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const companies = await SavedCompaniesAPI.getSavedCompanies();
      setSavedCompanies(companies);
    } catch (err) {
      console.error('Error fetching saved companies:', err);
      setError('Failed to load your saved companies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load saved companies on component mount
  useEffect(() => {
    fetchSavedCompanies();
  }, []);

  // Handle removing a company from saved list
  const handleUnsaveCompany = async (companyId: string) => {
    try {
      await SavedCompaniesAPI.unsaveCompany(companyId);
      // Remove from state
      setSavedCompanies(prev => prev.filter(company => company.id !== companyId));
    } catch (err) {
      console.error('Error removing saved company:', err);
      setError('Failed to remove company from saved list. Please try again.');
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle sort selection change
  const handleSortChange = (sort: string) => {
    const order = sortOption.split('-')[1] || 'asc';
    setSortOption(`${sort}-${order}`);
    setSortMenuOpen(false);
  };

  // Handle sort order change
  const toggleSortOrder = () => {
    const [field, order] = sortOption.split('-');
    const newOrder = order === 'asc' ? 'desc' : 'asc';
    setSortOption(`${field}-${newOrder}`);
  };

  // Handle view mode change
  const handleViewChange = (view: 'grid' | 'list') => {
    setViewMode(view);
  };

  // Get the current sort field label
  const getSortLabel = () => {
    const field = sortOption.split('-')[0];
    switch (field) {
      case 'name':
        return 'Name';
      case 'founded':
        return 'Founded';
      case 'industry':
        return 'Industry';
      default:
        return 'Name';
    }
  };

  // Get the current sort order
  const getCurrentOrder = (): 'asc' | 'desc' => {
    return (sortOption.split('-')[1] as 'asc' | 'desc') || 'asc';
  };

  // Filter and sort companies based on user input
  const filteredAndSortedCompanies = useMemo(() => {
    // First filter by search query
    let filtered = savedCompanies;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = savedCompanies.filter(company => 
        company.name.toLowerCase().includes(query) ||
        (company.industry && company.industry.toLowerCase().includes(query)) ||
        (company.country && company.country.toLowerCase().includes(query))
      );
    }

    // Then sort based on selected option
    const [field, order] = sortOption.split('-');
    return [...filtered].sort((a, b) => {
      let valA = a[field as keyof Company] || '';
      let valB = b[field as keyof Company] || '';
      
      // Convert to strings for comparison
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
      
      return order === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }, [savedCompanies, searchQuery, sortOption]);

  // Render loading state
  if (loading) {
    return (
      <div className="saved-companies-page">
        <div className="page-header">
          <h1>Saved Companies</h1>
        </div>
        <LoadingIndicator />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="saved-companies-page">
        <div className="page-header">
          <h1>Saved Companies</h1>
        </div>
        <ErrorMessage 
          message={error} 
          actions={[
            {
              text: "Try Again",
              onClick: fetchSavedCompanies
            }
          ]}
        />
      </div>
    );
  }

  return (
    <div className="saved-companies-page">
      <div className="page-header">
        <h1>Saved Companies</h1>
        <p>View and manage your saved prospects</p>
      </div>

      {savedCompanies.length === 0 ? (
        <div className="empty-state">
          <h3>No Saved Companies</h3>
          <p>You haven't saved any companies yet. Start searching to find prospects to save.</p>
          <Link to="/">Search Companies</Link>
        </div>
      ) : (
        <>
          <div className="results-header">
            <div className="results-info">
              <p className="results-count">
                {filteredAndSortedCompanies.length} of {savedCompanies.length.toLocaleString()} results
              </p>
              
              <div className="results-controls">
                <div className="search-filter">
                  <input
                    type="text"
                    placeholder="Search saved companies..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                </div>
                
                <div className="sort-control">
                  <span className="sort-label">Sort by:</span>
                  <div className="sort-dropdown">
                    <button
                      ref={sortButtonRef}
                      className="sort-button"
                      onClick={toggleSortMenu}
                      aria-expanded={sortMenuOpen}
                      aria-haspopup="true"
                    >
                      <span>{getSortLabel()}</span>
                      <svg viewBox="0 0 24 24" width="16" height="16" className="dropdown-icon">
                        <path d="M7 10l5 5 5-5z" fill="currentColor" />
                      </svg>
                    </button>
                    
                    {sortMenuOpen && (
                      <div className="sort-menu" ref={sortMenuRef}>
                        <button
                          className={`sort-option ${sortOption.startsWith('name') ? 'active' : ''}`}
                          onClick={() => handleSortChange('name')}
                        >
                          Name
                          {sortOption.startsWith('name') && (
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                        <button
                          className={`sort-option ${sortOption.startsWith('founded') ? 'active' : ''}`}
                          onClick={() => handleSortChange('founded')}
                        >
                          Founded
                          {sortOption.startsWith('founded') && (
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                        <button
                          className={`sort-option ${sortOption.startsWith('industry') ? 'active' : ''}`}
                          onClick={() => handleSortChange('industry')}
                        >
                          Industry
                          {sortOption.startsWith('industry') && (
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <button
                    className="order-button"
                    onClick={toggleSortOrder}
                    aria-label={getCurrentOrder() === 'asc' ? 'Sort ascending' : 'Sort descending'}
                    title={getCurrentOrder() === 'asc' ? 'Sort ascending' : 'Sort descending'}
                  >
                    {getCurrentOrder() === 'asc' ? (
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" fill="currentColor"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" fill="currentColor"/>
                      </svg>
                    )}
                  </button>
                </div>
                
                <div className="view-controls">
                  <button
                    className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => handleViewChange('list')}
                    aria-label="List view"
                    title="List view"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="currentColor" />
                    </svg>
                  </button>
                  <button
                    className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => handleViewChange('grid')}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path d="M4 5v5h5V5H4zm11 0v5h5V5h-5zM4 16v5h5v-5H4zm11 0v5h5v-5h-5z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {filteredAndSortedCompanies.length > 0 ? (
            <div className={`saved-companies-${viewMode}`}>
              {filteredAndSortedCompanies.map(company => (
                <div key={company.id} className="company-card-wrapper">
                  <CompanyCard
                    company={company}
                    onUnsave={handleUnsaveCompany}
                    onViewDetails={handleOpenCompanyDetails}
                    isSaved={true}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No Matching Companies</h3>
              <p>No companies match your search criteria. Try adjusting your search.</p>
            </div>
          )}
        </>
      )}
      
      {/* Company Details Modal */}
      <CompanyDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseCompanyDetails}
        companyId={selectedCompanyId}
      />
    </div>
  );
};

export default SavedCompaniesPage; 