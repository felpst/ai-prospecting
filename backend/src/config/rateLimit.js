/**
 * Rate Limiting Configuration
 * Provides domain-specific settings for rate limiting
 */

/**
 * Rate limiting settings for different domains
 * Each entry specifies customized timing for specific websites
 */
export const DOMAIN_RATE_LIMITS = {
  // Social media platforms (strict rate limiting)
  'linkedin.com': {
    minDelay: 5000,      // 5 seconds minimum delay
    maxDelay: 8000,      // 8 seconds maximum delay
    maxPerDomain: 1,     // Only 1 concurrent request
    maxPerMinute: 5      // Only 5 requests per minute
  },
  'twitter.com': {
    minDelay: 5000,
    maxDelay: 7000,
    maxPerDomain: 1,
    maxPerMinute: 6
  },
  'facebook.com': {
    minDelay: 6000,
    maxDelay: 10000,
    maxPerDomain: 1,
    maxPerMinute: 5
  },
  
  // E-commerce sites (moderate rate limiting)
  'amazon.com': {
    minDelay: 4000,
    maxDelay: 6000,
    maxPerDomain: 1,
    maxPerMinute: 8
  },
  'ebay.com': {
    minDelay: 3000,
    maxDelay: 5000,
    maxPerDomain: 2,
    maxPerMinute: 10
  },
  
  // Public information sites (more lenient)
  'wikipedia.org': {
    minDelay: 2000,
    maxDelay: 4000,
    maxPerDomain: 2,
    maxPerMinute: 15
  },
  'github.com': {
    minDelay: 3000,
    maxDelay: 5000,
    maxPerDomain: 2,
    maxPerMinute: 10
  },
  
  // Default values (applied if no domain-specific settings)
  'default': {
    minDelay: 2000,      // 2 seconds minimum delay
    maxDelay: 5000,      // 5 seconds maximum delay
    maxPerDomain: 1,     // 1 concurrent request to same domain
    maxPerMinute: 15     // 15 requests per minute max
  }
};

/**
 * Get rate limit settings for a specific domain
 * @param {string} domain - Domain name
 * @returns {Object} Rate limiting configuration
 */
export const getRateLimitForDomain = (domain) => {
  // First try exact match
  if (DOMAIN_RATE_LIMITS[domain]) {
    return DOMAIN_RATE_LIMITS[domain];
  }
  
  // Then try parent domain match (e.g., 'subdomain.example.com' -> 'example.com')
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(parts.length - 2).join('.');
    if (DOMAIN_RATE_LIMITS[parentDomain]) {
      return DOMAIN_RATE_LIMITS[parentDomain];
    }
  }
  
  // Fall back to default settings
  return DOMAIN_RATE_LIMITS.default;
};

/**
 * Special patterns that should trigger more aggressive rate limiting
 * Used to detect sites that are more sensitive to scraping
 */
export const SENSITIVE_URL_PATTERNS = [
  /login/i,         // Login pages
  /signin/i,        // Sign-in pages
  /signup/i,        // Sign-up pages
  /register/i,      // Registration pages
  /account/i,       // Account pages
  /checkout/i,      // Checkout flows
  /captcha/i,       // Any page with captcha in URL
  /antibot/i,       // Anti-bot pages
  /user/i,          // User profile pages
  /profile/i,       // Profile pages
  /admin/i,         // Admin sections
  /dashboard/i      // Dashboard pages
];

/**
 * Check if a URL is sensitive and should use more aggressive rate limiting
 * @param {string} url - URL to check
 * @returns {boolean} True if URL matches sensitive patterns
 */
export const isSensitiveUrl = (url) => {
  return SENSITIVE_URL_PATTERNS.some(pattern => pattern.test(url));
};

/**
 * Get rate limit adjustment for sensitive URLs
 * @returns {Object} - Multipliers for rate limit settings
 */
export const getSensitiveRateLimitMultipliers = () => {
  return {
    minDelayMultiplier: 2.0,    // Double the minimum delay
    maxDelayMultiplier: 2.0,    // Double the maximum delay
    maxPerMinuteDivisor: 2.0,   // Half the requests per minute
    maxPerDomainDivisor: 1.0    // Keep max concurrent the same
  };
}; 