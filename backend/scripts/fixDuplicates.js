#!/usr/bin/env node

/**
 * Fix Duplicate Companies Script
 * 
 * This script identifies and removes duplicate company entries in the database,
 * keeping only one copy of each company ID.
 * 
 * Usage:
 *   node fixDuplicates.js [options]
 * 
 * Options:
 *   --dry-run           Show duplicates but don't remove them
 *   --help              Show help message
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Company from '../src/models/company.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: false,
  help: false
};

for (const arg of args) {
  if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help message
if (options.help) {
  console.log(`
Fix Duplicate Companies Script

Usage:
  node fixDuplicates.js [options]

Options:
  --dry-run           Show duplicates but don't remove them
  --help              Show help message
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

// Find and fix duplicate companies
async function fixDuplicates() {
  try {
    await connectToMongoDB();
    
    console.log(`
Fix Duplicates Options:
- Dry Run: ${options.dryRun ? 'Yes (no changes will be made)' : 'No (duplicates will be removed)'}
    `);
    
    // Check for specific company ID
    console.log('Checking for specific company ID: TkHYDDfKICGTZaXw9tbv9Q4y5zk8');
    const specificCount = await Company.countDocuments({ id: 'TkHYDDfKICGTZaXw9tbv9Q4y5zk8' });
    console.log(`Found ${specificCount} instances of company ID: TkHYDDfKICGTZaXw9tbv9Q4y5zk8`);
    
    // Find all company IDs with duplicates
    console.log('Finding company IDs with duplicates...');
    
    // Aggregate to find duplicate IDs
    const duplicates = await Company.aggregate([
      { $group: { _id: "$id", count: { $sum: 1 }, documents: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log(`Found ${duplicates.length} company IDs with duplicates`);
    
    if (duplicates.length === 0) {
      console.log('No duplicates found. Database is clean.');
      await mongoose.disconnect();
      return;
    }
    
    // Print some statistics about the duplicates
    let totalDuplicatesToRemove = 0;
    
    console.log('\nTop 10 most duplicated company IDs:');
    duplicates.slice(0, 10).forEach(dup => {
      totalDuplicatesToRemove += (dup.count - 1);
      console.log(`ID '${dup._id}' has ${dup.count} copies (${dup.count - 1} duplicates to remove)`);
    });
    
    for (const dup of duplicates) {
      totalDuplicatesToRemove += (dup.count - 1);
    }
    
    console.log(`\nTotal duplicates to remove: ${totalDuplicatesToRemove}`);
    
    if (options.dryRun) {
      console.log('DRY RUN: No changes made. Run without --dry-run to fix duplicates.');
      await mongoose.disconnect();
      return;
    }
    
    // Process each duplicate ID
    let removedCount = 0;
    let processedCount = 0;
    const totalToProcess = duplicates.length;
    
    for (const dup of duplicates) {
      // Keep the first document, remove the rest
      const docsToRemove = dup.documents.slice(1);
      
      processedCount++;
      if (processedCount % 100 === 0 || processedCount === totalToProcess) {
        console.log(`Progress: ${Math.round((processedCount / totalToProcess) * 100)}% (${processedCount}/${totalToProcess})`);
      }
      
      // Delete the duplicate documents
      const result = await Company.deleteMany({ 
        _id: { $in: docsToRemove }
      });
      
      removedCount += result.deletedCount;
    }
    
    console.log(`Successfully removed ${removedCount} duplicate companies`);
    
    // Verify results
    const finalCount = await Company.countDocuments();
    console.log(`Total companies in database: ${finalCount}`);
    
    // Verify the specific company again
    const specificCountAfter = await Company.countDocuments({ id: 'TkHYDDfKICGTZaXw9tbv9Q4y5zk8' });
    console.log(`Now found ${specificCountAfter} instances of company ID: TkHYDDfKICGTZaXw9tbv9Q4y5zk8`);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
    
  } catch (error) {
    console.error('Error fixing duplicates:', error);
    process.exit(1);
  }
}

// Run the script
fixDuplicates(); 