import React from 'react';
import './InfoItem.css';

type InfoItemVariant = 'default' | 'muted' | 'highlight';

interface InfoItemProps {
  label: string;
  value: React.ReactNode;
  variant?: InfoItemVariant;
  className?: string;
}

/**
 * Reusable component for displaying label-value pairs
 */
const InfoItem: React.FC<InfoItemProps> = ({ 
  label, 
  value, 
  variant = 'default',
  className = ''
}) => {
  return (
    <div className={`info-item ${variant} ${className}`}>
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
};

export default InfoItem; 