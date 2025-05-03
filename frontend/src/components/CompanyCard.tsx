import React, { useState } from 'react';
import { Company } from '../services/api';
import InfoItem from './InfoItem';
import './CompanyCard.css';

interface CompanyCardProps {
  company: Company;
  isSaved?: boolean;
  onSave?: (id: string) => void;
  onUnsave?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ 
  company, 
  isSaved = false,
  onSave,
  onUnsave,
  onViewDetails
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getLogoClass = () => {
    if (!company.industry) return 'company-logo-default';
    
    const industry = company.industry.toLowerCase();
    
    if (industry.includes('tech') || industry.includes('software')) {
      return 'company-logo-tech';
    } else if (industry.includes('health')) {
      return 'company-logo-healthcare';
    } else if (industry.includes('edu')) {
      return 'company-logo-education';
    } else if (industry.includes('finance') || industry.includes('financial')) {
      return 'company-logo-financial';
    } else if (industry.includes('retail')) {
      return 'company-logo-retail';
    } else if (industry.includes('furniture')) {
      return 'company-logo-furniture';
    }
    
    return 'company-logo-default';
  };
  
  const getInitials = (name: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(part => part && part[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const handleBookmarkClick = () => {
    if (isSaved) {
      onUnsave && onUnsave(company.id);
    } else {
      onSave && onSave(company.id);
    }
  };

  // Check if enrichment exists and has content - safely
  const hasEnrichment = company && company.enrichment && typeof company.enrichment === 'string' && company.enrichment.trim().length > 0;
  
  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  const handleGenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This would be connected to an API call in the real implementation
    console.log('Generate AI summary for:', company.id);
    // Example implementation would call: CompanyAPI.generateAISummary(company.id);
  };
  
  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onViewDetails) {
      onViewDetails(company.id);
    }
  };
  
  // Try to safely get data or show default
  const getSafe = (value: any, defaultValue: string = 'Unknown') => {
    return value || defaultValue;
  };
  
  if (!company) {
    return null;
  }
  
  return (
    <div className="company-card">
      <div className="company-card-header">
        <div className="company-info">
          <div className={`company-logo ${getLogoClass()}`}>
            {getInitials(company.name || '')}
          </div>
          <div className="company-title">
            <h3 className="company-name">{getSafe(company.name)}</h3>
            {company.website && (
              <a 
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                className="company-website"
                target="_blank"
                rel="noopener noreferrer"
              >
                {company.website}
              </a>
            )}
          </div>
        </div>
        
        <button 
          className={`company-bookmark ${isSaved ? 'saved' : ''}`}
          onClick={handleBookmarkClick}
          aria-label={isSaved ? "Remove from saved" : "Save company"}
          title={isSaved ? "Remove from saved" : "Save company"}
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d={isSaved 
              ? "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" 
              : "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"} 
              fill="currentColor"/>
          </svg>
        </button>
      </div>
      
      <div className="company-body">
        <div className="company-grid">
          <InfoItem 
            label="Industry" 
            value={getSafe(company.industry)} 
          />
          <InfoItem 
            label="Size" 
            value={getSafe(company.size)} 
          />
          <InfoItem 
            label="Founded" 
            value={company.founded ? company.founded.toString() : 'Unknown'} 
          />
          <InfoItem 
            label="Location" 
            value={getSafe(company.locality 
              ? `${company.locality}, ${company.region || ''}`
              : company.region || company.country || 'Unknown'
            )} 
          />
        </div>
        
        <div 
          className={`enrichment-summary ${!isExpanded ? 'collapsed' : ''}`}
          onClick={toggleExpand}
        >
          <div className="enrichment-summary-header">
            <div className="ai-badge">
              <svg className="ai-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 21h-1l1-7H7.5c-.58 0-.65-.89-.21-1.29L13 7h1l-1 7h3.5c.58 0 .65.89.21 1.29L11 21z" />
              </svg>
              AI Summary
            </div>
            
            <button 
              className="expand-button"
              onClick={toggleExpand}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isExpanded ? (
                  <polyline points="18 15 12 9 6 15"></polyline>
                ) : (
                  <polyline points="6 9 12 15 18 9"></polyline>
                )}
              </svg>
            </button>
          </div>
          
          <div className="enrichment-content">
            {hasEnrichment ? (
              <p>{company.enrichment}</p>
            ) : (
              <div>
                <p>No AI summary available for this company yet.</p>
                <button 
                  className="generate-button"
                  onClick={handleGenerateClick}
                >
                  Generate Summary
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="company-card-actions">
        <button 
          onClick={handleViewDetails}
          className="view-details-button"
          aria-label="View company details"
        >
          View Details
        </button>
        
        {company.linkedin_url && (
          <a 
            href={company.linkedin_url}
            className="linkedin-button"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on LinkedIn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
};

export default CompanyCard; 