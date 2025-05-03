import React, { useState, useEffect } from 'react';
import { CompanyAPI, Company } from '../services/api';
import CompanyCard from '../components/CompanyCard';

const TestPage: React.FC = () => {
  const [query, setQuery] = useState('Best CRM companies');
  const [results, setResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await CompanyAPI.naturalLanguageSearch(query);
      console.log('Search result:', result);
      
      if (result.success) {
        // Normalize companies
        const normalizedCompanies = result.companies.map((company: any) => ({
          ...company,
          id: company.id || company._id,
          name: company.name || 'Unknown Company',
          industry: company.industry || 'Unspecified',
          location: [company.locality, company.region, company.country]
            .filter(Boolean)
            .join(', ') || 'Unknown'
        }));
        
        setResults(normalizedCompanies);
        setMetadata({
          sources: result.sources,
          parsedQuery: result.parsedQuery,
          executionTime: result.meta?.executionTime
        });
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  // Automatically run search when the page loads
  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Natural Language Search Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ 
            padding: '10px', 
            width: '500px', 
            fontSize: '16px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
          placeholder="Enter natural language search query"
        />
        <button
          onClick={handleSearch}
          style={{
            marginLeft: '10px',
            padding: '10px 20px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Search
        </button>
      </div>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          background: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      {metadata && (
        <div style={{ 
          padding: '15px', 
          background: '#f5f5f5', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Search Metadata</h3>
          {metadata.executionTime && (
            <p style={{ margin: '5px 0' }}>
              <strong>Execution time:</strong> {metadata.executionTime}
            </p>
          )}
          {metadata.parsedQuery && (
            <p style={{ margin: '5px 0' }}>
              <strong>Parsed query:</strong> {JSON.stringify(metadata.parsedQuery)}
            </p>
          )}
          {metadata.sources && (
            <p style={{ margin: '5px 0' }}>
              <strong>Data sources:</strong> {
                Object.entries(metadata.sources)
                  .filter(([_, active]: [string, any]) => active)
                  .map(([source]: [string, any]) => source)
                  .join(', ')
              }
            </p>
          )}
        </div>
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading results...</p>
        </div>
      ) : (
        <>
          <h2>Results ({results.length})</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {results.map((company) => (
              <CompanyCard 
                key={company.id} 
                company={company}
                onViewDetails={(id) => console.log('View details:', id)}
              />
            ))}
          </div>
          
          {results.length === 0 && !loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              color: '#666'
            }}>
              <p>No results found. Try a different search query.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TestPage; 