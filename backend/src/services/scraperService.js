/**
 * Scraper Service
 * Provides web scraping functionality using Playwright
 */

import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';
import {
  ScraperError,
  NavigationError,
  NetworkError,
  AccessDeniedError,
  ExtractionError,
  BrowserError,
  TimeoutError,
  withRetry,
  CircuitBreaker
} from '../utils/scraperErrors.js';
import { getRateLimiter } from '../utils/rateLimiter.js';
import { getRateLimitForDomain, isSensitiveUrl, getSensitiveRateLimitMultipliers } from '../config/rateLimit.js';
import { 
  saveScrapedContent, 
  updateScrapedContentStatus, 
  getScrapedContent 
} from './storageService.js';

// Browser instance cache
let browserInstance = null;

// Default configuration
const DEFAULT_CONFIG = {
  headless: process.env.NODE_ENV === 'production',
  viewport: { width: 1280, height: 800 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  timeout: 30000,
  retries: 3
};

// Common selector patterns for content extraction
const CONTENT_SELECTORS = {
  // Main content selectors (article body, main content area)
  mainContent: [
    'article', 'main', '.content', '#content', '.post-content',
    '[role="main"]', '.main-content', '.entry-content', '.page-content'
  ],
  
  // About company information selectors
  aboutCompany: [
    '.about', '#about', '.about-us', '#about-us', '.company-info',
    '[data-testid="about"]', 'section.about', 'div.about-section'
  ],
  
  // Product/Service description selectors
  products: [
    '.products', '#products', '.services', '#services',
    '.product-description', '.service-description',
    'section.products', 'section.services'
  ],
  
  // Team information selectors
  team: [
    '.team', '#team', '.our-team', '#our-team', '.members',
    '.leadership', '.staff', 'section.team', '.team-members'
  ],
  
  // Contact information selectors
  contact: [
    '.contact', '#contact', '.contact-info', '.contact-us',
    'footer .contact', 'address', '.vcard', '.contact-details'
  ],
  
  // Elements to exclude from content extraction
  exclude: [
    'nav', 'header', 'footer', '.nav', '.navigation', '.menu',
    '.sidebar', '.widget', '.ad', '.advertisement', '.cookie',
    '.popup', '.modal', '.banner', 'aside', '.aside', 
    'script', 'style', 'noscript', 'svg', 'form', '.form'
  ]
};

// Circuit breaker instances for different domains
const domainCircuitBreakers = new Map();

/**
 * Get a circuit breaker for a domain
 * @param {string} url - URL to extract domain from
 * @returns {CircuitBreaker} Circuit breaker for the domain
 */
const getCircuitBreaker = (url) => {
  try {
    const domain = new URL(url).hostname;
    
    if (!domainCircuitBreakers.has(domain)) {
      domainCircuitBreakers.set(domain, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        onOpen: () => logger.warn(`Circuit open for domain: ${domain}`),
        onClose: () => logger.info(`Circuit closed for domain: ${domain}`),
        onHalfOpen: () => logger.info(`Circuit half-open for domain: ${domain}`)
      }));
    }
    
    return domainCircuitBreakers.get(domain);
  } catch (error) {
    // If URL parsing fails, return a default circuit breaker
    logger.error(`Failed to parse URL for circuit breaker: ${url}`, error);
    return new CircuitBreaker();
  }
};

/**
 * Initialize browser with custom configuration
 * @param {Object} config - Browser configuration options
 * @param {boolean} config.headless - Whether to run in headless mode
 * @param {Object} config.viewport - Browser viewport dimensions
 * @param {string} config.userAgent - Browser user agent
 * @returns {Promise<Browser>} Playwright browser instance
 * @throws {BrowserError} If browser initialization fails
 */
export const initBrowser = async (config = {}) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    if (!browserInstance) {
      logger.info('Initializing browser instance');
      browserInstance = await chromium.launch({
        headless: mergedConfig.headless
      });
      
      // Ensure browser is closed when the process exits
      process.on('exit', () => {
        if (browserInstance) {
          logger.info('Closing browser on process exit');
          browserInstance.close().catch(err => 
            logger.error('Error closing browser:', err)
          );
        }
      });
    }
    
    return browserInstance;
  } catch (error) {
    logger.error('Failed to initialize browser:', error);
    throw new BrowserError(
      `Browser initialization failed: ${error.message}`,
      'launch',
      { originalError: error.message }
    );
  }
};

