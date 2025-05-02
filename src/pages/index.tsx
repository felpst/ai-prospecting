import React from 'react';
import CompanyListCard from '../components/CompanyListCard';

// Sample company data
const sampleCompanies = [
  {
    id: '1',
    name: '100despiques',
    url: '100despiques.pt',
    industry: 'marketing and advertising',
    size: '11-50',
    founded: '2010',
    location: 'corroios, setubal',
    isSaved: false,
    initials: '1L',
    logoColor: '#38B2AC', // teal
  },
  {
    id: '2',
    name: '100k intera',
    url: '100k.com.pl',
    industry: 'marketing and advertising',
    size: '1-10',
    founded: '2015',
    location: 'Unknown',
    isSaved: true,
    initials: '1I',
    logoColor: '#4299E1', // blue
  },
  {
    id: '3',
    name: '100media entertainment',
    url: '100media.com',
    industry: 'computer games',
    size: '11-50',
    founded: '2020',
    location: 'houston, texas',
    isSaved: false,
    initials: '1E',
    logoColor: '#9F7AEA', // purple
  },
];

export default function Home() {
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');
  const [savedCompanies, setSavedCompanies] = React.useState<string[]>(['2']);
  
  const handleSaveCompany = (id: string) => {
    setSavedCompanies(prev => 
      prev.includes(id) 
        ? prev.filter(companyId => companyId !== id) 
        : [...prev, id]
    );
  };
  
  const handleViewDetails = (id: string) => {
    console.log(`View details for company ${id}`);
    // Implementation would navigate to company details page
  };
  
  // Update company data with current saved state
  const companies = sampleCompanies.map(company => ({
    ...company,
    isSaved: savedCompanies.includes(company.id)
  }));
  
  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#F7FAFC',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 16px'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '24px' 
        }}>
          Company Search
        </h1>
        
        {/* Search Bar */}
        <div style={{ 
          position: 'relative',
          marginBottom: '24px' 
        }}>
          <input 
            placeholder="Search companies or try 'Fastest growing AR companies in Silicon Valley'" 
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              fontSize: '16px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              outline: 'none'
            }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A0AEC0" 
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        
        {/* View Options and Filter Tabs */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '24px' 
        }}>
          <div style={{ 
            display: 'flex',
            borderBottom: '2px solid #E2E8F0'
          }}>
            <button 
              style={{
                padding: '8px 16px',
                fontWeight: 'bold',
                color: '#4299E1',
                borderBottom: '2px solid #4299E1',
                marginBottom: '-2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Discover
            </button>
            <button
              style={{
                padding: '8px 16px',
                color: '#718096',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Saved Prospects
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#718096', marginRight: '8px' }}>View:</span>
            <button
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'list' ? '#4299E1' : 'transparent',
                color: viewMode === 'list' ? 'white' : '#718096',
                marginRight: '4px',
                cursor: 'pointer'
              }}
              onClick={() => setViewMode('list')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '4px' }}
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              List
            </button>
            <button
              style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'grid' ? '#4299E1' : 'transparent',
                color: viewMode === 'grid' ? 'white' : '#718096',
                cursor: 'pointer'
              }}
              onClick={() => setViewMode('grid')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '4px' }}
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Grid
            </button>
          </div>
        </div>
        
        {/* Results Count */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px', color: '#718096' }}>
            {companies.length} of 100,000 results
          </span>
          
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            color: '#718096'
          }}>
            <span>Sort by:</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: '8px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Name
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginLeft: '4px' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Company List */}
        <div>
          {companies.map(company => (
            <CompanyListCard
              key={company.id}
              company={company}
              onSave={handleSaveCompany}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 