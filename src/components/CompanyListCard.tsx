import React from 'react';

interface CompanyListCardProps {
  company: {
    id: string;
    name: string;
    url: string;
    industry: string;
    size: string;
    founded: string;
    location: string;
    isSaved?: boolean;
    initials?: string;
    logoColor?: string;
  };
  onSave?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

const CompanyListCard: React.FC<CompanyListCardProps> = ({ company, onSave, onViewDetails }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  // Get color for company size badge
  const getSizeColor = (size: string) => {
    switch(size) {
      case '1-10': return '#48BB78'; // green
      case '11-50': return '#4299E1'; // blue
      case '51-200': return '#9F7AEA'; // purple
      case '201-500': return '#ED8936'; // orange
      case '501-1000': return '#E53E3E'; // red
      default: return '#718096'; // gray
    }
  };
  
  return (
    <div 
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        marginBottom: '12px',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        e.currentTarget.style.borderColor = '#BEE3F8';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#E2E8F0';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Main Card Content - Streamlined horizontal layout */}
      <div style={{ 
        display: 'flex', 
        padding: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%'
      }}>
        {/* Left Section: Company Identity */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          width: '25%',
          minWidth: '200px'
        }}>
          {/* Company Initial/Logo */}
          <div 
            style={{
              background: company.logoColor || '#4299E1',
              color: 'white',
              borderRadius: '6px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
              flexShrink: 0,
              marginRight: '16px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            {company.initials}
          </div>
          
          {/* Company Name and URL */}
          <div style={{ minWidth: 0 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '2px'
            }}>
              <span style={{ 
                fontWeight: '600', 
                fontSize: '16px', 
                color: '#2D3748',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginRight: '6px'
              }}>
                {company.name}
              </span>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  lineHeight: 0,
                  marginLeft: 'auto'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSave && onSave(company.id);
                }}
                aria-label={company.isSaved ? "Unsave company" : "Save company"}
                title={company.isSaved ? "Remove from saved" : "Save company"}
              >
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill={company.isSaved ? "#ECC94B" : "none"} 
                  stroke={company.isSaved ? "#ECC94B" : "#A0AEC0"} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
            </div>
            <span style={{ 
              fontSize: '13px', 
              color: '#718096',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block'
            }}>
              {company.url}
            </span>
          </div>
        </div>

        {/* Middle Section: Company Metadata */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          flexGrow: 1,
          maxWidth: '50%'
        }}>
          {/* Industry */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            minWidth: 0
          }}>
            <span style={{ 
              fontSize: '11px', 
              color: '#718096', 
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px'
            }}>
              Industry
            </span>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#4A5568',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {company.industry}
            </span>
          </div>
          
          {/* Size - as a badge */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ 
              fontSize: '11px', 
              color: '#718096', 
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px'
            }}>
              Size
            </span>
            <span style={{ 
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: `${getSizeColor(company.size)}20`,
              color: getSizeColor(company.size),
              padding: '3px 8px',
              borderRadius: '4px',
              display: 'inline-block',
              width: 'fit-content'
            }}>
              {company.size}
            </span>
          </div>
          
          {/* Founded */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ 
              fontSize: '11px', 
              color: '#718096', 
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px'
            }}>
              Founded
            </span>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#4A5568'
            }}>
              {company.founded}
            </span>
          </div>
          
          {/* Location */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gridColumn: 'span 3',
            minWidth: 0
          }}>
            <span style={{ 
              fontSize: '11px', 
              color: '#718096', 
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px'
            }}>
              Location
            </span>
            <span style={{ 
              fontSize: '14px',
              fontWeight: '500',
              color: '#4A5568',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {company.location}
            </span>
          </div>
        </div>

        {/* Right Section: Actions */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          marginLeft: 'auto'
        }}>
          {/* View details button */}
          <button 
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              border: '1px solid #3182CE',
              color: '#3182CE',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onClick={() => onViewDetails && onViewDetails(company.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EBF8FF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            View details
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          
          {/* LinkedIn button */}
          <button 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#0077B5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="View on LinkedIn"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EBF8FF';
              e.currentTarget.style.borderColor = '#BEE3F8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
              <rect x="2" y="9" width="4" height="12"></rect>
              <circle cx="4" cy="4" r="2"></circle>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Expandable AI Summary Section */}
      <div style={{ borderTop: '1px solid #E2E8F0' }}></div>
      <div 
        style={{ 
          display: 'flex', 
          padding: '10px 16px', 
          alignItems: 'center',
          cursor: 'pointer',
          backgroundColor: isExpanded ? '#F7FAFC' : 'transparent',
          transition: 'background-color 0.2s'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#3182CE" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          style={{ marginRight: '8px' }}
        >
          {isExpanded ? (
            <polyline points="18 15 12 9 6 15"></polyline>
          ) : (
            <polyline points="6 9 12 15 18 9"></polyline>
          )}
        </svg>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: '500', 
          color: '#3182CE',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#3182CE" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          AI Summary
        </span>
      </div>
      
      {isExpanded && (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#F7FAFC',
          borderTop: '1px solid #E2E8F0'
        }}>
          <p style={{ 
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#4A5568',
            margin: 0
          }}>
            This company specializes in {company.industry} solutions. 
            Founded in {company.founded} and based in {company.location}, 
            they currently have a team size of {company.size} employees.
            {/* This would be replaced with actual AI summary content */}
          </p>
        </div>
      )}
    </div>
  );
};

export default CompanyListCard; 