/**
 * Create and configure a new page
 * @param {Browser} browser - Playwright browser instance
 * @param {Object} config - Page configuration options
 * @returns {Promise<Page>} Configured Playwright page
 * @throws {BrowserError} If page creation fails
 */
export const createPage = async (browser, config = {}) => {
  if (!browser) {
    throw new BrowserError('Browser instance is required', 'createPage');
  }
  
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // Create a new browser context with the specified settings
    const context = await browser.newContext({
      viewport: mergedConfig.viewport,
      userAgent: mergedConfig.userAgent
    });
    
    // Create a new page in the context
    const page = await context.newPage();
    
    // Set default timeout for all operations
    page.setDefaultTimeout(mergedConfig.timeout);
    
    // Setup error handling for browser/page events
    context.on('close', () => {
      logger.debug('Browser context closed');
    });
    
    // Set up handler for console messages
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        logger.debug(`Page console error: ${text}`);
      }
    });
    
    // Set up handler for page errors
    page.on('pageerror', error => {
      logger.debug(`Page error: ${error.message}`);
    });
    
    // Set up handler for request failures
    page.on('requestfailed', request => {
      logger.debug(`Request failed: ${request.url()} ${request.failure().errorText}`);
    });
    
    return page;
  } catch (error) {
    logger.error('Failed to create page:', error);
    throw new BrowserError(
      `Page creation failed: ${error.message}`,
      'createPage',
      { originalError: error.message }
    );
  }
};

// Add initialization function for rate limiting
export const initializeRateLimiting = () => {
  const rateLimiter = getRateLimiter();
  
  // Apply domain-specific rate limits
  const domainsToPreload = [
    'linkedin.com',
    'twitter.com',
    'facebook.com',
    'amazon.com',
    'ebay.com',
    'wikipedia.org',
    'github.com'
  ];
  
  for (const domain of domainsToPreload) {
    const config = getRateLimitForDomain(domain);
    rateLimiter.setDomainConfig(domain, config);
  }
  
  logger.info('Rate limiting initialized with domain-specific configurations');
};

// Call the rate limiting initialization when module is loaded
initializeRateLimiting();

// Add sensitive URL checking to the navigateToUrl function
export const navigateToUrl = async (page, url, options = {}) => {
  const rateLimiter = getRateLimiter();
  const { maxRetries = 2, waitUntil = 'domcontentloaded' } = options;
  
  logger.info(`Navigating to ${url} (waitUntil: ${waitUntil})`);
  
  // Check if this is a sensitive URL
  const sensitive = isSensitiveUrl(url);
  const domain = extractDomain(url);
  
  // If sensitive, apply more aggressive rate limiting
  if (sensitive) {
    const multipliers = getSensitiveRateLimitMultipliers();
    const currentConfig = rateLimiter.getDomainConfig(domain);
    
    // Apply adjusted settings for this request
    const adjustedConfig = {
      minDelay: currentConfig.minDelay * multipliers.minDelayMultiplier,
      maxDelay: currentConfig.maxDelay * multipliers.maxDelayMultiplier,
      maxPerMinute: Math.floor(currentConfig.maxPerMinute / multipliers.maxPerMinuteDivisor),
      maxPerDomain: Math.floor(currentConfig.maxPerDomain / multipliers.maxPerDomainDivisor) || 1
    };
    
    rateLimiter.setDomainConfig(domain, adjustedConfig);
    
    logger.info(`Applied sensitive URL rate limiting for ${url}`, {
      sensitive: true,
      adjustedConfig
    });
  }
  
  // Schedule the navigation through the rate limiter
  return rateLimiter.schedule(async () => {
    try {
      // Original navigation logic
      const response = await page.goto(url, { 
        waitUntil, 
        timeout: DEFAULT_CONFIG.timeout
      });
      
      // Check for error responses
      if (response) {
        const status = response.status();
        if (status >= 400) {
          throw new NetworkError(`Failed to load page ${url}: HTTP ${status}`, url, status);
        }
      }
      
      return response;
    } catch (error) {
      // Existing error handling logic...
      const errorMessage = `Navigation to ${url} failed: ${error.message}`;
      
      if (error.name === 'TimeoutError') {
        logger.error(`Page load timeout: ${url}`);
        throw new TimeoutError(errorMessage, url, DEFAULT_CONFIG.timeout);
      }
      
      // Check for network errors in console logs
      const navigationLogs = await page.evaluate(() => {
        return Object.keys(window.performance.getEntries())
          .map(key => window.performance.getEntries()[key])
          .filter(entry => entry.name === url)
          .map(entry => ({ name: entry.name, duration: entry.duration }));
      }).catch(() => []);
      
      logger.debug(`Request failed: ${url} ${error.message}`);
      
      throw new NavigationError(errorMessage, url, navigationLogs);
    }
  }, url);
};

