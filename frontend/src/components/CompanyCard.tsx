import { useState } from 'react';
import { Company } from '../services/api';
import './CompanyCard.css';

interface CompanyCardProps {
  company: Company;
  onSave?: (id: string) => void;
  onUnsave?: (id: string) => void;
  isSaved?: boolean;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ 
  company, 
  onSave, 
  onUnsave, 
  isSaved = false 
}) => {
  const [saved, setSaved] = useState<boolean>(isSaved);

  const handleSaveToggle = () => {
    if (saved) {
      onUnsave?.(company.id);
      setSaved(false);
    } else {
      onSave?.(company.id);
      setSaved(true);
    }
  };

  return (
    <div className="company-card">
      <div className="company-card-header">
        <h3>{company.name}</h3>
        {(onSave || onUnsave) && (
          <button 
            className={`save-button ${saved ? 'saved' : ''}`}
            onClick={handleSaveToggle}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
      
      <div className="company-card-content">
        {company.industry && <p><strong>Industry:</strong> {company.industry}</p>}
        {company.size && <p><strong>Size:</strong> {company.size}</p>}
        
        {(company.locality || company.region || company.country) && (
          <p>
            <strong>Location:</strong> {[
              company.locality, 
              company.region, 
              company.country
            ].filter(Boolean).join(', ')}
          </p>
        )}
        
        {company.founded && <p><strong>Founded:</strong> {company.founded}</p>}
        
        {company.website && (
          <p>
            <strong>Website:</strong>{' '}
            <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
               target="_blank" 
               rel="noopener noreferrer">
              {company.website}
            </a>
          </p>
        )}

        {company.linkedin_url && (
          <p>
            <strong>LinkedIn:</strong>{' '}
            <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
              Profile
            </a>
          </p>
        )}
      </div>

      {company.enrichment && (
        <div className="company-card-enrichment">
          <h4>AI Summary</h4>
          <p>{company.enrichment}</p>
          {company.last_enriched && (
            <small>Generated on: {new Date(company.last_enriched).toLocaleDateString()}</small>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyCard; 