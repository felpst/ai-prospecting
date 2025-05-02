import React, { useEffect, useState } from 'react';
import { Company, CompanyAPI } from '../services/api';
import { getCompanyWithCache } from '../services/cacheService';
import LoadingIndicator from './LoadingIndicator';
import ErrorMessage from './ErrorMessage';
import Modal from './Modal';
import CompanyInfoSection from './CompanyInfoSection';
import InfoItem from './InfoItem';
import { 
  formatFoundedYear,
  formatWebsiteUrl,
  getWebsiteUrl,
  formatDate,
  formatCompanySize
} from '../utils/formatters';
import './CompanyDetailsModal.css';

interface CompanyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
}

// Define interface for enrichment error details
interface EnrichmentError {
  message: string;
  category?: string;
  technicalDetails?: string;
}

// Define interface for company API response
interface CompanyResponse {
  company: Company;
  meta?: {
    executionTime: string;
    enrichmentAvailable: boolean;
    needsRefresh: boolean;
  };
}

const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  companyId 
}) => {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Enrichment state
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [enrichmentError, setEnrichmentError] = useState<EnrichmentError | null>(null);

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!companyId) {
        setError('Company ID is missing');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        console.log('Fetching company data for ID:', companyId);
        const companyData = await getCompanyWithCache(companyId);
        
        console.log('Final company data received by modal:', companyData);
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
    
    if (isOpen && companyId) {
      fetchCompanyDetails();
    }
    
    // Clear the company state when the modal is closed
    return () => {
      if (!isOpen) {
        setCompany(null);
      }
    };
  }, [isOpen, companyId]);

  // Helper function to safely extract and check values
  const getDisplayValue = (value: any, formatter?: (val: any) => string): React.ReactNode => {
    if (value === undefined || value === null || value === '') {
      return 'Not available';
    }
    return formatter ? formatter(value) : String(value);
  };
  
  // Helper function to format location like in the card
  const getFormattedLocation = (locality?: string, region?: string, country?: string): string => {
    if (locality && region) {
      return `${locality}, ${region}`;
    } else if (locality) {
      return locality;
    } else if (region) {
      return region;
    } else if (country) {
      return country;
    }
    return 'Not available';
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    
    if (companyId) {
      getCompanyWithCache(companyId)
        .then(companyData => {
          setCompany(companyData);
          setError(null);
        })
        .catch(err => {
          console.error('Error retrying company details fetch:', err);
          setError('Failed to load company details. Please try again.');
          setCompany(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setError('Company ID is missing');
      setLoading(false);
    }
  };

  const handleEnrichCompany = async () => {
    if (!company || !companyId) return;
    
    setIsEnriching(true);
    setEnrichmentError(null);
    
    try {
      const enrichmentResponse = await CompanyAPI.enrichCompany(companyId);
      
      if (enrichmentResponse.success && enrichmentResponse.enrichment) {
        // Update the company with the new enrichment data
        const updatedCompany = {
          ...company,
          enrichment: enrichmentResponse.enrichment.summary,
          last_enriched: enrichmentResponse.enrichment.timestamp
        };
        setCompany(updatedCompany);
      } else {
        // Handle error from the enrichment response
        throw new Error(enrichmentResponse.error?.message || 'Failed to enrich company data');
      }
    } catch (err: any) {
      console.error('Error enriching company:', err);
      
      let mainMessage = err?.message || 'Failed to enrich company data. Please try again.';
      let techDetails = err?.error?.technicalDetails;
      const category = err?.error?.category;

      // Customize the main message for specific scraping failures
      if (category === 'no_enrichable_source') {
        mainMessage = `Enrichment failed: Could not access website or LinkedIn profile for "${company?.name || 'this company'}".`;
      } else if (category?.startsWith('website_') || category === 'linkedin_scrape_failed') { // Handle other scrape errors
        mainMessage = `Enrichment failed: Could not retrieve information from the company's web presence.`;
      }
      
      // Provide a fallback for technical details if missing
      if (!techDetails) {
         techDetails = 'No specific technical details available from the backend.';
      }
      
      setEnrichmentError({
        message: mainMessage,
        technicalDetails: techDetails 
      });
    } finally {
      setIsEnriching(false);
    }
  };
  
  const handleRetryEnrichment = () => {
    setEnrichmentError(null);
    handleEnrichCompany();
  };

  // Modal content based on loading/error state
  let modalContent;
  
  if (loading) {
    modalContent = (
      <div className="loading-container">
        <LoadingIndicator />
        <p>Loading company details...</p>
      </div>
    );
  } else if (error) {
    modalContent = (
      <ErrorMessage 
        message={error} 
        actions={[
          {
            text: 'Try Again',
            onClick: handleRetry
          }
        ]} 
      />
    );
  } else if (!company) {
    modalContent = (
      <div className="not-found-message">
        <h2>Company Not Found</h2>
        <p>The company you are looking for could not be found.</p>
      </div>
    );
  } else {
    const hasIndustry = company.industry !== undefined && company.industry !== null && company.industry !== '';
    const hasSize = company.size !== undefined && company.size !== null && company.size !== '';
    const hasFounded = company.founded !== undefined && company.founded !== null;
    
    modalContent = (
      <div className="company-details-content">
        {/* Basic Information Section */}
        <CompanyInfoSection title="Basic Information">
          <InfoItem 
            label="Industry" 
            value={hasIndustry ? company.industry : 'Unknown'} 
          />
          <InfoItem 
            label="Company Size" 
            value={hasSize ? formatCompanySize(company.size) : 'Unknown'} 
          />
          <InfoItem 
            label="Founded" 
            value={hasFounded ? formatFoundedYear(company.founded) : 'Unknown'} 
          />
        </CompanyInfoSection>

        {/* Location Section */}
        <CompanyInfoSection title="Location">
          <InfoItem 
            label="Location" 
            value={getFormattedLocation(company.locality, company.region, company.country)} 
          />
        </CompanyInfoSection>

        {/* Contact Information Section */}
        <CompanyInfoSection title="Contact">
          {company.website ? (
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
          ) : (
            <InfoItem label="Website" value="Not available" />
          )}
          
          {company.linkedin_url ? (
            <InfoItem
              label="LinkedIn"
              value={
                <a
                  href={company.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {company.linkedin_url && company.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\//, 'linkedin.com/')}
                </a>
              }
            />
          ) : (
            <InfoItem label="LinkedIn" value="Not available" />
          )}
        </CompanyInfoSection>
        
        {/* AI Enrichment Section */}
        <CompanyInfoSection 
          title="AI Enrichment" 
          className="enrichment-section"
          titleAction={
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
          }
        >
          {company.last_enriched && (
            <div className="last-enriched">
              Last enriched: {formatDate(company.last_enriched)}
            </div>
          )}
          
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
              <p>No AI-generated insights available yet. Click the "Enrich with AI" button to generate a summary for this company.</p>
            </div>
          )}
        </CompanyInfoSection>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={company?.name || 'Company Details'}
      size="large"
    >
      {modalContent}
    </Modal>
  );
};

export default CompanyDetailsModal; 