import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './SearchHeader.css';

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  defaultValue?: string;
  activeTab?: 'discover' | 'saved';
  onTabChange?: (tab: 'discover' | 'saved') => void;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({ 
  onSearch, 
  defaultValue = '',
  activeTab = 'discover',
  onTabChange
}) => {
  const [searchQuery, setSearchQuery] = useState(defaultValue);

  // Update search query when defaultValue changes (e.g., when switching tabs)
  useEffect(() => {
    setSearchQuery(defaultValue);
  }, [defaultValue, activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery.trim());
  };

  const handleTabClick = (tab: 'discover' | 'saved', e: React.MouseEvent) => {
    if (onTabChange) {
      e.preventDefault();
      onTabChange(tab);
    }
  };

  return (
    <>
      <div className="search-bar-wrapper">
        <div className="search-bar-container">
          <form onSubmit={handleSubmit} className="search-bar-form">
            <div className="search-input-container">
              <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'discover' 
                  ? "Try 'Best companies that offer a CRM' or 'AI startups in New York'" 
                  : "Search saved companies..."}
                className="search-input"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
              />
              {searchQuery && (
                <button 
                  type="button"
                  className="clear-search-button"
                  onClick={() => {
                    setSearchQuery('');
                    onSearch('');
                  }}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="search-header">
        <nav className="main-nav">
          {onTabChange ? (
            <>
              <a 
                href="#" 
                className={activeTab === 'discover' ? 'active' : ''}
                onClick={(e) => handleTabClick('discover', e)}
              >
                Discover
              </a>
              <a 
                href="#" 
                className={activeTab === 'saved' ? 'active' : ''}
                onClick={(e) => handleTabClick('saved', e)}
              >
                Saved Prospects
              </a>
            </>
          ) : (
            <>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                Discover
              </NavLink>
              <NavLink to="/saved" className={({ isActive }) => isActive ? 'active' : ''}>
                Saved Prospects
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </>
  );
};

export default SearchHeader; 