#!/usr/bin/env node

/**
 * Test Performance Improvement Script
 * 
 * This script runs performance tests on original and optimized query implementations
 * to measure and compare their effectiveness.
 * 
 * Usage:
 *   node testPerformanceImprovement.js [options]
 * 
 * Options:
 *   --iterations=<n>  Number of test iterations (default: 5)
 *   --verbose         Show detailed results
 *   --help            Show help message
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Company from '../src/models/company.js';
import * as searchService from '../src/services/searchService.js';
import { buildCompanyFilter, buildSortOptions } from '../src/utils/queryBuilder.js';
import { cursorPaginate } from '../src/utils/paginationUtils.js';

// Parse command line arguments
const args = process.argv.slice(2);
let iterations = 5;
let verbose = false;
let help = false;

for (const arg of args) {
  if (arg.startsWith('--iterations=')) {
    iterations = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--verbose') {
    verbose = true;
  } else if (arg === '--help') {
    help = true;
  }
}

// Show help message
if (help) {
  console.log(`
Test Performance Improvement Script

Usage:
  node testPerformanceImprovement.js [options]

Options:
  --iterations=<n>  Number of test iterations (default: 5)
  --verbose         Show detailed results
  --help            Show help message
  `);
  process.exit(0);
}

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-prospecting';
    console.log(`Connecting to MongoDB at ${mongoURI}...`);
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connection established');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Test scenarios
const testScenarios = [
  {
    name: 'Simple ID Lookup',
    params: { id: '' }, // Will be filled with actual data
    original: async (params) => {
      return await Company.findOne({ id: params.id }).lean();
    },
    optimized: async (params) => {
      return await searchService.executeSearch({ id: params.id });
    }
  },
  {
    name: 'Text Search Query',
    params: { query: 'software' },
    original: async (params) => {
      const filter = { $text: { $search: params.query } };
      const companies = await Company.find(filter)
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      const total = await Company.countDocuments(filter);
      return { companies, total };
    },
    optimized: async (params) => {
      return await searchService.searchCompanies(params);
    }
  },
  {
    name: 'Filter by Industry and Country',
    params: { industry: 'Technology', country: 'United States' },
    original: async (params) => {
      const filter = {
        industry: new RegExp(params.industry, 'i'),
        country: new RegExp(params.country, 'i')
      };
      const companies = await Company.find(filter)
        .limit(10)
        .lean();
      const total = await Company.countDocuments(filter);
      return { companies, total };
    },
    optimized: async (params) => {
      const filter = buildCompanyFilter(params);
      const sortOptions = buildSortOptions(params);
      return await cursorPaginate(Company, filter, sortOptions, { limit: 10 });
    }
  },
  {
    name: 'Paginated Results (Page 10)',
    params: { page: 10, limit: 10 },
    original: async (params) => {
      const skip = (parseInt(params.page, 10) - 1) * parseInt(params.limit, 10);
      const companies = await Company.find({})
        .skip(skip)
        .limit(parseInt(params.limit, 10))
        .lean();
      const total = await Company.countDocuments({});
      return { companies, total };
    },
    optimized: async (params) => {
      // Simulate cursor-based pagination for page 10
      // In real scenarios, we'd have a cursor from page 9
      const companies = await Company.find({})
        .sort({ _id: 1 })
        .limit(((parseInt(params.page, 10) - 1) * parseInt(params.limit, 10)) + parseInt(params.limit, 10) + 1)
        .lean();
      
      // We'd normally use the cursor from previous page, but for this test,
      // we're simulating by slicing the array
      const result = companies.slice(-11);
      const hasMore = result.length > 10;
      return { 
        results: result.slice(0, 10),
        pagination: {
          has_more: hasMore,
          limit: parseInt(params.limit, 10)
        }
      };
    }
  },
  {
    name: 'Complex Filter with Sort',
    params: { industry: 'Finance', country: 'United Kingdom', sort: 'name', order: 'asc' },
    original: async (params) => {
      const filter = {
        industry: new RegExp(params.industry, 'i'),
        country: new RegExp(params.country, 'i')
      };
      const sortOptions = {};
      sortOptions[params.sort] = params.order === 'desc' ? -1 : 1;
      
      const companies = await Company.find(filter)
        .sort(sortOptions)
        .limit(10)
        .lean();
      const total = await Company.countDocuments(filter);
      return { companies, total };
    },
    optimized: async (params) => {
      // Use aggregation pipeline for complex queries
      const pipeline = [
        {
          $match: {
            industry: new RegExp(params.industry, 'i'),
            country: new RegExp(params.country, 'i')
          }
        },
        {
          $sort: {
            [params.sort]: params.order === 'desc' ? -1 : 1,
            _id: 1 // Secondary sort for consistency
          }
        },
        { $limit: 11 } // Get one extra to check for more pages
      ];
      
      const results = await Company.aggregate(pipeline);
      const hasMore = results.length > 10;
      
      return {
        results: results.slice(0, 10),
        pagination: {
          has_more: hasMore,
          limit: 10
        }
      };
    }
  },
  {
    name: 'Faceted Search',
    params: { industry: 'Retail', includeFacets: true },
    original: async (params) => {
      // Original implementation would make multiple queries
      const filter = { industry: new RegExp(params.industry, 'i') };
      
      // Get companies
      const companies = await Company.find(filter)
        .limit(10)
        .lean();
      
      // Count total
      const total = await Company.countDocuments(filter);
      
      // Get country facets
      const countries = await Company.aggregate([
        { $match: filter },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Get size facets
      const sizes = await Company.aggregate([
        { $match: filter },
        { $group: { _id: '$size', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      return {
        companies,
        total,
        facets: {
          country: countries,
          size: sizes
        }
      };
    },
    optimized: async (params) => {
      // Optimized implementation uses a single aggregation query with $facet
      return await searchService.facetedSearch(params, ['country', 'size']);
    }
  }
];

// Run performance tests
async function runPerformanceTests() {
  try {
    console.log(`\nRunning performance tests (${iterations} iterations per scenario)...`);
    
    // Find a sample company ID for the first test
    const sampleCompany = await Company.findOne().lean();
    if (sampleCompany) {
      testScenarios[0].params.id = sampleCompany.id;
    } else {
      console.warn('No sample company found. Skipping ID lookup test.');
      testScenarios.shift();
    }
    
    const results = [];
    
    // Run each test scenario
    for (const scenario of testScenarios) {
      console.log(`\nTesting Scenario: ${scenario.name}`);
      console.log(`Parameters: ${JSON.stringify(scenario.params)}`);
      
      const scenarioResults = {
        name: scenario.name,
        original: {
          iterations: [],
          mean: 0,
          median: 0,
          min: 0,
          max: 0
        },
        optimized: {
          iterations: [],
          mean: 0,
          median: 0,
          min: 0,
          max: 0
        },
        improvement: 0
      };
      
      // Run original implementation
      console.log('\nRunning original implementation...');
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await scenario.original(scenario.params);
        const end = performance.now();
        const duration = end - start;
        scenarioResults.original.iterations.push(duration);
        
        if (verbose) {
          console.log(`  Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
        }
      }
      
      // Run optimized implementation
      console.log('\nRunning optimized implementation...');
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await scenario.optimized(scenario.params);
        const end = performance.now();
        const duration = end - start;
        scenarioResults.optimized.iterations.push(duration);
        
        if (verbose) {
          console.log(`  Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
        }
      }
      
      // Calculate statistics for original
      scenarioResults.original.iterations.sort((a, b) => a - b);
      scenarioResults.original.min = scenarioResults.original.iterations[0];
      scenarioResults.original.max = scenarioResults.original.iterations[scenarioResults.original.iterations.length - 1];
      scenarioResults.original.mean = scenarioResults.original.iterations.reduce((sum, val) => sum + val, 0) / iterations;
      scenarioResults.original.median = iterations % 2 === 0
        ? (scenarioResults.original.iterations[iterations / 2 - 1] + scenarioResults.original.iterations[iterations / 2]) / 2
        : scenarioResults.original.iterations[Math.floor(iterations / 2)];
      
      // Calculate statistics for optimized
      scenarioResults.optimized.iterations.sort((a, b) => a - b);
      scenarioResults.optimized.min = scenarioResults.optimized.iterations[0];
      scenarioResults.optimized.max = scenarioResults.optimized.iterations[scenarioResults.optimized.iterations.length - 1];
      scenarioResults.optimized.mean = scenarioResults.optimized.iterations.reduce((sum, val) => sum + val, 0) / iterations;
      scenarioResults.optimized.median = iterations % 2 === 0
        ? (scenarioResults.optimized.iterations[iterations / 2 - 1] + scenarioResults.optimized.iterations[iterations / 2]) / 2
        : scenarioResults.optimized.iterations[Math.floor(iterations / 2)];
      
      // Calculate improvement percentage
      scenarioResults.improvement = ((scenarioResults.original.mean - scenarioResults.optimized.mean) / scenarioResults.original.mean) * 100;
      
      // Display results
      console.log('\nResults:');
      console.log(`  Original Implementation:   ${scenarioResults.original.mean.toFixed(2)}ms (median: ${scenarioResults.original.median.toFixed(2)}ms)`);
      console.log(`  Optimized Implementation:  ${scenarioResults.optimized.mean.toFixed(2)}ms (median: ${scenarioResults.optimized.median.toFixed(2)}ms)`);
      console.log(`  Improvement:               ${scenarioResults.improvement.toFixed(2)}%`);
      
      results.push(scenarioResults);
    }
    
    // Save results to file
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(__dirname, `performance_results_${timestamp}.json`);
    
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      iterations,
      results
    }, null, 2));
    
    console.log(`\nResults saved to: ${outputPath}`);
    
    // Show summary
    console.log('\n=== Performance Improvement Summary ===\n');
    console.log('| Scenario | Original (ms) | Optimized (ms) | Improvement |');
    console.log('|----------|---------------|----------------|-------------|');
    
    for (const result of results) {
      console.log(`| ${result.name} | ${result.original.mean.toFixed(2)} | ${result.optimized.mean.toFixed(2)} | ${result.improvement.toFixed(2)}% |`);
    }
    
    // Calculate average improvement
    const avgImprovement = results.reduce((sum, result) => sum + result.improvement, 0) / results.length;
    console.log(`\nAverage Improvement: ${avgImprovement.toFixed(2)}%`);
  } catch (error) {
    console.error('Error running performance tests:', error);
  }
}

// Run the script
async function run() {
  try {
    await connectToMongoDB();
    await runPerformanceTests();
    
    await mongoose.disconnect();
    console.log('\nMongoDB connection closed');
  } catch (error) {
    console.error('Error during performance testing:', error);
    process.exit(1);
  }
}

run(); 