// Helper function to extract domain from URL
const extractDomain = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (error) {
    logger.warn(`Invalid URL: ${url}`, { error: error.message });
    return url;
  }
};

/**
 * Close the browser instance and release resources
 * @returns {Promise<void>}
 * @throws {BrowserError} If browser close fails
 */
export const closeBrowser = async () => {
  if (browserInstance) {
    try {
      logger.info('Closing browser instance');
      await browserInstance.close();
      browserInstance = null;
    } catch (error) {
      logger.error('Error closing browser:', error);
      throw new BrowserError(
        `Browser close failed: ${error.message}`,
        'close',
        { originalError: error.message }
      );
    }
  }
};

// Content Extraction Functions

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned and normalized text
 */
export const cleanText = (text) => {
  if (!text) return '';
  
  return text
    .replace(/[ \t]+/g, ' ')                // Replace multiple spaces/tabs with single space
    .replace(/\n{3,}/g, '\n\n')             // Normalize excessive newlines to double newlines
    .replace(/&nbsp;/g, ' ')                // Replace HTML space entities
    .replace(/&amp;/g, '&')                 // Replace HTML ampersand entities
    .replace(/&lt;/g, '<')                  // Replace HTML less than entities
    .replace(/&gt;/g, '>')                  // Replace HTML greater than entities
    .replace(/&quot;|&#34;/g, '"')          // Replace HTML quote entities
    .replace(/&#39;/g, "'")                 // Replace HTML apostrophe entities
    .trim();                                // Remove leading/trailing whitespace
};

/**
 * Extract text using multiple selectors until valid content is found
 * @param {Page} page - Playwright page
 * @param {string[]} selectors - Array of CSS selectors to try
 * @param {Object} options - Extraction options
 * @param {boolean} options.requireMinLength - Whether to require a minimum length
 * @param {number} options.minLength - Minimum length to consider valid content
 * @returns {Promise<string>} Extracted and cleaned text
 * @throws {ExtractionError} If extraction fails with all selectors
 */
export const extractTextWithSelectors = async (page, selectors, options = {}) => {
  if (!page) {
    throw new ExtractionError('Page instance is required', null, 'unknown');
  }
  
  if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
    throw new ExtractionError('Valid selectors array is required', null, 'unknown');
  }
  
  const { requireMinLength = true, minLength = 50, contentType = 'unknown' } = options;
  
  // Keep track of attempted selectors
  const attemptedSelectors = [];
  
  for (const selector of selectors) {
    try {
      // Try to find elements with the current selector
      const elements = await page.$$(selector);
      attemptedSelectors.push(selector);
      
      if (elements.length === 0) continue;
      
      // Extract text from all matching elements
      const textPromises = elements.map(el => el.innerText().catch(() => ''));
      const texts = await Promise.all(textPromises);
      
      // Join all text and clean it
      const combinedText = cleanText(texts.join('\n\n'));
      
      // Check if the text meets minimum length requirements
      if (!requireMinLength || combinedText.length >= minLength) {
        return combinedText;
      }
    } catch (error) {
      logger.debug(`Error extracting text with selector "${selector}": ${error.message}`);
      // Continue to next selector on error
    }
  }
  
  // If we reach here, no selectors yielded valid content
  // For graceful degradation, return empty string instead of throwing
  logger.warn(`Failed to extract content with ${attemptedSelectors.length} selectors for content type: ${contentType}`);
  return '';
};

/**
 * Extract main content from a webpage
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} Extracted main content
 * @throws {ExtractionError} If main content extraction fails
 */
export const extractMainContent = async (page) => {
  logger.info('Extracting main page content');
  
  try {
    // First, hide elements we want to exclude from extraction
    await Promise.allSettled(
      CONTENT_SELECTORS.exclude.map(excludeSelector => 
        page.evaluate((selector) => {
          document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
          });
        }, excludeSelector).catch(e => logger.debug(`Error hiding selector ${excludeSelector}: ${e.message}`))
      )
    );
    
    // Extract text using defined selectors
    const content = await extractTextWithSelectors(page, CONTENT_SELECTORS.mainContent, {
      contentType: 'main'
    });
    
    // If no specific content containers found, extract body text excluding hidden elements
    if (!content) {
      logger.debug('No specific content containers found, extracting from body');
      try {
        return await page.evaluate(() => {
          // Get the body text but skip hidden elements
          return Array.from(document.body.querySelectorAll('*'))
            .filter(el => el.offsetParent !== null) // Only visible elements
            .map(el => el.innerText)
            .join('\n')
            .replace(/\s+/g, ' ')
            .trim();
        });
      } catch (error) {
        logger.error('Error extracting from body:', error);
        throw new ExtractionError(
          `Body content extraction failed: ${error.message}`,
          'body',
          'main',
          { originalError: error.message }
        );
      }
    }
    
    return content;
  } catch (error) {
    // Only throw if it's not already a ScraperError
    if (!(error instanceof ScraperError)) {
      logger.error('Error extracting main content:', error);
      throw new ExtractionError(
        `Main content extraction failed: ${error.message}`,
        'multiple',
        'main',
        { originalError: error.message }
      );
    }
    throw error;
  }
};

