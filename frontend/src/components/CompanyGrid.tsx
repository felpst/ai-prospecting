import { Company } from '../services/api';
import CompanyCard from './CompanyCard';
import './CompanyGrid.css';

interface CompanyGridProps {
  companies: Company[];
  isLoading: boolean;
  onSaveCompany?: (id: string) => void;
  onUnsaveCompany?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  savedCompanies?: string[];
  viewMode?: 'grid' | 'list';
}

const CompanyGrid: React.FC<CompanyGridProps> = ({
  companies,
  isLoading,
  onSaveCompany,
  onUnsaveCompany,
  onViewDetails,
  savedCompanies = [],
  viewMode = 'grid'
}) => {
  // Ensure companies is always an array
  const validCompanies = Array.isArray(companies) ? companies : [];
  
  if (isLoading) {
    return (
      <div className="company-grid-loading">
        <p>Loading companies...</p>
      </div>
    );
  }

  if (!validCompanies.length) {
    return (
      <div className="company-grid-empty">
        <p>No companies found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className={`company-${viewMode}`}>
      {validCompanies
        .filter(company => company && company.id) // Filter out invalid companies
        .map(company => (
          <div className={`company-${viewMode}-item`} key={company.id}>
            <CompanyCard
              company={company}
              onSave={onSaveCompany}
              onUnsave={onUnsaveCompany}
              onViewDetails={onViewDetails}
              isSaved={savedCompanies.includes(company.id)}
            />
          </div>
        ))}
    </div>
  );
};

export default CompanyGrid; 