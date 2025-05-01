import { useState, useEffect } from 'react';
import { CompanySearchParams } from '../services/api';
import './SearchForm.css';

interface SearchFormProps {
  initialFilters?: CompanySearchParams;
  onSearch: (filters: CompanySearchParams) => void;
  isLoading?: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({
  initialFilters = {},
  onSearch,
  isLoading = false
}) => {
  const [filters, setFilters] = useState<CompanySearchParams>(initialFilters);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Update filters if initialFilters changes (e.g., from URL params)
  useEffect(() => {
    setFilters(initialFilters);
  }, [JSON.stringify(initialFilters)]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleRangeChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const value = event.target.value ? parseInt(event.target.value) : undefined;
    setFilters((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Set all fields as touched on submit
    const allTouched = Object.keys(filters).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);
    
    // First page on new search
    const searchParams = { ...filters, page: 1 };
    onSearch(searchParams);
  };

  const handleReset = () => {
    // Keep page and limit, reset everything else
    const { page, limit } = filters;
    setFilters({ page, limit });
    setTouched({});
  };

  return (
    <div className="search-form-container">
      <h2>Find Companies</h2>
      <form onSubmit={handleSubmit} className="search-form">
        {/* Search query field */}
        <div className="form-group full-width">
          <input
            type="text"
            name="query"
            placeholder="Search by name, industry, or keywords..."
            value={filters.query || ''}
            onChange={handleInputChange}
            className="search-input"
            aria-label="Search query"
          />
        </div>

        <div className="filters-container">
          {/* Industry filter */}
          <div className="form-group">
            <label htmlFor="industry">Industry</label>
            <select
              id="industry"
              name="industry"
              value={filters.industry || ''}
              onChange={handleInputChange}
            >
              <option value="">All Industries</option>
              <option value="information technology and services">Information Technology</option>
              <option value="software">Software</option>
              <option value="financial services">Financial Services</option>
              <option value="healthcare">Healthcare</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="retail">Retail</option>
              <option value="education">Education</option>
              <option value="hospitality">Hospitality</option>
            </select>
          </div>

          {/* Company size filter */}
          <div className="form-group">
            <label htmlFor="size">Company Size</label>
            <select
              id="size"
              name="size"
              value={filters.size || ''}
              onChange={handleInputChange}
            >
              <option value="">All Sizes</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="501-1000">501-1000 employees</option>
              <option value="1001-5000">1001-5000 employees</option>
              <option value="5001-10000">5001-10000 employees</option>
              <option value="10001+">10001+ employees</option>
            </select>
          </div>

          {/* Location filters */}
          <div className="form-group">
            <label htmlFor="country">Country</label>
            <input
              type="text"
              id="country"
              name="country"
              placeholder="e.g., United States"
              value={filters.country || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="region">Region/State</label>
            <input
              type="text"
              id="region"
              name="region"
              placeholder="e.g., California"
              value={filters.region || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="locality">City</label>
            <input
              type="text"
              id="locality"
              name="locality"
              placeholder="e.g., San Francisco"
              value={filters.locality || ''}
              onChange={handleInputChange}
            />
          </div>

          {/* Foundation year filters */}
          <div className="form-group year-range">
            <label htmlFor="foundedMin">Founded (Year)</label>
            <div className="year-inputs">
              <input
                type="number"
                id="foundedMin"
                name="foundedMin"
                placeholder="From"
                min="1800"
                max={new Date().getFullYear()}
                value={filters.foundedMin || ''}
                onChange={(e) => handleRangeChange(e, 'foundedMin')}
              />
              <span>to</span>
              <input
                type="number"
                id="foundedMax"
                name="foundedMax"
                placeholder="To"
                min="1800"
                max={new Date().getFullYear()}
                value={filters.foundedMax || ''}
                onChange={(e) => handleRangeChange(e, 'foundedMax')}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={handleReset} 
            className="reset-button"
            disabled={isLoading}
          >
            Reset Filters
          </button>
          <button 
            type="submit" 
            className="search-button"
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchForm; 