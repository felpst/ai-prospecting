import React from 'react';
import './CompanyInfoSection.css';

interface CompanyInfoSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleAction?: React.ReactNode;
}

/**
 * Reusable section component for company details
 */
const CompanyInfoSection: React.FC<CompanyInfoSectionProps> = ({ 
  title, 
  children, 
  className = '',
  titleAction
}) => {
  return (
    <section className={`details-section ${className}`}>
      <div className="section-title">
        <h2 className="section-title-text">{title}</h2>
        {titleAction && <div className="section-title-action">{titleAction}</div>}
      </div>
      <div className="section-content">
        {children}
      </div>
    </section>
  );
};

export default CompanyInfoSection; 