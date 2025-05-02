/**
 * Scraper Service
 * Provides web scraping functionality using axios and cheerio
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { 
  saveScrapedContent, 
  updateScrapedContentStatus, 
  getScrapedContent 
} from './storageService.js';

// Configure axios defaults
const axiosInstance = axios.create({
  timeout: 30000, // 30 seconds
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
});

// Rate limiting configuration
const RATE_LIMIT = {
  minDelay: 1000, // Minimum 1 second between requests to the same domain
  lastRequests: new Map() // Map to track last request time per domain
};

// Apply rate limiting to a domain
const applyRateLimit = async (domain) => {
  const now = Date.now();
  const lastRequest = RATE_LIMIT.lastRequests.get(domain) || 0;
  const elapsed = now - lastRequest;
  
  if (elapsed < RATE_LIMIT.minDelay) {
    const delay = RATE_LIMIT.minDelay - elapsed;
    logger.debug(`Rate limiting ${domain}, waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  RATE_LIMIT.lastRequests.set(domain, Date.now());
};

// Error categories for better user feedback
const ERROR_CATEGORIES = {
  ACCESS_DENIED: 'website_access_denied',
  TIMEOUT: 'website_timeout',
  NOT_FOUND: 'website_not_found',
  NETWORK: 'network_error',
  INVALID_URL: 'invalid_url',
  GENERAL: 'general_error'
};

// Extract domain from a URL
const extractDomain = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname;
  } catch (error) {
    logger.warn(`Invalid URL: ${url}`, { error: error.message });
    return url;
  }
};

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned and normalized text
 */
const cleanText = (text) => {
  if (!text) return '';
  
  return text
    .replace(/[\t]+/g, ' ')               // Replace tabs with spaces
    .replace(/ {2,}/g, ' ')               // Replace multiple spaces with single space
    .replace(/\n{3,}/g, '\n\n')           // Normalize excessive newlines
    .replace(/&nbsp;/g, ' ')              // Replace HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();                              // Remove leading/trailing whitespace
};

/**
 * Extract text from HTML elements using cheerio
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {string|string[]} selectors - CSS selectors to extract text from
 * @returns {string} Extracted and cleaned text
 */
const extractTextFromSelectors = ($, selectors) => {
  if (!selectors) return '';
  
  // Convert single selector to array
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  
  let extractedText = '';
  
  for (const selector of selectorArray) {
    try {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((i, el) => {
          const text = $(el).text();
          if (text && text.trim().length > 0) {
            extractedText += text + '\n\n';
          }
        });
      }
    } catch (error) {
      logger.debug(`Error extracting with selector ${selector}: ${error.message}`);
      // Continue to next selector
    }
  }
  
  return cleanText(extractedText);
};

/**
 * Fetch a URL with rate limiting and retries
 * @param {string} url - URL to fetch
 * @returns {Promise<{html: string, statusCode: number, errorCategory?: string, errorDetails?: string}>} HTML content and status code
 */
