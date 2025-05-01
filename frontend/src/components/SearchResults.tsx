import { Link } from 'react-router-dom';
import { Company } from '../services/api';
import CompanyCard from './CompanyCard';
import './SearchResults.css';

interface SearchResultsProps {
  companies: Company[];
  total: number;
  isLoading: boolean;
  error?: string;
  onSaveCompany?: (id: string) => void;
  savedCompanies?: string[];
}

const SearchResults: React.FC<SearchResultsProps> = ({
  companies,
  total,
  isLoading,
  error,
  onSaveCompany,
  savedCompanies = []
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="search-results-container loading">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Searching for companies...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="search-results-container error">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      </div>
    );
  }

  // Empty results state
  if (companies.length === 0) {
    return (
      <div className="search-results-container empty">
        <div className="empty-results">
          <h3>No Companies Found</h3>
          <p>Try adjusting your search criteria to find more results.</p>
        </div>
      </div>
    );
  }

  // Results display
  return (
    <div className="search-results-container">
      <div className="results-header">
        <h2>Search Results</h2>
        <p className="results-count">
          Found <strong>{total}</strong> {total === 1 ? 'company' : 'companies'}
        </p>
      </div>

      <div className="results-grid">
        {companies.map(company => (
          <Link 
            to={`/company/${company.id}`} 
            key={company.id}
            className="company-card-link"
          >
            <CompanyCard
              company={company}
              onSave={onSaveCompany}
              isSaved={savedCompanies.includes(company.id)}
            />
          </Link>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="empty-results">
          <p>No companies match your search criteria.</p>
        </div>
      )}
    </div>
  );
};

export default SearchResults; 