import { useState } from 'react';
import { CompanySearchParams } from '../services/api';
import './HomePage.css';

const HomePage = () => {
  const [searchParams, setSearchParams] = useState<CompanySearchParams>({
    page: 1,
    limit: 10
  });
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSearching(true);
    
    // In a future task, we'll implement the actual API call
    // For now just simulate a search
    setTimeout(() => {
      setIsSearching(false);
      console.log('Search with params:', searchParams);
    }, 1000);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="page">
      <h1>AI-Prospecting</h1>
      <p>B2B sales intelligence platform</p>
      
      <div className="search-container">
        <h2>Company Search</h2>
        <form onSubmit={handleSearch} className="search-form">
          <div className="form-group">
            <input
              type="text"
              name="query"
              placeholder="Search..."
              value={searchParams.query || ''}
              onChange={handleInputChange}
              className="search-input"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="industry">Industry</label>
              <select 
                name="industry" 
                id="industry"
                value={searchParams.industry || ''}
                onChange={handleInputChange}
              >
                <option value="">All Industries</option>
                <option value="Technology">Technology</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Finance">Finance</option>
                <option value="Education">Education</option>
                <option value="Manufacturing">Manufacturing</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <select 
                name="country" 
                id="country"
                value={searchParams.country || ''}
                onChange={handleInputChange}
              >
                <option value="">All Countries</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="size">Company Size</label>
              <select 
                name="size" 
                id="size"
                value={searchParams.size || ''}
                onChange={handleInputChange}
              >
                <option value="">All Sizes</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501+">501+ employees</option>
              </select>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="search-button"
            disabled={isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>
      
      <div className="search-results">
        <div className="placeholder">
          <h3>Search Results</h3>
          <p>Company search results will appear here in future tasks</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 