const fetchUrl = async (url) => {
  const domain = extractDomain(url);
  let retries = 3;
  let lastError = null;
  
  // Normalize URL if needed
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  
  while (retries > 0) {
    try {
      // Apply rate limiting
      await applyRateLimit(domain);
      
      // Make the request
      const response = await axiosInstance.get(normalizedUrl);
      
      return {
        html: response.data,
        statusCode: response.status
      };
    } catch (error) {
      lastError = error;
      
      // Categorize errors for better user feedback
      let errorCategory = ERROR_CATEGORIES.GENERAL;
      let errorDetails = error.message;
      
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        if (status === 403 || status === 401) {
          errorCategory = ERROR_CATEGORIES.ACCESS_DENIED;
          errorDetails = `Access denied (${status}): The website is blocking automated access.`;
        } else if (status === 404) {
          errorCategory = ERROR_CATEGORIES.NOT_FOUND;
          errorDetails = `Page not found (404): The requested URL does not exist.`;
        } else if (status >= 500) {
          errorCategory = ERROR_CATEGORIES.GENERAL;
          errorDetails = `Server error (${status}): The website's server encountered an error.`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorCategory = ERROR_CATEGORIES.TIMEOUT;
        errorDetails = 'Connection timed out: The website took too long to respond.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorCategory = ERROR_CATEGORIES.NOT_FOUND;
        errorDetails = `Cannot reach website: ${error.code}.`;
      } else if (error.code === 'ERR_BAD_REQUEST') {
        errorCategory = ERROR_CATEGORIES.GENERAL;
        errorDetails = 'Bad request: The URL may be malformed or unreachable.';
      } else if (error.message.includes('Invalid URL')) {
        errorCategory = ERROR_CATEGORIES.INVALID_URL;
        errorDetails = 'Invalid URL format: Please check that the URL is correct.';
      }

      logger.warn(`Error fetching ${normalizedUrl} (${retries} retries left): ${errorDetails}`);
      retries--;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Last retry - if failed, return the error details
      if (retries === 0) {
        return {
          html: null,
          statusCode: error.response?.status || 0,
          errorCategory,
          errorDetails
        };
      }
    }
  }
  
  // This should not be reached, but as fallback
  throw new Error(`Failed to fetch ${normalizedUrl} after multiple retries: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Scrape a LinkedIn company page for additional information
 * @param {string} linkedinUrl - LinkedIn company URL
 * @returns {Promise<Object>} Scraped LinkedIn data
 */
export const scrapeLinkedInCompanyPage = async (linkedinUrl) => {
  if (!linkedinUrl) {
    return { error: true, message: "No LinkedIn URL provided" };
  }
  
  try {
    logger.info(`Attempting to scrape LinkedIn page: ${linkedinUrl}`);
    
    // LinkedIn has strict anti-scraping measures, so we'll just get the public page data
    const result = await fetchUrl(linkedinUrl);
    
    if (result.errorCategory) {
      logger.warn(`LinkedIn scraping failed for ${linkedinUrl}: ${result.errorDetails}`);
      return { 
        error: true,
        message: "LinkedIn access restricted", 
        details: result.errorDetails 
      };
    }
    
    if (!result.html) {
      return {
        error: true,
        message: "No content retrieved from LinkedIn page",
        linkedinUrl
      };
    }
    
    const $ = cheerio.load(result.html);
    
    // LinkedIn selectors - these may need frequent updating as LinkedIn changes their page structure
    const selectors = {
      description: ['div.core-section-container__content', '.org-about-us-organization-description__text', 
                   '.org-top-card-summary-info-list', '.about-us', '.organization-about-us-module'],
      employeeCount: ['.org-top-card-summary-info-list__info-item', '.org-about-company-module__company-staff-count-range'],
      specialties: ['.org-about-company-module__specialities', '.org-product-module']
    };
    
    const linkedinData = {
      description: extractTextFromSelectors($, selectors.description),
      employeeCount: extractTextFromSelectors($, selectors.employeeCount),
      specialties: extractTextFromSelectors($, selectors.specialties),
      linkedinUrl,
      timestamp: new Date().toISOString()
    };
    
    // For LinkedIn, we should grab as much text as possible from the page body too
    if (!linkedinData.description || linkedinData.description.length < 100) {
      // Grab all paragraph text
      const paragraphs = [];
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 30) { // Only include substantial paragraphs
          paragraphs.push(text);
        }
      });
      
      if (paragraphs.length > 0) {
        linkedinData.description = (linkedinData.description || '') + 
          '\n\n' + paragraphs.join('\n\n');
      }
      
      // Also grab any list items
      const listItems = [];
      $('li').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10) {
          listItems.push('• ' + text);
        }
      });
      
      if (listItems.length > 0) {
        linkedinData.description = (linkedinData.description || '') +
          '\n\n' + listItems.join('\n');
      }
    }
    
    logger.info(`Successfully extracted basic data from LinkedIn for ${linkedinUrl}`);
    return linkedinData;
  } catch (error) {
    logger.error(`Failed to scrape LinkedIn page ${linkedinUrl}: ${error.message}`);
    return {
      error: true,
      message: "LinkedIn scraping failed",
      details: error.message,
      linkedinUrl
    };
  }
};

/**
 * Scrape a website using axios and cheerio
 * @param {string} url - Company website URL
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} Scraped company information
 */
export const scrapeCompanyWebsite = async (url, options = {}) => {
  const startTime = Date.now();
  
  // Set up options with defaults
  const opts = {
    saveToStorage: true, // Default to saving to storage
    companyId: null,
    linkedinUrl: null, // Allow passing in LinkedIn URL
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
        logger.info(`Using cached content for: ${url}`);
        
        return {
          url,
          title: existingContent.title,
          mainContent: existingContent.mainContent || '',
          aboutInfo: existingContent.aboutInfo || '',
          productInfo: existingContent.productInfo || '',
          teamInfo: existingContent.teamInfo || '',
          contactInfo: existingContent.contactInfo || '',
          linkedinData: existingContent.linkedinData || null,
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
  
  try {
    // Fetch the main page
    const result = await fetchUrl(url);
    
    // Handle fetch errors
    if (result.errorCategory) {
      throw new Error(`${result.errorDetails || 'Failed to fetch website'}`, { 
        cause: { category: result.errorCategory } 
      });
    }
    
    const { html, statusCode } = result;
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Extract page title
    const title = $('title').text().trim() || `${url} - Company Website`;
    
    // Define common selectors for different content types
    const selectors = {
      mainContent: ['article', 'main', '.content', '#content', '.post-content',
                    '[role="main"]', '.main-content', '.entry-content', '.page-content'],
      aboutCompany: ['.about', '#about', '.about-us', '#about-us', '.company-info',
                     '[data-testid="about"]', 'section.about', 'div.about-section'],
      products: ['.products', '#products', '.services', '#services',
                 '.product-description', '.service-description',
                 'section.products', 'section.services'],
      team: ['.team', '#team', '.our-team', '#our-team', '.members',
             '.leadership', '.staff', 'section.team', '.team-members'],
      contact: ['.contact', '#contact', '.contact-info', '.contact-us',
                'footer .contact', 'address', '.vcard', '.contact-details']
    };
    
    // Handle sections that might be on separate pages
    const links = {
      about: $('a[href*="about"], a[href*="company"], a[href*="who-we-are"]').first().attr('href'),
      products: $('a[href*="product"], a[href*="service"], a[href*="solution"]').first().attr('href'),
      team: $('a[href*="team"], a[href*="people"], a[href*="leadership"]').first().attr('href'),
      contact: $('a[href*="contact"], a[href*="reach-us"]').first().attr('href')
    };
    
    // Extract content from the main page
    let mainContent = extractTextFromSelectors($, selectors.mainContent);
    let aboutInfo = extractTextFromSelectors($, selectors.aboutCompany);
    let productInfo = extractTextFromSelectors($, selectors.products);
    let teamInfo = extractTextFromSelectors($, selectors.team);
    let contactInfo = extractTextFromSelectors($, selectors.contact);
    
    // Attempt to fetch content from linked pages if main page content is sparse
    const baseDomain = extractDomain(url);
    const baseUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    
    // Try to fetch about page if content is limited
    if (aboutInfo.length < 150 && links.about) {
      try {
        const aboutUrl = links.about.startsWith('http') ? 
          links.about : new URL(links.about, baseUrl).toString();
        
        if (extractDomain(aboutUrl) === baseDomain) {
          logger.info(`Fetching about page: ${aboutUrl}`);
          const { html: aboutHtml } = await fetchUrl(aboutUrl);
          const $about = cheerio.load(aboutHtml);
          const aboutPageContent = extractTextFromSelectors($about, selectors.aboutCompany) || 
                                   extractTextFromSelectors($about, selectors.mainContent);
          if (aboutPageContent && aboutPageContent.length > aboutInfo.length) {
            aboutInfo = aboutPageContent;
          }
        }
      } catch (error) {
        logger.debug(`Error fetching about page: ${error.message}`);
      }
    }
    
    // Try to fetch products page if content is limited
    if (productInfo.length < 150 && links.products) {
      try {
        const productsUrl = links.products.startsWith('http') ? 
          links.products : new URL(links.products, baseUrl).toString();
        
        if (extractDomain(productsUrl) === baseDomain) {
          logger.info(`Fetching products page: ${productsUrl}`);
          const { html: productsHtml } = await fetchUrl(productsUrl);
          const $products = cheerio.load(productsHtml);
          const productsPageContent = extractTextFromSelectors($products, selectors.products) || 
                                      extractTextFromSelectors($products, selectors.mainContent);
          if (productsPageContent && productsPageContent.length > productInfo.length) {
            productInfo = productsPageContent;
          }
        }
      } catch (error) {
        logger.debug(`Error fetching products page: ${error.message}`);
      }
    }
    
    // Try to extract email from contact page
    if (contactInfo.length < 50 && links.contact) {
      try {
        const contactUrl = links.contact.startsWith('http') ? 
          links.contact : new URL(links.contact, baseUrl).toString();
        
        if (extractDomain(contactUrl) === baseDomain) {
          logger.info(`Fetching contact page: ${contactUrl}`);
          const { html: contactHtml } = await fetchUrl(contactUrl);
          const $contact = cheerio.load(contactHtml);
          
          // Extract contact text
          const contactPageContent = extractTextFromSelectors($contact, selectors.contact) || 
                                     extractTextFromSelectors($contact, selectors.mainContent);
          
          // Look for email addresses
          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
          const contactText = $contact('body').text();
          const emails = contactText.match(emailRegex) || [];
          
          if (contactPageContent && contactPageContent.length > contactInfo.length) {
            contactInfo = contactPageContent;
          } else if (emails.length > 0) {
            contactInfo = `Email: ${emails.join(', ')}`;
          }
        }
      } catch (error) {
        logger.debug(`Error fetching contact page: ${error.message}`);
      }
    }
    
    // If we have very limited content, try to extract at least something meaningful
    if (mainContent.length < 100 && aboutInfo.length < 100 && productInfo.length < 100) {
      // Fall back to grabbing paragraphs from the body
      const paragraphs = [];
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 30) { // Only include substantial paragraphs
          paragraphs.push(text);
        }
      });
      
      if (paragraphs.length > 0) {
        mainContent = paragraphs.join('\n\n');
      }
    }
    
    // Try to scrape LinkedIn data if available
    let linkedinData = null;
    if (opts.linkedinUrl) {
      try {
        const linkedinResult = await scrapeLinkedInCompanyPage(opts.linkedinUrl);
        if (!linkedinResult.error) {
          linkedinData = linkedinResult;
          logger.info(`Successfully retrieved LinkedIn data for: ${opts.linkedinUrl}`);
        } else {
          logger.warn(`LinkedIn scraping issue: ${linkedinResult.message}`);
        }
      } catch (linkedinError) {
        logger.warn(`Error during LinkedIn scraping: ${linkedinError.message}`);
      }
    }
    
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
      linkedinData,
      scrapedAt: new Date().toISOString(),
      duration
    };
    
    // Save to storage if requested
    if (opts.saveToStorage) {
      try {
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
            linkedinData,
            rawHtml: html
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
    logger.error(`Error scraping website ${url}: ${error.message}`);
    
    // Update storage if requested
    if (opts.saveToStorage) {
      try {
        await updateScrapedContentStatus(url, 'failed', {
          processingError: error.message,
          errorCategory: error.cause?.category || ERROR_CATEGORIES.GENERAL
        });
      } catch (storageError) {
        logger.debug(`Error updating content status: ${storageError.message}`);
      }
    }
    
    // Return error information with improved categorization
    return {
      url,
      error: {
        type: error.name || 'ScraperError',
        message: error.message,
        category: error.cause?.category || ERROR_CATEGORIES.GENERAL,
        stack: error.stack
      },
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      partial: false
    };
  }
};

/**
 * Simple test function to verify scraper functionality
 * @param {string} testUrl - URL to test
 * @param {string} linkedinUrl - Optional LinkedIn URL to test
 * @returns {Promise<Object>} Test result with success status
 */
export const testScraper = async (testUrl = 'https://example.com', linkedinUrl = null) => {
  try {
    const data = await scrapeCompanyWebsite(testUrl, { 
      saveToStorage: false,
      linkedinUrl
    });
    
    if (data.error) {
      throw new Error(`${data.error.message} (${data.error.category})`);
    }
    
    logger.info(`Successfully scraped test URL: ${testUrl}`);
    
    return {
      success: true,
      url: testUrl,
      linkedinUrl: linkedinUrl,
      content: {
        title: data.title,
        mainContent: data.mainContent.substring(0, 100) + '...',
        aboutInfo: data.aboutInfo.substring(0, 100) + '...',
        // Include truncated content for verification
        linkedinDataAvailable: !!data.linkedinData
      }
    };
  } catch (error) {
    logger.error(`Scraper test failed for ${testUrl}: ${error.message}`);
    
    return {
      success: false,
      error: {
        message: error.message,
        type: error.name || 'Error',
        category: error.cause?.category || ERROR_CATEGORIES.GENERAL
      },
      url: testUrl,
      linkedinUrl
    };
  }
}; 