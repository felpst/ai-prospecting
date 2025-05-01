import './ErrorMessage.css';

interface ErrorMessageProps {
  title?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Error',
  message,
  actionText = 'Try Again',
  onAction
}) => {
  return (
    <div className="error-container" role="alert">
      <div className="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 className="error-title">{title}</h3>
      <p className="error-message">{message}</p>
      {onAction && (
        <button className="error-action" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};

export default ErrorMessage; 