/**
 * Navigate to a potential content page if a link exists
 * @param {Page} page - Playwright page
 * @param {Array<string>} linkPatterns - URL patterns to look for in href attributes
 * @param {string} contentType - Type of content being sought (for logging)
 * @returns {Promise<boolean>} True if navigation occurred, false otherwise
 */
const navigateToContentPageIfExists = async (page, linkPatterns, contentType) => {
  try {
    // Build a selector that finds links matching any of the patterns
    const linkSelector = linkPatterns
      .map(pattern => `a[href*="${pattern}"]`)
      .join(', ');
    
    // Find all matching links
    const links = await page.$$(linkSelector);
    
    if (links.length > 0) {
      // Get the first link href
      const href = await links[0].getAttribute('href');
      
      if (href) {
        // Determine if it's a relative or absolute URL
        const linkUrl = href.startsWith('http') 
          ? href 
          : new URL(href, page.url()).toString();
          
        // Navigate to the page
        logger.info(`Found ${contentType} page link, navigating to: ${linkUrl}`);
        await navigateToUrl(page, linkUrl, {
          waitUntil: 'domcontentloaded',
          maxRetries: 1 // Only retry once for content page navigation
        });
        return true;
      }
    }
    return false;
  } catch (error) {
    // If navigation fails, log but don't fail the entire extraction
    logger.warn(`Failed to navigate to ${contentType} page: ${error.message}`);
    return false;
  }
};

/**
 * Extract company description/about information
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} Extracted about information
 */
export const extractAboutInfo = async (page) => {
  logger.info('Extracting company about/description information');
  
  try {
    // Try current URL to see if we're already on an about page
    const currentUrl = page.url().toLowerCase();
    const isAboutPage = currentUrl.includes('about') || 
                         currentUrl.includes('company') || 
                         currentUrl.includes('who-we-are');
    
    // If we're not already on an about page, try to navigate to one
    if (!isAboutPage) {
      const navigated = await navigateToContentPageIfExists(
        page, 
        ['about', 'company', 'who-we-are'],
        'about'
      );
      
      // If navigation succeeded, extract content from the about page
      if (navigated) {
        const aboutContent = await extractTextWithSelectors(page, 
          CONTENT_SELECTORS.aboutCompany,
          { contentType: 'about' }
        );
        
        if (aboutContent) return aboutContent;
        
        // If no specific about content found, try main content extraction
        return extractMainContent(page);
      }
    }
    
    // Extract from current page if we're already on an about page or navigation failed
    logger.debug('Extracting about information from current page');
    return extractTextWithSelectors(page, 
      CONTENT_SELECTORS.aboutCompany,
      { contentType: 'about' }
    );
  } catch (error) {
    logger.error('Error extracting about information:', error);
    // Return empty string for graceful degradation instead of throwing
    return '';
  }
};

