import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullscreen?: boolean;
  overlay?: boolean;
  inline?: boolean;
  type?: 'spinner' | 'pulse' | 'dots';
  className?: string;
}

/**
 * LoadingIndicator Component
 * 
 * Displays a loading indicator with various style options.
 * 
 * @param size - The size of the spinner ('small', 'medium', 'large')
 * @param text - Optional text to display below the spinner
 * @param fullscreen - Whether to display as a fullscreen overlay
 * @param overlay - Whether to display as an overlay on a container
 * @param inline - Whether to display inline with text
 * @param type - The type of spinner ('spinner', 'pulse', 'dots')
 * @param className - Additional CSS class names
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'medium',
  text,
  fullscreen = false,
  overlay = false,
  inline = false,
  type = 'spinner',
  className = ''
}) => {
  // Determine container class names
  const containerClassNames = [
    'loading-container',
    fullscreen ? 'fullscreen' : '',
    overlay ? 'overlay' : '',
    inline ? 'inline' : '',
    className
  ].filter(Boolean).join(' ');
  
  // Render spinner based on type
  const renderSpinner = () => {
    switch(type) {
      case 'pulse':
        return (
          <div className={`pulse-spinner ${size}`}>
            <div className="circle"></div>
            <div className="circle"></div>
            <div className="circle"></div>
          </div>
        );
      case 'dots':
        return (
          <div className={`dots-spinner ${size}`}>
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        );
      case 'spinner':
      default:
        return <div className={`spinner ${size}`}></div>;
    }
  };
  
  return (
    <div className={containerClassNames} role="status" aria-live="polite">
      {renderSpinner()}
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default LoadingIndicator; 