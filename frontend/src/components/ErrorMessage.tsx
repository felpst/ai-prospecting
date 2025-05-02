import React from 'react';
import './ErrorMessage.css';

interface ErrorAction {
  text: string;
  onClick: () => void;
  secondary?: boolean;
  icon?: React.ReactNode;
}

interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  technicalDetails?: string;
  actions?: ErrorAction[];
  inline?: boolean;
  small?: boolean;
  className?: string;
}

/**
 * ErrorMessage Component
 * 
 * Displays an error message with various options for customization.
 * 
 * @param title - The error title
 * @param message - The error message
 * @param type - The type of error ('error', 'warning', 'info')
 * @param technicalDetails - Optional technical details for debugging
 * @param actions - Array of action buttons to display
 * @param inline - Whether to display in inline mode
 * @param small - Whether to use smaller styling
 * @param className - Additional CSS class names
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  type = 'error',
  technicalDetails,
  actions = [],
  inline = false,
  small = false,
  className = ''
}) => {
  // Determine container class names
  const containerClassNames = [
    'error-container',
    type !== 'error' ? type : '',
    inline ? 'inline' : '',
    small ? 'small' : '',
    className
  ].filter(Boolean).join(' ');
  
  // Get appropriate icon based on error type
  const renderIcon = () => {
    switch(type) {
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        );
      case 'info':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        );
      case 'error':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
    }
  };
  
  // Get default title based on error type if not provided
  const displayTitle = title || (
    type === 'error' ? 'Error' : 
    type === 'warning' ? 'Warning' : 
    'Information'
  );
  
  return (
    <div className={containerClassNames} role="alert">
      <div className="error-icon">
        {renderIcon()}
      </div>
      
      <div className="error-content">
        <h3 className="error-title">{displayTitle}</h3>
        <p className="error-message">{message}</p>
        
        {technicalDetails && (
          <pre className="error-technical">{technicalDetails}</pre>
        )}
        
        {actions.length > 0 && (
          <div className="error-actions">
            {actions.map((action, index) => (
              <button 
                key={index} 
                className={`error-action ${action.secondary ? 'secondary' : ''}`} 
                onClick={action.onClick}
              >
                {action.icon}
                {action.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage; 