/**
 * Extract product/service descriptions
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} Extracted product/service information
 */
export const extractProductInfo = async (page) => {
  logger.info('Extracting product/service information');
  
  try {
    // Try current URL to see if we're already on a product page
    const currentUrl = page.url().toLowerCase();
    const isProductPage = currentUrl.includes('product') || 
                          currentUrl.includes('service') || 
                          currentUrl.includes('solution');
    
    // If we're not already on a product page, try to navigate to one
    if (!isProductPage) {
      const navigated = await navigateToContentPageIfExists(
        page, 
        ['product', 'service', 'solution'],
        'product'
      );
      
      // If navigation succeeded, extract content from the product page
      if (navigated) {
        const productContent = await extractTextWithSelectors(page, 
          CONTENT_SELECTORS.products,
          { contentType: 'product' }
        );
        
        if (productContent) return productContent;
        
        // If no specific product content found, try main content extraction
        return extractMainContent(page);
      }
    }
    
    // Extract from current page if we're already on a product page or navigation failed
    logger.debug('Extracting product information from current page');
    return extractTextWithSelectors(page, 
      CONTENT_SELECTORS.products,
      { contentType: 'product' }
    );
  } catch (error) {
    logger.error('Error extracting product information:', error);
    // Return empty string for graceful degradation instead of throwing
    return '';
  }
};

/**
 * Extract team information
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} Extracted team information
 */
export const extractTeamInfo = async (page) => {
  logger.info('Extracting team information');
  
  try {
    // Try current URL to see if we're already on a team page
    const currentUrl = page.url().toLowerCase();
    const isTeamPage = currentUrl.includes('team') || 
                        currentUrl.includes('people') || 
                        currentUrl.includes('leadership') ||
                        currentUrl.includes('management');
    
    // If we're not already on a team page, try to navigate to one
    if (!isTeamPage) {
      const navigated = await navigateToContentPageIfExists(
        page, 
        ['team', 'people', 'leadership', 'management'],
        'team'
      );
      
      // If navigation succeeded, extract content from the team page
      if (navigated) {
        const teamContent = await extractTextWithSelectors(page, 
          CONTENT_SELECTORS.team,
          { contentType: 'team' }
        );
        
        if (teamContent) return teamContent;
        
        // If no specific team content found, try main content extraction
        return extractMainContent(page);
      }
    }
    
    // Extract from current page if we're already on a team page or navigation failed
    logger.debug('Extracting team information from current page');
    return extractTextWithSelectors(page, 
      CONTENT_SELECTORS.team,
      { contentType: 'team' }
    );
  } catch (error) {
    logger.error('Error extracting team information:', error);
    // Return empty string for graceful degradation instead of throwing
    return '';
  }
};

/**
 * Extract contact information
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} Extracted contact information
 */
export const extractContactInfo = async (page) => {
  logger.info('Extracting contact information');
  
  try {
    // Try current URL to see if we're already on a contact page
    const currentUrl = page.url().toLowerCase();
    const isContactPage = currentUrl.includes('contact') || 
                          currentUrl.includes('reach-us') || 
                          currentUrl.includes('get-in-touch');
    
    // If we're not already on a contact page, try to navigate to one
    if (!isContactPage) {
      const navigated = await navigateToContentPageIfExists(
        page, 
        ['contact', 'reach-us', 'get-in-touch'],
        'contact'
      );
      
      // If navigation succeeded, extract content from the contact page
      if (navigated) {
        const contactContent = await extractTextWithSelectors(page, 
          CONTENT_SELECTORS.contact,
          { contentType: 'contact' }
        );
        
        if (contactContent) return contactContent;
        
        // If no specific contact content found, try main content extraction
        return extractMainContent(page);
      }
    }
    
    // Extract from current page if we're already on a contact page or navigation failed
    logger.debug('Extracting contact information from current page');
    const contactContent = await extractTextWithSelectors(page, 
      CONTENT_SELECTORS.contact,
      { contentType: 'contact' }
    );
    
    if (contactContent) return contactContent;
    
    // As a fallback, try to find email addresses
    try {
      logger.debug('Searching for email addresses on the page');
      return await page.evaluate(() => {
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const bodyText = document.body.innerText;
        return (bodyText.match(emailRegex) || []).join(', ');
      });
    } catch (emailError) {
      logger.debug('Failed to extract email addresses:', emailError);
      return '';
    }
  } catch (error) {
    logger.error('Error extracting contact information:', error);
    // Return empty string for graceful degradation instead of throwing
    return '';
  }
};

