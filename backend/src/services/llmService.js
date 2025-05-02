/**
 * LLM Service
 * Handles communication with Large Language Models (e.g., Anthropic, OpenAI)
 */

// Define ApiError class locally for self-contained error handling
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// Import necessary modules
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

// --- Configuration ---

// Initialize Anthropic client
let anthropicClient;
try {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEY environment variable not set. LLM service will not function.');
  } else {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    logger.info('Anthropic client initialized successfully.');
  }
} catch (error) {
  logger.error(`Failed to initialize Anthropic client: ${error.message}`);
  anthropicClient = null; // Ensure client is null if initialization fails
}

// Use model from environment variable, fallback to a default Anthropic model
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-7-sonnet-20250219';
const LLM_MODEL = process.env.MODEL || DEFAULT_ANTHROPIC_MODEL;

const MAX_TOKENS_SUMMARY = 500;
const TEMPERATURE_SUMMARY = 0.5;

// Define target token limits (adjust based on model context window and desired output length)
const MAX_PROMPT_TOKENS = 3000; // Example limit, adjust as needed

const LLM_RETRY_ATTEMPTS = 3;
const LLM_INITIAL_DELAY_MS = 1000;

// --- Retry Logic Helper ---

/**
 * Checks if an error from the LLM API is potentially retryable.
 * @param {Error} error - The error object.
 * @returns {boolean} True if the error might be transient and worth retrying.
 */
const isRetryableLlmError = (error) => {
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.RateLimitError) return true; // Often includes Retry-After
  if (error instanceof Anthropic.InternalServerError) return true; // 5xx errors
  if (error instanceof ApiError && error.statusCode >= 500) return true; // General server errors
  // Add specific status codes if needed, e.g., 408 Request Timeout
  return false;
};

/**
 * Simple retry wrapper for async functions.
 * @param {Function} fn - The async function to execute.
 * @param {number} maxRetries - Maximum number of retry attempts.
 * @param {number} initialDelay - Initial delay in milliseconds for backoff.
 * @param {Function} isRetryableCheck - Function to check if an error is retryable.
 * @returns {Promise<any>} The result of the function if successful.
 * @throws The last error encountered if all retries fail.
 */
