import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Company, CompanyAPI } from '../services/api';
import { getCompanyWithCache, clearCompanyCache } from '../services/cacheService';
import LoadingIndicator from '../components/LoadingIndicator';
import ErrorMessage from '../components/ErrorMessage';
import CompanyInfoSection from '../components/CompanyInfoSection';
import InfoItem from '../components/InfoItem';
import { 
  formatFoundedYear,
  formatWebsiteUrl,
  getWebsiteUrl,
  formatDate,
  formatCompanySize
} from '../utils/formatters';
import './CompanyDetailsPage.css';

// Define interface for enrichment error details
interface EnrichmentError {
  message: string;
  category?: string;
  technicalDetails?: string;
}

const CompanyDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Enrichment state
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [enrichmentError, setEnrichmentError] = useState<EnrichmentError | null>(null);

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!id) {
        setError('Company ID is missing');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const companyData = await getCompanyWithCache(id);
        setCompany(companyData);
        setError(null);
      } catch (err) {
        console.error('Error fetching company details:', err);
        setError('Failed to load company details. Please try again.');
        setCompany(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompanyDetails();
  }, [id]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    // Rerun the effect
    const fetchCompanyDetails = async () => {
      if (!id) {
        setError('Company ID is missing');
        setLoading(false);
        return;
      }

      try {
        const companyData = await getCompanyWithCache(id);
        setCompany(companyData);
        setError(null);
      } catch (err) {
        console.error('Error fetching company details:', err);
        setError('Failed to load company details. Please try again.');
        setCompany(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompanyDetails();
  };

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };
  
  // Handle enrichment
  const handleEnrichCompany = async () => {
    if (!id || !company) return;
    
    setIsEnriching(true);
    setEnrichmentError(null);
    
    try {
      const response = await CompanyAPI.enrichCompany(id);
      
      // Clear cache and update local state
      clearCompanyCache(id);
      
      if (response && response.success && response.enrichment) {
        // Create updated company object with enrichment data
        const updatedCompany = {
          ...company,
          enrichment: response.enrichment.summary,
          last_enriched: response.enrichment.timestamp
        };
        
        setCompany(updatedCompany);
      } else {
        throw new Error('Invalid response from enrichment service');
      }
    } catch (err: any) {
      console.error('Error enriching company:', err);
      
      // Handle API error response with detailed information
      if (err.response?.data) {
        const errorData = err.response.data;
        setEnrichmentError({
          message: errorData.error?.message || errorData.message || 'Failed to enrich company data. Please try again later.',
          category: errorData.error?.category || 'general_error',
          technicalDetails: errorData.error?.technicalDetails
        });
      } else {
        setEnrichmentError({
          message: 'Failed to enrich company data. Please try again later.',
          category: 'network_error'
        });
      }
    } finally {
      setIsEnriching(false);
    }
  };

  // Handle retry for enrichment errors
  const handleRetryEnrichment = () => {
    setEnrichmentError(null);
    handleEnrichCompany();
  };

  if (loading) {
    return (
      <div className="page company-details-page">
        <div className="company-details-header">
          <button className="back-button" onClick={handleBack}>
            ← Back to results
          </button>
        </div>
        <div className="loading-container">
          <LoadingIndicator />
          <p>Loading company details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page company-details-page">
        <div className="company-details-header">
          <button className="back-button" onClick={handleBack}>
            ← Back to results
          </button>
        </div>
        <ErrorMessage message={error} onAction={handleRetry} />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="page company-details-page">
        <div className="company-details-header">
          <button className="back-button" onClick={handleBack}>
            ← Back to results
          </button>
        </div>
        <div className="not-found-message">
          <h2>Company Not Found</h2>
          <p>The company you are looking for could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page company-details-page">
      <div className="company-details-header">
        <button className="back-button" onClick={handleBack}>
          ← Back to results
        </button>
        <h1>{company.name}</h1>
      </div>

      <div className="company-details-content">
        {/* Basic Information Section */}
        <CompanyInfoSection title="Basic Information">
          {company.industry && (
            <InfoItem label="Industry" value={company.industry} />
          )}
          {company.size && (
            <InfoItem label="Company Size" value={formatCompanySize(company.size)} />
          )}
          {company.founded && (
            <InfoItem label="Founded" value={formatFoundedYear(company.founded)} />
          )}
        </CompanyInfoSection>

        {/* Location Section */}
        {(company.locality || company.region || company.country) && (
          <CompanyInfoSection title="Location">
            {company.locality && (
              <InfoItem label="City" value={company.locality} />
            )}
            {company.region && (
              <InfoItem label="Region" value={company.region} />
            )}
            {company.country && (
              <InfoItem label="Country" value={company.country} />
            )}
          </CompanyInfoSection>
        )}

        {/* Contact Information Section */}
        {(company.website || company.linkedin_url) && (
          <CompanyInfoSection title="Contact Information">
            {company.website && (
              <InfoItem 
                label="Website" 
                value={
                  <a 
                    href={getWebsiteUrl(company.website)} 
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatWebsiteUrl(company.website)}
                  </a>
                } 
              />
            )}
            {company.linkedin_url && (
              <InfoItem 
                label="LinkedIn" 
                value={
                  <a 
                    href={company.linkedin_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Profile
                  </a>
                } 
              />
            )}
          </CompanyInfoSection>
        )}

        {/* AI Enrichment Section */}
        <CompanyInfoSection title="AI Enrichment" className="enrichment-section">
          <div className="enrichment-header">
            {company.last_enriched && (
              <div className="last-enriched">
                Last enriched: {formatDate(company.last_enriched)}
              </div>
            )}
            
            <button 
              className={`enrichment-button ${isEnriching ? 'loading' : ''}`}
              onClick={handleEnrichCompany}
              disabled={isEnriching}
            >
              {isEnriching ? (
                <>
                  <span className="loading-spinner"></span>
                  Enriching...
                </>
              ) : (
                <>Enrich with AI</>
              )}
            </button>
          </div>
          
          {enrichmentError && (
            <div className="enrichment-error">
              <p className="error-message">{enrichmentError.message}</p>
              {enrichmentError.technicalDetails && (
                <details>
                  <summary>Technical Details</summary>
                  <p className="technical-details">{enrichmentError.technicalDetails}</p>
                </details>
              )}
              <button 
                className="retry-button"
                onClick={handleRetryEnrichment}
              >
                Try Again
              </button>
            </div>
          )}
          
          {company.enrichment ? (
            <div className="enrichment-content">
              <p>{company.enrichment}</p>
            </div>
          ) : (
            <div className="placeholder-content">
              <p>No AI enrichment data available yet. Click the button above to generate AI-powered insights about this company.</p>
            </div>
          )}
        </CompanyInfoSection>
      </div>
    </div>
  );
};

export default CompanyDetailsPage; 