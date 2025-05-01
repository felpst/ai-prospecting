#!/usr/bin/env node

/**
 * Company Dataset Import Script
 * 
 * This script imports companies from the company_dataset.json file into MongoDB.
 * 
 * Usage:
 *   node importCompanies.js [options]
 * 
 * Options:
 *   --limit=<number>     Maximum number of companies to import (default: 1000)
 *   --batch=<number>     Batch size for importing (default: 100)
 *   --clear              Clear existing company data before import
 *   --help               Show help message
 * 
 * Examples:
 *   node importCompanies.js --limit=100
 *   node importCompanies.js --limit=500 --batch=50
 *   node importCompanies.js --clear
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { importCompanyData, clearCompanyData } from '../src/services/dataImportService.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 1000,
  batchSize: 100,
  clear: false,
  help: false
};

for (const arg of args) {
  if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.replace('--limit=', ''), 10);
  } else if (arg.startsWith('--batch=')) {
    options.batchSize = parseInt(arg.replace('--batch=', ''), 10);
  } else if (arg === '--clear') {
    options.clear = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help message
if (options.help) {
  console.log(`
Company Dataset Import Script

Usage:
  node importCompanies.js [options]

Options:
  --limit=<number>     Maximum number of companies to import (default: 1000)
  --batch=<number>     Batch size for importing (default: 100)
  --clear              Clear existing company data before import
  --help               Show help message

Examples:
  node importCompanies.js --limit=100
  node importCompanies.js --limit=500 --batch=50
  node importCompanies.js --clear
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

// Run import process
async function run() {
  try {
    await connectToMongoDB();
    
    console.log(`
Import Options:
- Limit: ${options.limit} companies
- Batch Size: ${options.batchSize} companies
- Clear existing data: ${options.clear ? 'Yes' : 'No'}
    `);
    
    // Clear existing data if requested
    if (options.clear) {
      console.log('Clearing existing company data...');
      const clearResult = await clearCompanyData();
      if (!clearResult.success) {
        console.error(`Failed to clear data: ${clearResult.message}`);
        process.exit(1);
      }
    }
    
    // Import company data
    console.log(`Starting import of up to ${options.limit} companies...`);
    const result = await importCompanyData(options.limit, options.batchSize);
    
    if (result.success) {
      console.log(`Import completed successfully: ${result.message}`);
    } else {
      console.error(`Import failed: ${result.message}`);
      process.exit(1);
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during import process:', error);
    process.exit(1);
  }
}

run(); 