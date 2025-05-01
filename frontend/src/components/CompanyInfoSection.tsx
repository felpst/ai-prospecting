import React from 'react';
import './CompanyInfoSection.css';

interface CompanyInfoSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable section component for company details
 */
const CompanyInfoSection: React.FC<CompanyInfoSectionProps> = ({ 
  title, 
  children, 
  className = '' 
}) => {
  return (
    <section className={`details-section ${className}`}>
      <h2 className="section-title">{title}</h2>
      <div className="section-content">
        {children}
      </div>
    </section>
  );
};

export default CompanyInfoSection; 