const withLlmRetry = async (fn, maxRetries = LLM_RETRY_ATTEMPTS, initialDelay = LLM_INITIAL_DELAY_MS, isRetryableCheck = isRetryableLlmError) => {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (retries >= maxRetries || !isRetryableCheck(error)) {
        logger.error(`LLM call failed after ${retries} retries or error not retryable: ${error.message}`);
        throw error; // Throw the original error if not retryable or max retries reached
      }
      
      let delay = initialDelay * Math.pow(2, retries);
      // Add jitter (randomness up to +/- 20%)
      delay = delay * (1 + (Math.random() * 0.4 - 0.2));
      delay = Math.max(initialDelay / 2, delay); // Ensure minimum delay

      // Check for Retry-After header in Anthropic errors
      if (error instanceof Anthropic.RateLimitError && error.headers && error.headers['retry-after']) {
        const retryAfterSeconds = parseInt(error.headers['retry-after'], 10);
        if (!isNaN(retryAfterSeconds)) {
           delay = Math.max(delay, retryAfterSeconds * 1000 + 500); // Use header value + buffer
           logger.warn(`Rate limit hit. Retrying after specified delay: ${delay}ms`);
        } else {
            logger.warn(`Rate limit hit. Retrying after calculated delay: ${delay}ms (Could not parse Retry-After header: ${error.headers['retry-after']})`);
        }
      } else {
         logger.warn(`LLM call attempt ${retries + 1} failed. Retrying in ${delay.toFixed(0)}ms... Error: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
};

// --- Core Functions ---

/**
 * Generates a company summary using the configured LLM (Anthropic).
 * @param {Object} companyData - Basic company information (name, industry, etc.)
 * @param {Object} scrapedContent - Object containing scraped text sections.
 * @returns {Promise<string>} The generated company summary.
 * @throws {ApiError} If the LLM service is unavailable or the API call fails.
 */
export const generateCompanySummary = async (companyData, scrapedContent) => {
  // Make the check more explicit: ensure the client is not null AND not undefined.
  // Also check if the messages property exists, as that's what we need.
  if (!anthropicClient || !anthropicClient.messages) {
    logger.error('Anthropic client is not available. Check ANTHROPIC_API_KEY environment variable and initialization logs.');
    throw new ApiError('Anthropic service is not configured or failed to initialize. Please check server configuration.', 503); // Service Unavailable
  }

  // Wrap the core logic in the retry function
  return withLlmRetry(async () => {
    const startTime = Date.now();
    // 1. Construct the prompt
    const prompt = buildEnhancedSummaryPrompt(companyData, scrapedContent);
    logger.debug(`Generated prompt for company ${companyData.id || companyData.name}`);

    // 2. Make the API call to Anthropic
    logger.info(`Calling Anthropic (${LLM_MODEL}) for company summary: ${companyData.id || companyData.name}`);
    
    // Use structured output format for consistent parsing
    const systemPrompt = `You are a helpful assistant designed to write concise, professional company summaries based on provided website content.
You produce business analytics summaries with accurate information derived from the source material.
Always be factual, objective, and professional in your analysis.
Focus on the company's core business, products/services, target market, and unique value proposition.`;

    const response = await anthropicClient.messages.create({
      model: LLM_MODEL,
      max_tokens: MAX_TOKENS_SUMMARY,
      temperature: TEMPERATURE_SUMMARY,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    const duration = Date.now() - startTime;

    // Log token usage if available
    const usage = response.usage;
    if (usage) {
       logger.info(`Anthropic API usage for ${companyData.id || companyData.name}: Input Tokens: ${usage.input_tokens}, Output Tokens: ${usage.output_tokens}. Duration: ${duration}ms`);
    } else {
       logger.info(`Anthropic API call completed for ${companyData.id || companyData.name}. Duration: ${duration}ms (Usage info not available)`);
    }

    // 3. Extract the summary
    const summary = response.content?.[0]?.text?.trim();

    if (!summary) {
      logger.error('Anthropic response did not contain a valid summary text block.', { response_body: response });
      throw new ApiError('Failed to generate summary: Empty or invalid response from LLM', 500);
    }

    logger.info(`Successfully generated summary for company: ${companyData.id || companyData.name}`);
    return summary;
  }); // End of withLlmRetry wrapper
};

// --- Helper Functions ---

/**
 * Intelligently truncates text to fit within a token budget.
 * Tries to preserve sentence structure.
 * @param {string} text - The text to truncate.
 * @param {number} maxTokens - Maximum allowed tokens for this text.
 * @returns {string} Truncated text.
 */
const truncateText = (text, maxTokens) => {
  if (!text) return '';

  // Simple approximation: about 4 chars per token
  const approxChars = maxTokens * 4; 
  if (text.length > approxChars) {
    // Try to truncate at the end of a sentence for better readability
    const truncatedText = text.substring(0, approxChars);
    const lastSentenceEnd = Math.max(
      truncatedText.lastIndexOf('.'), 
      truncatedText.lastIndexOf('?'), 
      truncatedText.lastIndexOf('!')
    );

    if (lastSentenceEnd > truncatedText.length * 0.8) { // Only if sentence end is near the truncation point
      return truncatedText.substring(0, lastSentenceEnd + 1) + '... [Truncated]';
    }
    return truncatedText + '... [Truncated]';
  }
  return text;
};

/**
 * Builds an enhanced prompt for the LLM, prioritizing content and managing token limits.
 */
const buildEnhancedSummaryPrompt = (companyData, scrapedContent) => {
  // Define the base structure and initial instructions
  let prompt = `Generate a concise, factual, and professional summary (target: 150-200 words) for the company named "${companyData.name}".\n\n`;
  
  // Add basic company information
  prompt += "### Company Information ###\n";
  if (companyData.industry) prompt += `Industry: ${companyData.industry}\n`;
  if (companyData.location) prompt += `Location: ${companyData.location}\n`;
  if (companyData.founded) prompt += `Founded: ${companyData.founded}\n`;
  if (companyData.size) prompt += `Company Size: ${companyData.size}\n`;
  if (companyData.website) prompt += `Website: ${companyData.website}\n`;
  if (companyData.linkedin_url) prompt += `LinkedIn: ${companyData.linkedin_url}\n`;
  if (companyData.description) prompt += `Provided Description: ${companyData.description}\n`;
  prompt += '\n';

  // Add task description
  prompt += "### Task ###\n";
  prompt += "Analyze the following content from their web presence (website and/or LinkedIn) to understand their:\n";
  prompt += "1. Core business model and offerings\n";
  prompt += "2. Primary products/services\n";
  prompt += "3. Target audience/market\n";
  prompt += "4. Value proposition or competitive advantages\n";
  prompt += "5. Company mission/vision (if mentioned)\n\n";
  prompt += "Synthesize this information into a comprehensive yet concise company summary.\n\n";

  // Define content sections with priorities (higher number = higher priority)
  const sections = [];
  const isLinkedInOnly = !scrapedContent.mainContent && !scrapedContent.aboutInfo && 
                          scrapedContent.linkedinData && !scrapedContent.linkedinData.error;
  
  // Website content sections
  if (scrapedContent.aboutInfo) {
    sections.push({ title: 'About Info', text: scrapedContent.aboutInfo, priority: 5 });
  }
  if (scrapedContent.mainContent) {
    sections.push({ title: 'Main Website Content', text: scrapedContent.mainContent, priority: 4 });
  }
  if (scrapedContent.productInfo) {
    sections.push({ title: 'Product/Service Info', text: scrapedContent.productInfo, priority: 3 });
  }
  if (scrapedContent.teamInfo) {
    sections.push({ title: 'Team Info', text: scrapedContent.teamInfo, priority: 1 });
  }
  if (scrapedContent.contactInfo) {
    sections.push({ title: 'Contact Info', text: scrapedContent.contactInfo, priority: 1 });
  }
  
  // LinkedIn content sections - prioritize when LinkedIn is the primary/only source
  if (scrapedContent.linkedinData && !scrapedContent.linkedinData.error) {
    if (scrapedContent.linkedinData.description) {
      sections.push({ 
        title: 'LinkedIn Description', 
        text: scrapedContent.linkedinData.description, 
        priority: isLinkedInOnly ? 6 : 5  // Higher priority if LinkedIn-only
      });
    }
    if (scrapedContent.linkedinData.specialties) {
      sections.push({ 
        title: 'LinkedIn Specialties', 
        text: scrapedContent.linkedinData.specialties, 
        priority: isLinkedInOnly ? 5 : 4
      });
    }
    if (scrapedContent.linkedinData.employeeCount) {
      sections.push({ 
        title: 'LinkedIn Company Size', 
        text: scrapedContent.linkedinData.employeeCount, 
        priority: 2
      });
    }
  }

  // Filter out empty/short sections and sort by priority
  const filteredSections = sections.filter(s => s.text && s.text.trim().length > 20);
  filteredSections.sort((a, b) => b.priority - a.priority);

  // If no content sections remain after filtering, add a note
  if (filteredSections.length === 0) {
    prompt += "### Content ###\n";
    prompt += "No substantial content was found on the company's web presence. ";
    prompt += "Please generate a minimal summary based only on the company information provided above.\n\n";
  } else {
    // Calculate available tokens for scraped content (rough approximation)
    let availableTokens = MAX_PROMPT_TOKENS - (prompt.length / 4) - 150; // Reserve tokens for final instructions & overhead

    let includedContent = '';
    let remainingTokens = availableTokens;

    // Add content sections prioritizing higher priority ones until token limit is reached
    prompt += "### Content ###\n";
    for (const section of filteredSections) {
      const maxSectionTokens = Math.max(
        50, // Ensure a minimum representation
        Math.floor(remainingTokens * (section.priority / filteredSections.reduce((sum, s) => sum + s.priority, 0)))
      );
      
      const truncatedSectionText = truncateText(section.text, maxSectionTokens);
      
      if (truncatedSectionText) {
        includedContent += `--- ${section.title} ---\n${truncatedSectionText}\n\n`;
        remainingTokens -= truncatedSectionText.length / 4; // Update remaining tokens (approximate)
      }
      if (remainingTokens <= 0) break; // Stop if token budget is exceeded
    }

    prompt += includedContent;
  }

  // Add source context
  prompt += "### Source Context ###\n";
  if (isLinkedInOnly) {
    prompt += "NOTE: The above content is derived ONLY from LinkedIn, as no website content was available.\n";
    prompt += "Focus heavily on the LinkedIn data and be more conservative with assumptions.\n\n";
  } else if (scrapedContent.linkedinData && !scrapedContent.linkedinData.error) {
    prompt += "The above content includes both website and LinkedIn data.\n\n";
  } else {
    prompt += "The above content is derived from the company's website.\n\n";
  }

  // Add output instructions
  prompt += "### Output Instructions ###\n";
  prompt += "Write a comprehensive yet concise company summary (150-200 words) covering:\n";
  prompt += "- The company's core business and main offerings\n";
  prompt += "- Key products or services\n";
  prompt += "- Target market/audience (if identifiable)\n";
  prompt += "- Any clear competitive advantages or unique selling points\n";
  prompt += "- Company mission or values (if mentioned)\n\n";
  prompt += "Guidelines:\n";
  prompt += "- Base the summary ONLY on the information provided above\n";
  prompt += "- Use professional, objective language\n";
  prompt += "- Be clear and specific about what the company actually does\n";
  prompt += "- Avoid promotional language, subjective claims, or unverifiable information\n";
  prompt += "- Include concrete details rather than vague statements\n";
  prompt += "- Present only factual information from the provided content\n";
  prompt += "- Use proper grammar, punctuation, and paragraph structure\n";
  prompt += "- Output ONLY the summary text, nothing before or after, formatted as a professional business description\n";

  return prompt;
};

// Export testing helpers if in testing environment
export const __test__ = process.env.NODE_ENV === 'test' ? {
  buildEnhancedSummaryPrompt,
  truncateText
} : undefined;