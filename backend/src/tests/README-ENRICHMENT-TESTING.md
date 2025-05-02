# Company Enrichment Testing Guide

This document provides information on how to test the company enrichment feature, which uses web scraping and LLM integration to generate AI-powered company summaries.

## Testing Approaches

There are two main approaches to testing the enrichment feature:

1. **Unit and Integration Tests** - These tests use mocks and stubs to test individual components and their integrations.
2. **End-to-End Tests** - These tests verify the complete flow from API request to database storage.

## Running the Automated Tests

### Unit Tests for LLM Service

These tests verify the LLM service functionality, including prompt construction and error handling:

```bash
# Run LLM service tests
NODE_ENV=test npx mocha --node-option=experimental-modules --require=dotenv/config src/tests/llmService.test.js
```

### End-to-End Tests

These tests verify the complete enrichment process using mocks:

```bash
# Run E2E tests
NODE_ENV=test npx mocha --node-option=experimental-modules --require=dotenv/config src/tests/enrichment-e2e.test.js
```

## Running Real-World Enrichment Tests

To test the enrichment process with actual company data and real API calls:

```bash
# Set your environment variables first
export ANTHROPIC_API_KEY=your_key_here

# Run with default settings
NODE_ENV=test node src/scripts/test-enrichment-e2e.js

# Run and save results to JSON
NODE_ENV=test node src/scripts/test-enrichment-e2e.js --save-results
```

Results will be saved to the `test-results` directory with timestamps.

## What's Being Tested

### Unit Tests (llmService.test.js)

- Prompt construction for different company data types
- Error handling for various LLM service failures
- API integration with the Anthropic Claude API (if API key is provided)

### End-to-End Tests (enrichment-e2e.test.js)

- Complete enrichment flow from controller to database
- Website and LinkedIn data extraction paths
- Content caching and reuse
- Error handling for various failure scenarios
- Performance tracking

### Real-World Tests (test-enrichment-e2e.js)

- End-to-end process with actual company data
- Real web scraping against company websites
- Actual LLM API calls to generate summaries
- Performance metrics for the entire process

## Test Coverage

The enrichment tests cover:

| Component | Coverage |
|-----------|----------|
| Controller | Request handling, error responses, data flow |
| Scraper Service | Website and LinkedIn scraping, error handling |
| Storage Service | Content caching, retrieval, and status management |
| LLM Service | API calls, prompting, error handling, retry logic |
| Data Flow | Complete process from request to response |

## Interpreting Results

### Unit Test Results

Test output will show which tests pass and fail. Pay special attention to:

- Prompt construction tests - Ensures the LLM receives well-structured prompts
- Error handling tests - Verifies the system handles API failures gracefully

### End-to-End Test Results

Test output will show the complete flow through all services. Key points to verify:

- Successful company enrichment with website data
- Successful company enrichment with LinkedIn-only data
- Proper error handling for scraping failures
- Proper error handling for LLM service failures
- Performance tracking metrics

### Real-World Test Results

The script will output detailed information about each test, including:

- Scraping status for each company
- Generated summaries (when successful)
- Error details (when failures occur)
- Execution time for the entire process

The summary at the end shows how many companies were successfully enriched and how many failed.

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure your `ANTHROPIC_API_KEY` is set correctly in your environment.

2. **Scraping Failures**: Some websites have anti-scraping measures. These errors are expected and should be handled gracefully.

3. **Rate Limit Errors**: If testing many companies, you might hit rate limits with the LLM API. Space out your tests or reduce the number of test companies.

### Error Categories

The enrichment system categorizes errors to help with debugging:

- `website_access_denied`: The website is blocking automated access
- `website_timeout`: The website took too long to respond
- `website_not_found`: Invalid URL or site doesn't exist
- `llm_auth_error`: LLM API authentication issues
- `llm_rate_limit`: Rate limit exceeded with LLM API
- `llm_timeout`: LLM API timeout
- `llm_content_policy`: Content policy violations

## Extending the Tests

### Adding More Test Cases

To add more test cases to the real-world enrichment script:

1. Edit `src/scripts/test-enrichment-e2e.js`
2. Add new company objects to the `testCompanies` array
3. Run the script to test the new companies

### Creating New Test Scenarios

To test specific edge cases or failure scenarios:

1. Add new test cases to `src/tests/enrichment-e2e.test.js`
2. Use sinon to mock specific error conditions
3. Verify the system handles the errors as expected 