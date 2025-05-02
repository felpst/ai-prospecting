import { useState, useEffect, useRef } from 'react';
import { CompanySearchParams } from '../services/api';
import './FilterSidebar.css';

interface FilterSidebarProps {
  filters: CompanySearchParams;
  onApplyFilters: (filters: CompanySearchParams) => void;
  className?: string;
}

const companySize = [
  { value: '1-10', label: '1-10' },
  { value: '11-50', label: '11-50' },
  { value: '51-200', label: '51-200' },
  { value: '201-500', label: '201-500' },
  { value: '501-1000', label: '501-1000' },
  { value: '1000+', label: '1000+' },
];

// Helper function to check if filters have changed
const areFiltersEqual = (a: CompanySearchParams, b: CompanySearchParams): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) {
    return false;
  }
  
  return keysA.every(key => {
    // @ts-ignore - we're checking if keys exist
    return a[key] === b[key];
  });
};

const FilterSidebar: React.FC<FilterSidebarProps> = ({ 
  filters, 
  onApplyFilters, 
  className = '' 
}) => {
  const [localFilters, setLocalFilters] = useState<CompanySearchParams>({ ...filters });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    industry: true,
    size: true,
    location: true,
    founded: true,
  });
  
  // Store previous filters for comparison
  const prevFiltersRef = useRef<CompanySearchParams>(filters);

  // Update local filters when props change
  useEffect(() => {
    // Only update if filters have actually changed
    if (!areFiltersEqual(filters, prevFiltersRef.current)) {
      setLocalFilters({ ...filters });
      prevFiltersRef.current = { ...filters };
    }
  }, [filters]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setLocalFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSizeChange = (value: string) => {
    setLocalFilters((prev) => ({ ...prev, size: value }));
  };

  const handleRangeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const value = e.target.value ? parseInt(e.target.value) : undefined;
    setLocalFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
  };

  const handleReset = () => {
    // Reset everything except pagination
    const { page, limit } = filters;
    setLocalFilters({ page, limit });
  };

  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside className={`filter-sidebar ${className}`}>
      <div className="filter-sidebar-content">
        <h2 className="filter-title">Filters</h2>
        
        <div className="filter-section">
          <div className="filter-header" onClick={() => toggleSection('industry')}>
            <h3>Industry</h3>
            <span className={`expand-icon ${expanded.industry ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
              </svg>
            </span>
          </div>
          
          {expanded.industry && (
            <div className="filter-content">
              <select
                name="industry"
                value={localFilters.industry || ''}
                onChange={handleInputChange}
                className="filter-select"
              >
                <option value="">All Industries</option>
                <option value="Technology">Technology</option>
                <option value="Software">Software</option>
                <option value="Hospitality">Hospitality</option>
                <option value="Furniture">Furniture</option>
                <option value="Financial Services">Financial Services</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education">Education</option>
                <option value="Retail">Retail</option>
                <option value="Manufacturing">Manufacturing</option>
              </select>
            </div>
          )}
        </div>
        
        <div className="filter-section">
          <div className="filter-header" onClick={() => toggleSection('size')}>
            <h3>Company Size</h3>
            <span className={`expand-icon ${expanded.size ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
              </svg>
            </span>
          </div>
          
          {expanded.size && (
            <div className="filter-content">
              <div className="checkbox-group">
                {companySize.map(size => (
                  <label key={size.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localFilters.size === size.value}
                      onChange={() => handleSizeChange(size.value)}
                    />
                    <span>{size.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="filter-section">
          <div className="filter-header" onClick={() => toggleSection('location')}>
            <h3>Location</h3>
            <span className={`expand-icon ${expanded.location ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
              </svg>
            </span>
          </div>
          
          {expanded.location && (
            <div className="filter-content">
              <div className="filter-field">
                <label>Country</label>
                <select
                  name="country"
                  value={localFilters.country || ''}
                  onChange={handleInputChange}
                  className="filter-select"
                >
                  <option value="">All Countries</option>
                  <option value="United States">United States</option>
                  <option value="Australia">Australia</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Japan">Japan</option>
                </select>
              </div>
              
              <div className="filter-field">
                <label>Region</label>
                <input
                  type="text"
                  name="region"
                  placeholder="Any region"
                  value={localFilters.region || ''}
                  onChange={handleInputChange}
                  className="filter-input"
                />
              </div>
            </div>
          )}
        </div>

        <div className="filter-section">
          <div className="filter-header" onClick={() => toggleSection('founded')}>
            <h3>Founded Year</h3>
            <span className={`expand-icon ${expanded.founded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
              </svg>
            </span>
          </div>
          
          {expanded.founded && (
            <div className="filter-content">
              <div className="range-inputs">
                <label>From</label>
                <input
                  type="number"
                  name="foundedMin"
                  placeholder="From"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={localFilters.foundedMin || ''}
                  onChange={(e) => handleRangeChange(e, 'foundedMin')}
                  className="filter-input year-input"
                />
                
                <label>To</label>
                <input
                  type="number"
                  name="foundedMax"
                  placeholder="To"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={localFilters.foundedMax || ''}
                  onChange={(e) => handleRangeChange(e, 'foundedMax')}
                  className="filter-input year-input"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="filter-actions">
        <button 
          type="button" 
          onClick={handleReset}
          className="reset-button"
        >
          Reset
        </button>
        <button 
          type="button" 
          onClick={handleApply}
          className="apply-button"
        >
          Apply
        </button>
      </div>
    </aside>
  );
};

export default FilterSidebar; 