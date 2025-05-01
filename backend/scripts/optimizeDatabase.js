#!/usr/bin/env node

/**
 * Database Optimization Script
 * 
 * This script creates and verifies all necessary indexes for the database.
 * It also analyzes the database and provides recommendations for further optimization.
 * 
 * Usage:
 *   node optimizeDatabase.js [options]
 * 
 * Options:
 *   --analyze    Analyze database and collection stats
 *   --test       Run query performance tests
 *   --help       Show help message
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Company from '../src/models/company.js';
import User from '../src/models/user.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  analyze: false,
  test: false,
  help: false
};

for (const arg of args) {
  if (arg === '--analyze') {
    options.analyze = true;
  } else if (arg === '--test') {
    options.test = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help message
if (options.help) {
  console.log(`
Database Optimization Script

Usage:
  node optimizeDatabase.js [options]

Options:
  --analyze    Analyze database and collection stats
  --test       Run query performance tests
  --help       Show help message
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

// Create and verify indexes
async function createAndVerifyIndexes() {
  try {
    console.log('Creating and verifying indexes...');
    
    // Create Company indexes
    console.log('Ensuring indexes for Company collection...');
    
    // These indexes are defined in the schema, but we'll create them explicitly here
    // to ensure they exist (and for documentation purposes)
    const companyIndexes = [
      { key: { id: 1 }, options: { unique: true, name: 'idx_company_id' } },
      { key: { name: 1 }, options: { name: 'idx_company_name' } },
      { key: { industry: 1 }, options: { name: 'idx_company_industry' } },
      { key: { country: 1 }, options: { name: 'idx_company_country' } },
      { key: { region: 1 }, options: { name: 'idx_company_region' } },
      { key: { locality: 1 }, options: { name: 'idx_company_locality' } },
      { key: { website: 1 }, options: { name: 'idx_company_website' } },
      // Compound indexes for common query combinations
      { key: { country: 1, industry: 1 }, options: { name: 'idx_company_country_industry' } },
      { key: { industry: 1, size: 1 }, options: { name: 'idx_company_industry_size' } },
      // Text search index
      { 
        key: { name: 'text', industry: 'text', locality: 'text', region: 'text', country: 'text' },
        options: { name: 'idx_company_text_search' }
      }
    ];
    
    // Create User indexes
    console.log('Ensuring indexes for User collection...');
    
    const userIndexes = [
      { key: { email: 1 }, options: { unique: true, name: 'idx_user_email' } }
    ];
    
    // Get the raw MongoDB collections
    const companyCollection = mongoose.connection.collection('companies');
    const userCollection = mongoose.connection.collection('users');
    
    // Create Company indexes
    for (const index of companyIndexes) {
      try {
        await companyCollection.createIndex(index.key, index.options);
        console.log(`Created index: ${index.options.name}`);
      } catch (error) {
        console.error(`Error creating index ${index.options.name}:`, error);
      }
    }
    
    // Create User indexes
    for (const index of userIndexes) {
      try {
        await userCollection.createIndex(index.key, index.options);
        console.log(`Created index: ${index.options.name}`);
      } catch (error) {
        console.error(`Error creating index ${index.options.name}:`, error);
      }
    }
    
    console.log('Index creation and verification completed.');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

// Analyze database and collection stats
async function analyzeDatabase() {
  try {
    console.log('Analyzing database...');
    
    // Get database stats
    const db = mongoose.connection.db;
    const dbStats = await db.stats();
    
    console.log('\nDatabase Stats:');
    console.log(`- Database: ${dbStats.db}`);
    console.log(`- Collections: ${dbStats.collections}`);
    console.log(`- Objects: ${dbStats.objects}`);
    console.log(`- Storage Size: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Indexes: ${dbStats.indexes}`);
    console.log(`- Index Size: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Get Company collection stats
    const companyStats = await db.collection('companies').stats();
    
    console.log('\nCompany Collection Stats:');
    console.log(`- Count: ${companyStats.count}`);
    console.log(`- Size: ${(companyStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Average Object Size: ${(companyStats.avgObjSize / 1024).toFixed(2)} KB`);
    console.log(`- Storage Size: ${(companyStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Indexes: ${companyStats.nindexes}`);
    console.log(`- Index Size: ${(companyStats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Get User collection stats
    const userStats = await db.collection('users').stats();
    
    console.log('\nUser Collection Stats:');
    console.log(`- Count: ${userStats.count}`);
    console.log(`- Size: ${(userStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Average Object Size: ${(userStats.avgObjSize / 1024).toFixed(2)} KB`);
    console.log(`- Storage Size: ${(userStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Indexes: ${userStats.nindexes}`);
    console.log(`- Index Size: ${(userStats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    
    // List Company indexes
    const companyIndexes = await db.collection('companies').indexes();
    
    console.log('\nCompany Indexes:');
    companyIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // List User indexes
    const userIndexes = await db.collection('users').indexes();
    
    console.log('\nUser Indexes:');
    userIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
  } catch (error) {
    console.error('Error analyzing database:', error);
  }
}

// Test query performance
async function testQueryPerformance() {
  try {
    console.log('Testing query performance...');
    
    // Get company count
    const companyCount = await Company.countDocuments();
    
    if (companyCount === 0) {
      console.log('No companies in the database. Skipping tests.');
      return;
    }
    
    console.log(`\nRunning tests against ${companyCount} companies.`);
    
    // Test 1: Simple query by id
    console.log('\nTest 1: Query by ID');
    const sample = await Company.findOne().lean();
    
    console.time('Query by ID');
    const result1 = await Company.findOne({ id: sample.id }).lean();
    console.timeEnd('Query by ID');
    
    console.log('Results:', result1 ? 'Found' : 'Not Found');
    
    // Test 2: Query by name
    console.log('\nTest 2: Query by Name');
    
    console.time('Query by Name');
    const result2 = await Company.findOne({ name: sample.name }).lean();
    console.timeEnd('Query by Name');
    
    console.log('Results:', result2 ? 'Found' : 'Not Found');
    
    // Test 3: Query by industry and country
    console.log('\nTest 3: Query by Industry and Country');
    
    console.time('Query by Industry and Country');
    const result3 = await Company.find({
      industry: sample.industry,
      country: sample.country
    }).limit(10).lean();
    console.timeEnd('Query by Industry and Country');
    
    console.log(`Results: ${result3.length} companies found`);
    
    // Test 4: Text search
    if (sample.name) {
      console.log('\nTest 4: Text Search');
      const searchTerm = sample.name.split(' ')[0];
      
      console.time('Text Search');
      const result4 = await Company.find(
        { $text: { $search: searchTerm } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      console.timeEnd('Text Search');
      
      console.log(`Results: ${result4.length} companies found searching for "${searchTerm}"`);
    }
    
    // Test 5: Pagination query with filters
    console.log('\nTest 5: Pagination with Filters');
    
    console.time('Pagination Query');
    const result5 = await Company.find({
      industry: sample.industry
    })
      .skip(0)
      .limit(10)
      .lean();
    console.timeEnd('Pagination Query');
    
    console.log(`Results: ${result5.length} companies found`);
    
    // Test with explain
    console.log('\nQuery Execution Plan Analysis:');
    
    const plan = await Company.find({
      industry: sample.industry,
      country: sample.country
    }).explain('executionStats');
    
    console.log('Execution plan:');
    console.log(`- Query Stage: ${plan.queryPlanner.winningPlan.stage}`);
    
    // Only print execution stats if they exist (MongoDB 5.0+)
    if (plan.executionStats) {
      console.log(`- Execution Time: ${plan.executionStats.executionTimeMillis} ms`);
      console.log(`- Documents Examined: ${plan.executionStats.totalDocsExamined}`);
      console.log(`- Keys Examined: ${plan.executionStats.totalKeysExamined}`);
      console.log(`- Documents Returned: ${plan.executionStats.nReturned}`);
    }
    
    // Print index usage if available
    if (plan.queryPlanner.winningPlan.inputStage && 
        plan.queryPlanner.winningPlan.inputStage.indexName) {
      console.log(`- Index Used: ${plan.queryPlanner.winningPlan.inputStage.indexName}`);
    } else {
      console.log('- Index Used: None (collection scan)');
    }
  } catch (error) {
    console.error('Error testing query performance:', error);
  }
}

// Run the script
async function run() {
  try {
    await connectToMongoDB();
    
    await createAndVerifyIndexes();
    
    if (options.analyze) {
      await analyzeDatabase();
    }
    
    if (options.test) {
      await testQueryPerformance();
    }
    
    console.log('\nDatabase optimization completed.');
    
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during database optimization:', error);
    process.exit(1);
  }
}

run(); 