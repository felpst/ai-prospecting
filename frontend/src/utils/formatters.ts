/**
 * Utility functions for formatting data in the UI
 */

/**
 * Format a number as currency
 */
export const formatCurrency = (value: number | undefined, currency = 'USD'): string => {
  if (value === undefined || value === null) return 'N/A';
  
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Format a number as a percentage
 */
export const formatPercentage = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A';
  
  return new Intl.NumberFormat('en-US', { 
    style: 'percent', 
    maximumFractionDigits: 2 
  }).format(value / 100);
};

/**
 * Format a date string into a readable format
 */
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'Invalid date';
  }
};

/**
 * Format a founded year
 */
export const formatFoundedYear = (year: number | undefined): string => {
  if (!year) return 'N/A';
  return year.toString();
};

/**
 * Format a website URL for display
 */
export const formatWebsiteUrl = (url: string | undefined): string => {
  if (!url) return 'N/A';
  
  // Remove protocol for display
  return url.replace(/^https?:\/\//, '');
};

/**
 * Get proper web URL with protocol
 */
export const getWebsiteUrl = (url: string | undefined): string => {
  if (!url) return '';
  
  // Add https if missing
  return url.startsWith('http') ? url : `https://${url}`;
};

/**
 * Format company size range
 */
export const formatCompanySize = (size: string | undefined): string => {
  if (!size) return 'N/A';
  return size;
}; 