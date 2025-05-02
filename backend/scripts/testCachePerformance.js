#!/usr/bin/env node

/**
 * Cache Performance Test Script
 * Tests the performance of different caching strategies
 * 
 * Usage:
 *   node testCachePerformance.js
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';
import cacheService from '../src/utils/cacheService.js';
import { connectToDatabase } from '../src/utils/database.js';
import Company from '../src/models/company.js';

// Configuration
const API_BASE_URL = 'http://localhost:3001/api';
const NUM_ITERATIONS = 3;
const COMPANY_LIMIT = 5;
const SEARCH_QUERIES = [
  'software',
  'healthcare',
  'ai',
  'consulting'
];

// Format numbers with comma separators
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format time differences
const formatTime = (time) => {
  return `${time.toFixed(2)}ms`;
};

// Calculate percentage improvement
const calculateImprovement = (uncached, cached) => {
  const improvement = ((uncached - cached) / uncached) * 100;
  return `${improvement.toFixed(2)}%`;
};

// Test search performance with and without caching
const testSearchPerformance = async () => {
  console.log('\n----- SEARCH ENDPOINT CACHE TEST -----');
  
  const results = [];
  
  for (const query of SEARCH_QUERIES) {
    const searchUrl = `${API_BASE_URL}/search?query=${query}&limit=10`;
    
    // First, ensure cache is clear for this query
    await fetch(`${API_BASE_URL}/admin/cache/clear/search`, { method: 'POST' });
    
    // Test without cache (first request)
    console.log(`\nTesting search for "${query}":`);
    let uncachedTimes = [];
    let cachedTimes = [];
    
    // First request (uncached)
    const startUncached = performance.now();
    const uncachedResponse = await fetch(searchUrl);
    const uncachedData = await uncachedResponse.json();
    const endUncached = performance.now();
    const uncachedTime = endUncached - startUncached;
    uncachedTimes.push(uncachedTime);
    
    // Multiple cached requests
    for (let i = 0; i < NUM_ITERATIONS; i++) {
      const startCached = performance.now();
      const cachedResponse = await fetch(searchUrl);
      const cachedData = await cachedResponse.json();
      const endCached = performance.now();
      const cachedTime = endCached - startCached;
      cachedTimes.push(cachedTime);
      
      // Verify that cache is being used
      const cacheStatus = cachedResponse.headers.get('X-Cache');
      if (cacheStatus !== 'HIT' && i > 0) {
        console.warn(`  Warning: Expected cache hit but got ${cacheStatus}`);
      }
    }
    
    // Calculate averages
    const avgUncached = uncachedTimes.reduce((sum, time) => sum + time, 0) / uncachedTimes.length;
    const avgCached = cachedTimes.reduce((sum, time) => sum + time, 0) / cachedTimes.length;
    const improvement = calculateImprovement(avgUncached, avgCached);
    
    console.log(`  Uncached: ${formatTime(avgUncached)}`);
    console.log(`  Cached:   ${formatTime(avgCached)}`);
    console.log(`  Improvement: ${improvement}`);
    
    results.push({
      query,
      uncachedTime: avgUncached,
      cachedTime: avgCached,
      improvement: ((avgUncached - avgCached) / avgUncached) * 100
    });
  }
  
  // Print summary
  console.log('\nSearch Cache Performance Summary:');
  console.log('─────────────────────────────────────────────────────');
  console.log('Query       | Uncached     | Cached       | Improvement');
  console.log('─────────────────────────────────────────────────────');
  
  let totalImprovement = 0;
  for (const result of results) {
    console.log(
      `${result.query.padEnd(12)} | ` +
      `${formatTime(result.uncachedTime).padEnd(12)} | ` +
      `${formatTime(result.cachedTime).padEnd(12)} | ` +
      `${calculateImprovement(result.uncachedTime, result.cachedTime)}`
    );
    totalImprovement += result.improvement;
  }
  
  console.log('─────────────────────────────────────────────────────');
  console.log(`Average Improvement: ${(totalImprovement / results.length).toFixed(2)}%`);
};

// Test company details performance with and without caching
const testCompanyDetailsPerformance = async () => {
  console.log('\n----- COMPANY DETAILS ENDPOINT CACHE TEST -----');
  
  // First, connect to the database to get some company IDs
  await connectToDatabase();
  
  // Get some company IDs to test with
  const companies = await Company.find().limit(COMPANY_LIMIT).lean();
  
  if (companies.length === 0) {
    console.error('No companies found in the database');
    return;
  }
  
  const results = [];
  
  for (const company of companies) {
    const detailsUrl = `${API_BASE_URL}/companies/${company.id}`;
    
    // First, ensure cache is clear for this company
    await fetch(`${API_BASE_URL}/admin/cache/clear/company/${company.id}`, { method: 'POST' });
    
    // Test without cache (first request)
    console.log(`\nTesting company details for "${company.name}" (${company.id}):`);
    let uncachedTimes = [];
    let cachedTimes = [];
    
    // First request (uncached)
    const startUncached = performance.now();
    const uncachedResponse = await fetch(detailsUrl);
    const uncachedData = await uncachedResponse.json();
    const endUncached = performance.now();
    const uncachedTime = endUncached - startUncached;
    uncachedTimes.push(uncachedTime);
    
    // Multiple cached requests
    for (let i = 0; i < NUM_ITERATIONS; i++) {
      const startCached = performance.now();
      const cachedResponse = await fetch(detailsUrl);
      const cachedData = await cachedResponse.json();
      const endCached = performance.now();
      const cachedTime = endCached - startCached;
      cachedTimes.push(cachedTime);
      
      // Verify that cache is being used
      const cacheStatus = cachedResponse.headers.get('X-Cache');
      if (cacheStatus !== 'HIT' && i > 0) {
        console.warn(`  Warning: Expected cache hit but got ${cacheStatus}`);
      }
    }
    
    // Calculate averages
    const avgUncached = uncachedTimes.reduce((sum, time) => sum + time, 0) / uncachedTimes.length;
    const avgCached = cachedTimes.reduce((sum, time) => sum + time, 0) / cachedTimes.length;
    const improvement = calculateImprovement(avgUncached, avgCached);
    
    console.log(`  Uncached: ${formatTime(avgUncached)}`);
    console.log(`  Cached:   ${formatTime(avgCached)}`);
    console.log(`  Improvement: ${improvement}`);
    
    results.push({
      companyId: company.id,
      companyName: company.name,
      uncachedTime: avgUncached,
      cachedTime: avgCached,
      improvement: ((avgUncached - avgCached) / avgUncached) * 100
    });
  }
  
  // Print summary
  console.log('\nCompany Details Cache Performance Summary:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('Company        | Uncached     | Cached       | Improvement');
  console.log('─────────────────────────────────────────────────────────────────');
  
  let totalImprovement = 0;
  for (const result of results) {
    const displayName = result.companyName.substring(0, 12).padEnd(14);
    console.log(
      `${displayName} | ` +
      `${formatTime(result.uncachedTime).padEnd(12)} | ` +
      `${formatTime(result.cachedTime).padEnd(12)} | ` +
      `${calculateImprovement(result.uncachedTime, result.cachedTime)}`
    );
    totalImprovement += result.improvement;
  }
  
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`Average Improvement: ${(totalImprovement / results.length).toFixed(2)}%`);
};

// Test cache stats endpoint
const testCacheStats = async () => {
  console.log('\n----- CACHE STATISTICS -----');
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/cache/stats`);
    const stats = await response.json();
    
    console.log('Cache Type:', stats.type);
    console.log('Hit Rate:', stats.hitRate);
    console.log('Total Operations:', stats.totalOperations);
    console.log('Hits:', stats.hits);
    console.log('Misses:', stats.misses);
    console.log('Sets:', stats.sets);
    console.log('Errors:', stats.errors);
    console.log('Uptime:', `${stats.uptime} seconds`);
  } catch (error) {
    console.error('Failed to fetch cache stats:', error.message);
  }
};

// Main function to run all tests
const runTests = async () => {
  try {
    console.log('=== CACHE PERFORMANCE TEST ===');
    console.log('Testing with iterations:', NUM_ITERATIONS);
    
    // Run the tests
    await testSearchPerformance();
    await testCompanyDetailsPerformance();
    await testCacheStats();
    
    console.log('\n=== TEST COMPLETE ===');
    process.exit(0);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
};

// Run the tests
runTests(); 