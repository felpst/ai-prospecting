import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullscreen?: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'medium',
  text,
  fullscreen = false
}) => {
  const containerClass = fullscreen ? 'loading-container fullscreen' : 'loading-container';
  
  return (
    <div className={containerClass} role="status" aria-live="polite">
      <div className={`spinner ${size}`}></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default LoadingIndicator; 