/**
 * Take a screenshot of the current page state
 * @param {Page} page - Playwright page
 * @param {string} prefix - Prefix for the screenshot filename
 * @returns {Promise<string|null>} Path to the screenshot or null if failed
 */
const takeScreenshot = async (page, prefix = 'error') => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `./logs/${prefix}-${timestamp}.png`;
    await page.screenshot({ path, fullPage: false });
    logger.info(`Screenshot saved to ${path}`);
    return path;
  } catch (error) {
    logger.error('Failed to take screenshot:', error);
    return null;
  }
};

/**
 * Extract all relevant company information from website
 * @param {string} url - Company website URL
 * @param {Object} options - Scraping options
 * @param {boolean} options.captureScreenshot - Whether to capture screenshots on error
 * @param {boolean} options.useCircuitBreaker - Whether to use circuit breaker
 * @param {boolean} options.useRetries - Whether to use retry logic
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {boolean} options.saveToStorage - Whether to save the scraped content to storage
 * @param {string} options.companyId - Company ID for association if available
 * @returns {Promise<Object>} Extracted company information
 */
export const scrapeCompanyWebsite = async (url, options = {}) => {
  const startTime = Date.now();
  const rateLimiter = getRateLimiter();
  
  // Set up options with defaults
  const opts = {
    timeout: DEFAULT_CONFIG.timeout,
    useRetries: true,
    maxRetries: 2,
    captureScreenshot: false,
    saveToStorage: true, // Default to saving to storage
    companyId: null,
    ...options
  };
  
  logger.info(`Starting website scraping for: ${url}`);
  
  // Check if we already have scraped content for this URL
  if (opts.saveToStorage) {
    try {
      const existingContent = await getScrapedContent(url);
      
      // If we have recently scraped content, return it instead of scraping again
      if (existingContent && 
          existingContent.status === 'processed' &&
          existingContent.scrapeDate > new Date(Date.now() - (24 * 60 * 60 * 1000))) {
        logger.info(`Using recently cached content for: ${url}`);
        
        return {
          url,
          title: existingContent.title,
          mainContent: existingContent.mainContent || '',
          aboutInfo: existingContent.aboutInfo || '',
          productInfo: existingContent.productInfo || '',
          teamInfo: existingContent.teamInfo || '',
          contactInfo: existingContent.contactInfo || '',
          scrapedAt: existingContent.scrapeDate.toISOString(),
          fromCache: true,
          duration: existingContent.scrapeDuration || 0
        };
      }
    } catch (error) {
      logger.debug(`Error checking storage for existing content: ${error.message}`);
      // Continue with scraping
    }
  }
  
  // Update storage to indicate we're processing this URL
  if (opts.saveToStorage) {
    try {
      await updateScrapedContentStatus(url, 'processing');
    } catch (error) {
      logger.debug(`Error updating content status: ${error.message}`);
      // Non-critical, continue with scraping
    }
  }
  
  let browser = null;
  let page = null;
  let rawHtml = null;
  
  try {
    browser = await initBrowser();
    page = await createPage(browser);
    
    // Rate-limited navigation with automatic retries as needed
    const response = await withRetry(
      () => navigateToUrl(page, url, { waitUntil: 'domcontentloaded' }),
      opts.useRetries ? opts.maxRetries : 0
    );
    
    // Capture raw HTML if needed for storage
    if (opts.saveToStorage) {
      rawHtml = await page.content();
    }
    
    // Extract page title
    const title = await page.title();
    
    // Extract content sections using rate-limited approaches
    const mainContent = await rateLimiter.schedule(
      () => extractMainContent(page), 
      url + '#main'
    );
    
    const aboutInfo = await rateLimiter.schedule(
      () => extractAboutInfo(page), 
      url + '#about',
      4 // Lower priority
    );
    
    const productInfo = await rateLimiter.schedule(
      () => extractProductInfo(page), 
      url + '#products',
      4 // Lower priority
    );
    
    const teamInfo = await rateLimiter.schedule(
      () => extractTeamInfo(page), 
      url + '#team',
      5 // Even lower priority
    );
    
    const contactInfo = await rateLimiter.schedule(
      () => extractContactInfo(page), 
      url + '#contact',
      5 // Even lower priority
    );
    
    const duration = Date.now() - startTime;
    logger.info(`Successfully scraped website: ${url} in ${duration}ms`);
    
    // Prepare the result object
    const scrapedData = {
      url,
      title,
      mainContent: mainContent || '',
      aboutInfo: aboutInfo || '',
      productInfo: productInfo || '',
      teamInfo: teamInfo || '',
      contactInfo: contactInfo || '',
      scrapedAt: new Date().toISOString(),
      duration
    };
    
    // Save to storage if requested
    if (opts.saveToStorage) {
      try {
        // Get HTTP status code
        const statusCode = response ? response.status() : null;
        
        // Store the scraped content
        await saveScrapedContent(
          {
            url,
            title,
            mainContent: mainContent || '',
            aboutInfo: aboutInfo || '',
            productInfo: productInfo || '',
            teamInfo: teamInfo || '',
            contactInfo: contactInfo || '',
            rawHtml
          },
          {
            statusCode,
            scrapeDuration: duration,
            companyId: opts.companyId
          }
        );
        
        // Update status to processed
        await updateScrapedContentStatus(url, 'processed');
        
      } catch (storageError) {
        logger.error(`Error saving scraped content to storage: ${storageError.message}`);
        // Non-fatal, continue returning the data
      }
    }
    
    return scrapedData;
  } catch (error) {
    logger.error(`Error scraping website ${url}: ${error.message}`, error);
    
    // Capture screenshot on error if requested
    if (opts.captureScreenshot && page) {
      const screenshotPath = `./logs/scrape-error-${new Date().toISOString().replace(/:/g, '-')}.png`;
      await page.screenshot({ path: screenshotPath }).catch(err => {
        logger.error(`Failed to capture error screenshot: ${err.message}`);
      });
      logger.info(`Screenshot saved to ${screenshotPath}`);
    }
    
    // Update storage if requested
    if (opts.saveToStorage) {
      try {
        await updateScrapedContentStatus(url, 'failed', {
          processingError: error.message
        });
      } catch (storageError) {
        logger.debug(`Error updating content status: ${storageError.message}`);
      }
    }
    
    // Return error information
    return {
      url,
      error: {
        type: error.name || 'ScraperError',
        message: error.message,
        stack: error.stack
      },
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      partial: false
    };
  } finally {
    if (browser) {
      await closeBrowser().catch(err => {
        logger.error(`Error closing browser: ${err.message}`);
      });
    }
  }
};

