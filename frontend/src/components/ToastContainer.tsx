import React, { useState, useEffect, useCallback } from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
}

// Counter for generating unique toast IDs
let toastIdCounter = 0;

/**
 * ToastContainer Component and Hook
 * 
 * Manages and displays multiple toast notifications.
 * Also includes a custom hook for showing toasts from any component.
 */
const ToastContainer: React.FC<ToastContainerProps> & {
  useToast: () => {
    showToast: (props: Omit<ToastProps, 'id' | 'onClose'>) => string;
    removeToast: (id: string) => void;
    removeAllToasts: () => void;
  }
} = ({ position = 'bottom-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  
  // Remove a toast by ID
  const removeToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);
  
  // Add a new toast
  const addToast = useCallback((toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = `toast-${toastIdCounter++}`;
    
    setToasts(prevToasts => {
      // Limit the number of visible toasts
      const updatedToasts = [
        ...prevToasts,
        { ...toast, id, onClose: removeToast }
      ];
      
      return updatedToasts.slice(-maxToasts); // Keep only the most recent toasts
    });
    
    return id;
  }, [maxToasts, removeToast]);
  
  // Remove all toasts
  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);
  
  // Set up the custom hook for showing toasts
  useEffect(() => {
    ToastContainer.useToast = () => ({
      showToast: addToast,
      removeToast,
      removeAllToasts
    });
  }, [addToast, removeToast, removeAllToasts]);
  
  // Get position class based on position prop
  const getPositionClass = () => {
    switch (position) {
      case 'top-right':
        return 'top-right';
      case 'top-left':
        return 'top-left';
      case 'bottom-left':
        return 'bottom-left';
      case 'bottom-right':
      default:
        return 'bottom-right';
    }
  };
  
  if (toasts.length === 0) return null;
  
  return (
    <div className={`toast-container ${getPositionClass()}`}>
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
};

// Initialize the useToast hook
ToastContainer.useToast = () => {
  console.warn('Toast container not rendered yet');
  return {
    showToast: () => '',
    removeToast: () => {},
    removeAllToasts: () => {}
  };
};

export default ToastContainer; 