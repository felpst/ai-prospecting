#!/usr/bin/env node

/**
 * Database Query Performance Analysis Script
 * 
 * This script analyzes the performance of common database queries using MongoDB's explain() method.
 * It tests different query patterns and reports on execution statistics to help identify optimization opportunities.
 * 
 * Usage:
 *   node analyzeQueryPerformance.js [options]
 * 
 * Options:
 *   --verbose       Show detailed explain output
 *   --csv           Output results in CSV format
 *   --help          Show help message
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Company from '../src/models/company.js';
import User from '../src/models/user.js';
import { buildCompanyFilter, buildSortOptions } from '../src/utils/queryBuilder.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: false,
  csv: false,
  help: false
};

for (const arg of args) {
  if (arg === '--verbose') {
    options.verbose = true;
  } else if (arg === '--csv') {
    options.csv = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help message
if (options.help) {
  console.log(`
Database Query Performance Analysis Script

Usage:
  node analyzeQueryPerformance.js [options]

Options:
  --verbose       Show detailed explain output
  --csv           Output results in CSV format
  --help          Show help message
  `);
  process.exit(0);
}

// Test query scenarios
const queryScenarios = [
  {
    name: 'Find by ID',
    description: 'Retrieve a single company by ID',
    query: async (id) => Company.findOne({ id }),
    params: null
  },
  {
    name: 'Search by Name',
    description: 'Text search on company name',
    query: async (name) => Company.find({ $text: { $search: name } }).limit(10),
    params: null
  },
  {
    name: 'Filter by Industry',
    description: 'Filter companies by industry',
    query: async (industry) => Company.find({ industry }).limit(10),
    params: null
  },
  {
    name: 'Filter by Country',
    description: 'Filter companies by country',
    query: async (country) => Company.find({ country }).limit(10),
    params: null
  },
  {
    name: 'Filter by Industry and Country',
    description: 'Filter companies by industry and country',
    query: async (params) => Company.find({
      industry: params.industry,
      country: params.country
    }).limit(10),
    params: null
  },
  {
    name: 'RegExp Search on Name',
    description: 'Filter companies using regex on name field',
    query: async (namePattern) => Company.find({ name: new RegExp(namePattern, 'i') }).limit(10),
    params: null
  },
  {
    name: 'Paginated Results',
    description: 'Paginated company results with offset',
    query: async (params) => Company.find({})
      .skip(params.skip)
      .limit(params.limit),
    params: null
  },
  {
    name: 'Sort by Name',
    description: 'Sort companies by name',
    query: async () => Company.find({}).sort({ name: 1 }).limit(10),
    params: null
  },
  {
    name: 'Complex Filter with Sort',
    description: 'Filter by multiple fields with sorting',
    query: async (params) => {
      const filter = buildCompanyFilter(params);
      const sortOptions = buildSortOptions(params);
      return Company.find(filter).sort(sortOptions).limit(10);
    },
    params: null
  },
  {
    name: 'Count Documents with Filter',
    description: 'Count companies matching a filter',
    query: async (params) => {
      const filter = buildCompanyFilter(params);
      return Company.countDocuments(filter);
    },
    params: null
  }
];

// Results array
const results = [];

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

// Run explain on a query
async function explainQuery(query, name, description) {
  try {
    console.log(`\nAnalyzing query: ${name}`);
    console.log(`Description: ${description}`);
    
    const startTime = Date.now();
    const explainResult = await query.explain('executionStats');
    const executionTime = Date.now() - startTime;
    
    // Extract relevant execution stats
    const executionStats = explainResult.executionStats || {};
    const queryPlanner = explainResult.queryPlanner || {};
    const winningPlan = queryPlanner.winningPlan || {};
    const inputStage = winningPlan.inputStage || {};
    
    // Determine if an index was used
    let indexUsed = null;
    if (inputStage.indexName) {
      indexUsed = inputStage.indexName;
    } else if (winningPlan.inputStage && winningPlan.inputStage.indexName) {
      indexUsed = winningPlan.inputStage.indexName;
    } else if (winningPlan.shards && winningPlan.shards[0].winningPlan && 
              winningPlan.shards[0].winningPlan.inputStage && 
              winningPlan.shards[0].winningPlan.inputStage.indexName) {
      indexUsed = winningPlan.shards[0].winningPlan.inputStage.indexName;
    }
    
    // Calculate efficiency metrics
    const docsExamined = executionStats.totalDocsExamined || 0;
    const docsReturned = executionStats.nReturned || 0;
    const efficiency = docsReturned > 0 ? (docsReturned / docsExamined) * 100 : 0;
    const queryStage = winningPlan.stage || 'UNKNOWN';
    
    // Create result object
    const result = {
      name,
      description,
      executionTimeMs: executionStats.executionTimeMillis || executionTime,
      docsExamined,
      docsReturned,
      efficiency: efficiency.toFixed(2) + '%',
      indexUsed: indexUsed || 'None (COLLSCAN)',
      queryStage
    };
    
    // Print summary
    console.log(`- Execution Time: ${result.executionTimeMs} ms`);
    console.log(`- Documents Examined: ${result.docsExamined}`);
    console.log(`- Documents Returned: ${result.docsReturned}`);
    console.log(`- Efficiency: ${result.efficiency}`);
    console.log(`- Index Used: ${result.indexUsed}`);
    console.log(`- Query Stage: ${result.queryStage}`);
    
    // Show detailed explain output if verbose mode is enabled
    if (options.verbose) {
      console.log('\nDetailed Explain Output:');
      console.log(JSON.stringify(explainResult, null, 2));
    }
    
    // Add to results array
    results.push(result);
    
    return result;
  } catch (error) {
    console.error(`Error explaining query ${name}:`, error);
    results.push({
      name,
      description,
      error: error.message
    });
    return null;
  }
}

// Run all query analysis
async function runQueryAnalysis() {
  try {
    // Get sample data for query parameters
    const sampleCompany = await Company.findOne().lean();
    
    if (!sampleCompany) {
      console.log('No companies found in the database. Please import data first.');
      return;
    }
    
    console.log('\n=== Running Query Performance Analysis ===\n');
    
    // Set query parameters based on sample company
    queryScenarios[0].params = sampleCompany.id;
    queryScenarios[1].params = sampleCompany.name.split(' ')[0]; // First word of company name
    queryScenarios[2].params = sampleCompany.industry;
    queryScenarios[3].params = sampleCompany.country;
    queryScenarios[4].params = { industry: sampleCompany.industry, country: sampleCompany.country };
    queryScenarios[5].params = sampleCompany.name.substring(0, 3); // First 3 chars of name
    queryScenarios[6].params = { skip: 100, limit: 10 }; // Page 11 with 10 items per page
    queryScenarios[7].params = null; // No parameters needed
    queryScenarios[8].params = {
      industry: sampleCompany.industry,
      country: sampleCompany.country,
      sort: 'name',
      order: 'asc'
    };
    queryScenarios[9].params = {
      industry: sampleCompany.industry
    };
    
    // Run each query scenario
    for (const scenario of queryScenarios) {
      // Create and execute the query
      let query;
      if (scenario.params === null) {
        query = scenario.query();
      } else {
        query = scenario.query(scenario.params);
      }
      
      // Analyze the query
      await explainQuery(query, scenario.name, scenario.description);
    }
    
    // Generate performance report
    generatePerformanceReport();
  } catch (error) {
    console.error('Error during query analysis:', error);
  }
}

// Generate performance report
function generatePerformanceReport() {
  console.log('\n=== Query Performance Summary ===\n');
  
  // Sort results by execution time (slowest first)
  results.sort((a, b) => {
    if (a.executionTimeMs === undefined) return 1;
    if (b.executionTimeMs === undefined) return -1;
    return b.executionTimeMs - a.executionTimeMs;
  });
  
  // Display table header
  console.log('| Query | Execution Time (ms) | Docs Examined | Docs Returned | Efficiency | Index Used |');
  console.log('|-------|---------------------|---------------|---------------|------------|------------|');
  
  // Display results
  for (const result of results) {
    if (result.error) {
      console.log(`| ${result.name} | ERROR: ${result.error} |`);
    } else {
      console.log(`| ${result.name} | ${result.executionTimeMs} | ${result.docsExamined} | ${result.docsReturned} | ${result.efficiency} | ${result.indexUsed} |`);
    }
  }
  
  // Generate recommendations
  generateRecommendations();
  
  // Export to CSV if requested
  if (options.csv) {
    exportResultsToCSV();
  }
}

// Generate optimization recommendations
function generateRecommendations() {
  console.log('\n=== Optimization Recommendations ===\n');
  
  const recommendations = [];
  
  // Analyze each result for potential improvements
  for (const result of results) {
    if (result.error) continue;
    
    // Check for collection scans (no index used)
    if (result.indexUsed === 'None (COLLSCAN)' || result.queryStage === 'COLLSCAN') {
      recommendations.push(`Create an index for the "${result.name}" query to avoid collection scan.`);
    }
    
    // Check for poor efficiency (docs examined >> docs returned)
    if (result.docsExamined > 0 && (result.docsReturned / result.docsExamined) < 0.1) {
      recommendations.push(`Improve index for "${result.name}" query. Examining too many documents (${result.docsExamined}) for few results (${result.docsReturned}).`);
    }
    
    // Check for slow execution time
    if (result.executionTimeMs > 100) {
      recommendations.push(`Optimize "${result.name}" query. Execution time (${result.executionTimeMs}ms) is high.`);
    }
  }
  
  // Add general recommendations
  if (results.find(r => r.name === 'RegExp Search on Name' && !r.error)) {
    recommendations.push('Consider using text indexes instead of regular expressions for text search.');
  }
  
  if (results.find(r => r.name === 'Paginated Results' && r.executionTimeMs > 50 && !r.error)) {
    recommendations.push('Replace skip/limit pagination with cursor-based pagination for better performance with large offsets.');
  }
  
  if (results.find(r => r.name === 'Complex Filter with Sort' && !r.error)) {
    recommendations.push('Create compound indexes that match common filter+sort combinations.');
  }
  
  // Display recommendations
  if (recommendations.length === 0) {
    console.log('No specific optimization recommendations.');
  } else {
    console.log('Based on the query analysis, here are some recommendations:');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }
}

// Export results to CSV
function exportResultsToCSV() {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(__dirname, `query_performance_${timestamp}.csv`);
    
    // CSV header
    let csv = 'Query,Description,Execution Time (ms),Docs Examined,Docs Returned,Efficiency,Index Used,Query Stage\n';
    
    // Add data rows
    for (const result of results) {
      if (result.error) {
        csv += `"${result.name}","${result.description}","ERROR: ${result.error}",,,,\n`;
      } else {
        csv += `"${result.name}","${result.description}",${result.executionTimeMs},${result.docsExamined},${result.docsReturned},"${result.efficiency}","${result.indexUsed}","${result.queryStage}"\n`;
      }
    }
    
    // Write to file
    fs.writeFileSync(outputPath, csv);
    console.log(`\nResults exported to: ${outputPath}`);
  } catch (error) {
    console.error('Error exporting results to CSV:', error);
  }
}

// Run the script
async function run() {
  try {
    await connectToMongoDB();
    await runQueryAnalysis();
    
    await mongoose.disconnect();
    console.log('\nMongoDB connection closed');
  } catch (error) {
    console.error('Error during query analysis:', error);
    process.exit(1);
  }
}

run(); 