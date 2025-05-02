#!/usr/bin/env node

/**
 * Create Optimized Indexes Script
 * 
 * This script creates optimized indexes for the database based on common query patterns.
 * It analyzes the query patterns and creates strategic indexes to improve performance.
 * 
 * Usage:
 *   node createOptimizedIndexes.js [options]
 * 
 * Options:
 *   --dry-run       Show what indexes would be created without actually creating them
 *   --force         Drop existing indexes before creating new ones (use with caution)
 *   --help          Show help message
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Company from '../src/models/company.js';
import User from '../src/models/user.js';
import ScrapedContent from '../src/models/scrapedContent.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: false,
  force: false,
  help: false
};

for (const arg of args) {
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--force') {
    options.force = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help message
if (options.help) {
  console.log(`
Create Optimized Indexes Script

Usage:
  node createOptimizedIndexes.js [options]

Options:
  --dry-run       Show what indexes would be created without actually creating them
  --force         Drop existing indexes before creating new ones (use with caution)
  --help          Show help message
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

// Define the indexes to create
// This is based on common query patterns identified in the application
const companyIndexes = [
  // Existing single-field indexes from schema (for reference)
  // { key: { id: 1 }, options: { unique: true, name: 'idx_company_id' } },
  // { key: { name: 1 }, options: { name: 'idx_company_name' } },
  // { key: { industry: 1 }, options: { name: 'idx_company_industry' } },
  // { key: { country: 1 }, options: { name: 'idx_company_country' } },
  // { key: { region: 1 }, options: { name: 'idx_company_region' } },
  // { key: { locality: 1 }, options: { name: 'idx_company_locality' } },
  // { key: { website: 1 }, options: { name: 'idx_company_website' } },
  
  // Optimized compound indexes for common query patterns
  { 
    key: { industry: 1, country: 1 }, 
    options: { 
      name: 'idx_company_industry_country',
      background: true,
      description: 'Optimizes queries filtering by both industry and country'
    } 
  },
  { 
    key: { industry: 1, size: 1 }, 
    options: { 
      name: 'idx_company_industry_size',
      background: true,
      description: 'Optimizes queries filtering by both industry and company size'
    } 
  },
  { 
    key: { country: 1, region: 1, locality: 1 }, 
    options: { 
      name: 'idx_company_location_hierarchy',
      background: true,
      description: 'Optimizes location-based queries with hierarchical filtering'
    } 
  },
  { 
    key: { founded: 1 }, 
    options: { 
      name: 'idx_company_founded',
      background: true,
      description: 'Optimizes queries filtering by founding year'
    } 
  },
  { 
    key: { industry: 1, founded: 1 }, 
    options: { 
      name: 'idx_company_industry_founded',
      background: true,
      description: 'Optimizes queries filtering by both industry and founding year'
    } 
  },
  { 
    key: { name: 1, industry: 1 }, 
    options: { 
      name: 'idx_company_name_industry',
      background: true,
      description: 'Optimizes sorting by name while filtering by industry'
    } 
  }
];

// Additional user collection indexes
const userIndexes = [
  // Email index is already defined in the schema
  { 
    key: { 'savedCompanies.id': 1 }, 
    options: { 
      name: 'idx_user_saved_companies',
      background: true,
      description: 'Optimizes queries looking for users who saved specific companies'
    } 
  }
];

// Get existing indexes for a collection
async function getExistingIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    console.error(`Error getting indexes for ${collection.collectionName}:`, error);
    return [];
  }
}

// Create indexes for a collection
async function createIndexes(collection, indexes, existingIndexes) {
  console.log(`\nProcessing indexes for ${collection.collectionName} collection...`);
  
  for (const index of indexes) {
    try {
      // Check if index already exists
      const indexName = index.options.name;
      const indexExists = existingIndexes.some(idx => idx.name === indexName);
      
      if (indexExists) {
        console.log(`Index "${indexName}" already exists.`);
        continue;
      }
      
      console.log(`Creating index "${indexName}": ${JSON.stringify(index.key)}`);
      console.log(`Description: ${index.options.description || 'No description provided'}`);
      
      if (!options.dryRun) {
        await collection.createIndex(index.key, index.options);
        console.log(`Successfully created index "${indexName}"`);
      } else {
        console.log(`[DRY RUN] Would create index "${indexName}"`);
      }
    } catch (error) {
      console.error(`Error creating index ${index.options.name}:`, error);
    }
  }
}

// Drop all non-essential indexes (keeping _id and unique indexes)
async function dropIndexes(collection) {
  try {
    console.log(`\nDropping non-essential indexes for ${collection.collectionName} collection...`);
    
    const existingIndexes = await getExistingIndexes(collection);
    
    for (const index of existingIndexes) {
      // Skip _id index and unique indexes
      if (index.name === '_id_' || index.unique === true) {
        console.log(`Keeping essential index "${index.name}"`);
        continue;
      }
      
      console.log(`Dropping index "${index.name}": ${JSON.stringify(index.key)}`);
      
      if (!options.dryRun) {
        await collection.dropIndex(index.name);
        console.log(`Successfully dropped index "${index.name}"`);
      } else {
        console.log(`[DRY RUN] Would drop index "${index.name}"`);
      }
    }
  } catch (error) {
    console.error(`Error dropping indexes for ${collection.collectionName}:`, error);
  }
}

// Run the script
async function run() {
  try {
    await connectToMongoDB();
    
    console.log(`Running in ${options.dryRun ? 'DRY RUN' : 'LIVE'} mode`);
    if (options.force) {
      console.log('FORCE mode enabled: Will drop existing indexes before creating new ones');
    }
    
    // Get the raw MongoDB collections
    const companyCollection = mongoose.connection.collection('companies');
    const userCollection = mongoose.connection.collection('users');
    
    // Get existing indexes
    const existingCompanyIndexes = await getExistingIndexes(companyCollection);
    const existingUserIndexes = await getExistingIndexes(userCollection);
    
    // Display existing indexes
    console.log('\nExisting Company Indexes:');
    existingCompanyIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\nExisting User Indexes:');
    existingUserIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Drop indexes if force mode is enabled
    if (options.force) {
      if (!options.dryRun) {
        console.log('\nWARNING: Dropping indexes can significantly impact performance while rebuilding');
      }
      
      await dropIndexes(companyCollection);
      await dropIndexes(userCollection);
      
      // Update existing indexes list after dropping
      const updatedCompanyIndexes = await getExistingIndexes(companyCollection);
      const updatedUserIndexes = await getExistingIndexes(userCollection);
      
      // Create indexes
      await createIndexes(companyCollection, companyIndexes, updatedCompanyIndexes);
      await createIndexes(userCollection, userIndexes, updatedUserIndexes);
    } else {
      // Create indexes without dropping existing ones
      await createIndexes(companyCollection, companyIndexes, existingCompanyIndexes);
      await createIndexes(userCollection, userIndexes, existingUserIndexes);
    }
    
    // Create an index report
    if (!options.dryRun) {
      await createIndexReport();
    }
    
    await mongoose.disconnect();
    console.log('\nMongoDB connection closed');
    console.log(`Index optimization ${options.dryRun ? 'simulation' : 'process'} completed.`);
  } catch (error) {
    console.error('Error during index optimization:', error);
    process.exit(1);
  }
}

// Create a report of all indexes in the database
async function createIndexReport() {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `index_report_${timestamp}.json`);
    
    // Get all collections
    const collections = await mongoose.connection.db.collections();
    
    const report = {
      generated: new Date().toISOString(),
      collections: {}
    };
    
    // Get indexes for each collection
    for (const collection of collections) {
      const collectionName = collection.collectionName;
      const indexes = await collection.indexes();
      
      report.collections[collectionName] = {
        count: indexes.length,
        indexes: indexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: !!idx.unique,
          sparse: !!idx.sparse,
          expireAfterSeconds: idx.expireAfterSeconds,
          background: !!idx.background
        }))
      };
    }
    
    // Write report to file
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nIndex report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Error creating index report:', error);
  }
}

run(); 