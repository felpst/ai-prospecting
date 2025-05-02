import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Toast.css';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  id: string;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: (id: string) => void;
}

/**
 * Toast Component
 * 
 * Displays a notification message that automatically dismisses after a set duration.
 * 
 * @param id - Unique identifier for the toast
 * @param title - Optional title for the toast
 * @param message - Main message content
 * @param type - Type of toast (info, success, warning, error)
 * @param duration - How long the toast should display in milliseconds (0 for no auto-dismiss)
 * @param onClose - Callback function when toast is closed
 */
const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose
}) => {
  const [exiting, setExiting] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle closing the toast
  const handleClose = useCallback(() => {
    if (exiting) return;
    
    setExiting(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Wait for exit animation to complete before calling onClose
    setTimeout(() => {
      if (onClose) {
        onClose(id);
      }
    }, 300);
  }, [id, onClose, exiting]);

  // Set up auto-dismiss
  useEffect(() => {
    if (duration > 0) {
      // Start the progress bar animation
      if (progressRef.current) {
        progressRef.current.style.animation = `progress ${duration / 1000}s linear forwards`;
      }
      
      // Set the timeout for auto-dismiss
      timeoutRef.current = setTimeout(() => {
        handleClose();
      }, duration);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, handleClose]);

  // Get icon based on toast type
  const renderIcon = () => {
    switch(type) {
      case 'success':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        );
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        );
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
      case 'info':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        );
    }
  };

  return (
    <div className={`toast ${type} ${exiting ? 'exiting' : ''}`} role="alert">
      <div className="toast-icon">
        {renderIcon()}
      </div>
      
      <div className="toast-content">
        {title && <h4 className="toast-title">{title}</h4>}
        <p className="toast-message">{message}</p>
      </div>
      
      <button className="toast-close" onClick={handleClose} aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      {duration > 0 && (
        <div className="progress-bar">
          <div className="progress-bar-inner" ref={progressRef}></div>
        </div>
      )}
    </div>
  );
};

export default Toast; 