/**
 * Simple test function to verify scraper functionality
 * @param {string} testUrl - URL to test navigation to
 * @param {boolean} captureScreenshot - Whether to capture a screenshot
 * @returns {Promise<Object>} Test result with success status and page title
 */
export const testScraper = async (testUrl = 'https://example.com', captureScreenshot = false) => {
  let browser = null;
  let page = null;
  
  try {
    browser = await initBrowser();
    page = await createPage(browser);
    
    await navigateToUrl(page, testUrl, { maxRetries: 1 });
    const title = await page.title();
    
    // Take a screenshot if requested
    let screenshotPath = null;
    if (captureScreenshot) {
      screenshotPath = await takeScreenshot(page, 'test-success').catch(() => null);
    }
    
    logger.info(`Successfully loaded page: "${title}"`);
    
    return {
      success: true,
      title,
      url: testUrl,
      screenshot: screenshotPath
    };
  } catch (error) {
    logger.error('Scraper test failed:', error);
    
    // Try to take error screenshot
    let screenshotPath = null;
    if (page && captureScreenshot) {
      screenshotPath = await takeScreenshot(page, 'test-error').catch(() => null);
    }
    
    // Format error based on type
    let errorInfo = {
      message: error.message,
      type: error.name || 'Error'
    };
    
    if (error instanceof ScraperError) {
      errorInfo = {
        ...errorInfo,
        ...error.toJSON()
      };
    }
    
    return {
      success: false,
      error: errorInfo,
      url: testUrl,
      screenshot: screenshotPath
    };
  } finally {
    if (browser) {
      await closeBrowser().catch(err => 
        logger.error('Error during browser cleanup:', err)
      );
    }
  }
}; 