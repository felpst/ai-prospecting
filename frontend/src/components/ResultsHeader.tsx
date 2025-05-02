import React, { useState, useRef, useEffect } from 'react';
import './ResultsHeader.css';

interface ResultsHeaderProps {
  count: number;
  total: number;
  onSortChange: (sort: string, order: 'asc' | 'desc') => void;
  onViewChange: (view: 'grid' | 'list') => void;
  currentSort: string;
  currentOrder: 'asc' | 'desc';
  currentView: 'grid' | 'list';
}

const ResultsHeader: React.FC<ResultsHeaderProps> = ({
  count,
  total,
  onSortChange,
  onViewChange,
  currentSort,
  currentOrder,
  currentView
}) => {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
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

  const toggleSortMenu = () => {
    setSortMenuOpen(!sortMenuOpen);
  };

  const handleSortChange = (sort: string) => {
    onSortChange(sort, currentOrder);
    setSortMenuOpen(false);
  };

  const toggleSortOrder = () => {
    onSortChange(currentSort, currentOrder === 'asc' ? 'desc' : 'asc');
  };

  const getSortLabel = () => {
    switch (currentSort) {
      case 'name':
        return 'Name';
      case 'founded':
        return 'Founded';
      case 'size':
        return 'Size';
      default:
        return 'Name';
    }
  };

  return (
    <div className="results-header">
      <div className="results-info">
        <p className="results-count">
          {count > 0 ? `${count} of ${total.toLocaleString()} results` : 'No results found'}
        </p>
        
        <div className="results-controls">
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
                    className={`sort-option ${currentSort === 'name' ? 'active' : ''}`}
                    onClick={() => handleSortChange('name')}
                  >
                    Name
                    {currentSort === 'name' && (
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                  <button
                    className={`sort-option ${currentSort === 'founded' ? 'active' : ''}`}
                    onClick={() => handleSortChange('founded')}
                  >
                    Founded
                    {currentSort === 'founded' && (
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                  <button
                    className={`sort-option ${currentSort === 'size' ? 'active' : ''}`}
                    onClick={() => handleSortChange('size')}
                  >
                    Size
                    {currentSort === 'size' && (
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
              aria-label={currentOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
              title={currentOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
            >
              {currentOrder === 'asc' ? (
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
              className={`view-button ${currentView === 'list' ? 'active' : ''}`}
              onClick={() => onViewChange('list')}
              aria-label="List view"
              title="List view"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="currentColor" />
              </svg>
            </button>
            <button
              className={`view-button ${currentView === 'grid' ? 'active' : ''}`}
              onClick={() => onViewChange('grid')}
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
  );
};

export default ResultsHeader; 