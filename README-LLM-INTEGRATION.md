# LLM Integration for Company Enrichment

This document explains the implementation of the LLM (Large Language Model) integration for company data enrichment. The system uses Anthropic's Claude models to generate comprehensive company summaries based on scraped web content.

## Features

- **Robust LLM Integration**: Seamless integration with Anthropic's Claude API
- **Advanced Prompt Engineering**: Structured prompts that optimize for factual summaries
- **LinkedIn Support**: Special handling for companies with only LinkedIn profiles
- **Error Handling**: Comprehensive error handling with specific error categories
- **Retry Logic**: Exponential backoff with jitter for API failures
- **Content Prioritization**: Intelligent content selection based on relevance
- **Token Management**: Smart token budget allocation to maximize content quality

## Architecture

The LLM integration consists of the following components:

1. **Controller** (`companyController.js`): Handles the API endpoint for triggering enrichment
2. **Scraper Service** (`scraperService.js`): Extracts content from company websites and LinkedIn
3. **Storage Service** (`storageService.js`): Manages scraped content persistence
4. **LLM Service** (`llmService.js`): Handles communication with Anthropic API
5. **Enrichment Service** (`enrichmentService.js`): Integrates enrichment data with company records

## Endpoint

The enrichment process is triggered via:

```
POST /api/companies/:id/enrich
```

This endpoint:
1. Retrieves the company record by ID
2. Checks for website or LinkedIn URL
3. Scrapes content from the web (or retrieves from cache)
4. Calls the LLM service to generate a summary
5. Stores the summary in the company record
6. Returns the enriched company data

## LLM Service Implementation

The LLM service:

1. Constructs optimized prompts that include:
   - Basic company information
   - Structured tasks and guidelines
   - Prioritized content sections (about, products, team)
   - Special handling for LinkedIn-only data

2. Handles API communication with:
   - Error classification and recovery
   - Retries with exponential backoff
   - Rate limit handling
   - Timeout management

3. Processes responses with:
   - Validation
   - Extraction
   - Logging

## Error Handling

The system classifies errors into specific categories:

- **Website Access Issues**:
  - `website_access_denied`: The website is blocking access
  - `website_timeout`: The website took too long to respond
  - `website_not_found`: The URL is invalid or site doesn't exist
  - `network_error`: Network connectivity issues
  - `invalid_url`: Malformed URL

- **LLM Service Issues**:
  - `llm_auth_error`: API key or authentication problems
  - `llm_rate_limit`: Service rate limits exceeded
  - `llm_timeout`: Service took too long to respond
  - `llm_content_policy`: Content policy violations
  - `llm_general_error`: Other LLM service issues

Each error category includes a user-friendly message with appropriate troubleshooting advice.

## Configuration

The LLM service is configured via environment variables:

- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `MODEL`: Claude model to use (defaults to `claude-3-haiku-20240307`)
- `MAX_TOKENS_SUMMARY`: Maximum output tokens for summaries
- `TEMPERATURE_SUMMARY`: Temperature for generation (lower is more factual)

## LinkedIn Support

The system has special handling for companies with only LinkedIn data:

1. The controller detects when only LinkedIn URL is available
2. It uses a specialized LinkedIn scraper to extract profile data
3. The prompt engineering prioritizes LinkedIn data when it's the only source
4. The summary generation process is made more conservative with assumptions

## Testing

### Unit Testing

Run unit tests with:

```bash
NODE_ENV=test npm test
```

The test suite includes:
- Prompt construction tests
- Error handling tests
- Mock API response tests

### Integration Testing

To run integration tests that make actual API calls:

```bash
NODE_ENV=test ANTHROPIC_API_KEY=your_key_here RUN_INTEGRATION_TESTS=true npm test
```

### Manual Testing

For manual testing, use:

```bash
curl -X POST http://localhost:3000/api/companies/{id}/enrich
```

## Monitoring

All API interactions are logged with:
- Token usage
- Response times
- Error rates
- Success/failure counts

---

## Implementation Details

### Prompt Structure

Prompts are structured with the following sections:

1. **Company Information**: Basic details about the company
2. **Task**: Clear instructions for the AI model
3. **Content**: Extracted website/LinkedIn content
4. **Source Context**: Information about the data sources
5. **Output Instructions**: Guidelines for generating the summary

Example:

```
Generate a concise, factual, and professional summary (target: 150-200 words) for the company named "TechCorp".

### Company Information ###
Industry: Software Development
Website: https://techcorp.com
LinkedIn: https://linkedin.com/company/techcorp

### Task ###
Analyze the following content from their web presence...

### Content ###
--- About Info ---
Founded in 2015, TechCorp is a leader in...

### Source Context ###
The above content is derived from the company's website.

### Output Instructions ###
Write a comprehensive yet concise company summary...
```

### Error Recovery

The system implements several error recovery mechanisms:

1. **Transient Errors**: Uses exponential backoff with jitter
2. **Rate Limits**: Respects `Retry-After` headers
3. **Partial Success**: Returns partial results when content scraping succeeds but LLM fails
4. **Fallback Content**: Prioritizes available content when some sections fail

## Edge Cases

The system handles the following edge cases:

1. **LinkedIn-Only Companies**: Special prompt handling for companies with only LinkedIn profiles
2. **Minimal Content**: Can generate summaries with limited input data
3. **Content Overload**: Intelligently truncates content to fit token limits
4. **No Website Content**: Falls back to provided company metadata 