#!/usr/bin/env node

/**
 * Optimized Company Dataset Import Script
 * 
 * This script imports companies from the company_dataset.json file into MongoDB
 * using a memory-efficient chunked approach that can handle much larger datasets.
 * 
 * Usage:
 *   node optimizedImport.js [options]
 * 
 * Options:
 *   --total=<number>     Total number of companies to import (default: 100000)
 *   --chunk=<number>     Size of each import chunk (default: 10000)
 *   --batch=<number>     Size of each database batch (default: 20)
 *   --clear              Clear existing company data before import
 *   --drop-indexes       Drop indexes before import and recreate after (faster)
 *   --help               Show help message
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Company from '../src/models/company.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  total: 100000,
  chunkSize: 10000,
  batchSize: 20,
  clear: false,
  dropIndexes: false,
  help: false
};

for (const arg of args) {
  if (arg.startsWith('--total=')) {
    options.total = parseInt(arg.replace('--total=', ''), 10);
  } else if (arg.startsWith('--chunk=')) {
    options.chunkSize = parseInt(arg.replace('--chunk=', ''), 10);
  } else if (arg.startsWith('--batch=')) {
    options.batchSize = parseInt(arg.replace('--batch=', ''), 10);
  } else if (arg === '--clear') {
    options.clear = true;
  } else if (arg === '--drop-indexes') {
    options.dropIndexes = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help message
if (options.help) {
  console.log(`
Optimized Company Dataset Import Script

Usage:
  node optimizedImport.js [options]

Options:
  --total=<number>     Total number of companies to import (default: 100000)
  --chunk=<number>     Size of each import chunk (default: 10000)
  --batch=<number>     Size of each database batch (default: 20)
  --clear              Clear existing company data before import
  --drop-indexes       Drop indexes before import and recreate after (faster)
  --help               Show help message

Examples:
  node optimizedImport.js --total=100000 --chunk=10000 --batch=20 --clear
  node optimizedImport.js --total=50000 --drop-indexes
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
    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    return false;
  }
}

// Clear all companies from the database
async function clearCompanyData() {
  try {
    await Company.deleteMany({});
    console.log('Cleared all company data from database');
    return true;
  } catch (error) {
    console.error('Error clearing company data:', error);
    return false;
  }
}

// Drop all indexes except _id
async function dropIndexes() {
  try {
    console.log('Dropping indexes to speed up import...');
    await Company.collection.dropIndexes();
    console.log('All indexes dropped successfully');
    return true;
  } catch (error) {
    console.error('Error dropping indexes:', error);
    return false;
  }
}

// Recreate indexes
async function recreateIndexes() {
  try {
    console.log('Recreating indexes...');
    
    // Create all the indexes defined in the schema
    await Promise.all([
      Company.collection.createIndex({ id: 1 }, { unique: true }),
      Company.collection.createIndex({ name: 1 }),
      Company.collection.createIndex({ website: 1 }),
      Company.collection.createIndex({ industry: 1 }),
      Company.collection.createIndex({ locality: 1 }),
      Company.collection.createIndex({ region: 1 }),
      Company.collection.createIndex({ country: 1 }),
      Company.collection.createIndex(
        { name: 'text', industry: 'text', locality: 'text', region: 'text', country: 'text' },
        { name: 'text_search_index' }
      )
    ]);
    
    console.log('Indexes recreated successfully');
    return true;
  } catch (error) {
    console.error('Error recreating indexes:', error);
    return false;
  }
}

// Process a chunk of data from the file
async function processChunk(startPosition, endPosition, chunkNumber, totalChunks) {
  return new Promise((resolve, reject) => {
    try {
      // Get the path to the company dataset
      const datasetPath = path.resolve(process.cwd(), '../company_dataset.json');
      
      if (!fs.existsSync(datasetPath)) {
        reject(new Error(`File not found: ${datasetPath}`));
        return;
      }
      
      console.log(`Processing chunk ${chunkNumber}/${totalChunks} (Position ${startPosition} to ${endPosition})...`);
      
      // Create stream
      const fileStream = fs.createReadStream(datasetPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      let linesRead = 0;
      let companiesProcessed = 0;
      let companiesImported = 0;
      let companiesFailed = 0;
      let currentBatch = [];
      
      // Process each line (company) as it's read
      rl.on('line', async (line) => {
        linesRead++;
        
        // Skip until we reach our starting position
        if (linesRead < startPosition) {
          return;
        }
        
        // Stop if we've reached our ending position
        if (linesRead > endPosition) {
          rl.close();
          return;
        }
        
        try {
          // Parse the JSON line
          const company = JSON.parse(line);
          companiesProcessed++;
          
          // Add to current batch
          currentBatch.push(company);
          
          // Process the batch when it reaches the batch size
          if (currentBatch.length >= options.batchSize) {
            // Pause line reading to avoid memory pressure
            rl.pause();
            
            try {
              // Insert the batch with ordered:false to continue on error
              await Company.insertMany(currentBatch, { ordered: false });
              companiesImported += currentBatch.length;
              
              // Calculate progress within this chunk
              const chunkProgress = Math.min(100, Math.round(((linesRead - startPosition) / (endPosition - startPosition)) * 100));
              console.log(`Chunk ${chunkNumber}/${totalChunks} Progress: ${chunkProgress}% (${companiesImported} imported, ${companiesFailed} failed)`);
            } catch (error) {
              // With ordered:false, some documents may have been inserted despite errors
              if (error.writeErrors) {
                // Count how many actually failed vs succeeded
                companiesFailed += error.writeErrors.length;
                companiesImported += (currentBatch.length - error.writeErrors.length);
              } else {
                companiesFailed += currentBatch.length;
                console.error(`Error inserting batch: ${error.message}`);
              }
            } finally {
              // Clear the batch regardless of success/failure
              currentBatch = [];
              
              // Resume line reading
              rl.resume();
            }
          }
        } catch (error) {
          console.error(`Error parsing JSON line: ${error.message}`);
          // Skip this line and continue
        }
      });
      
      // Handle the end of the stream
      rl.on('close', async () => {
        // Insert any remaining companies
        if (currentBatch.length > 0) {
          try {
            await Company.insertMany(currentBatch, { ordered: false });
            companiesImported += currentBatch.length;
          } catch (error) {
            if (error.writeErrors) {
              companiesFailed += error.writeErrors.length;
              companiesImported += (currentBatch.length - error.writeErrors.length);
            } else {
              companiesFailed += currentBatch.length;
            }
          }
        }
        
        console.log(`
Chunk ${chunkNumber}/${totalChunks} completed:
- ${companiesProcessed} companies processed
- ${companiesImported} companies imported successfully
- ${companiesFailed} companies failed to import
        `);
        
        resolve({
          processed: companiesProcessed,
          imported: companiesImported,
          failed: companiesFailed
        });
      });
      
      // Handle errors
      fileStream.on('error', (error) => {
        console.error(`Stream error: ${error.message}`);
        reject(error);
      });
      
    } catch (error) {
      console.error(`Setup error: ${error.message}`);
      reject(error);
    }
  });
}

// Count lines in file (to determine chunks)
async function countLines(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Counting lines in file to determine chunks...');
      let lineCount = 0;
      
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      rl.on('line', () => {
        lineCount++;
        
        // Print progress every 100,000 lines
        if (lineCount % 100000 === 0) {
          console.log(`Counted ${lineCount} lines...`);
        }
      });
      
      rl.on('close', () => {
        console.log(`File contains ${lineCount} lines`);
        resolve(lineCount);
      });
      
      fileStream.on('error', (error) => {
        console.error(`Error counting lines: ${error.message}`);
        reject(error);
      });
    } catch (error) {
      console.error(`Error setting up line count: ${error.message}`);
      reject(error);
    }
  });
}

// Calculate chunk ranges
function calculateChunks(totalLines, totalToImport, chunkSize) {
  const chunks = [];
  const totalChunks = Math.ceil(totalToImport / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize + 1; // 1-indexed
    const end = Math.min((i + 1) * chunkSize, totalToImport);
    chunks.push({ start, end });
  }
  
  return chunks;
}

// Main import process
async function runImport() {
  try {
    // Connect to MongoDB
    const connected = await connectToMongoDB();
    if (!connected) {
      console.error('Failed to connect to MongoDB. Exiting.');
      process.exit(1);
    }
    
    // Print import options
    console.log(`
Import Options:
- Total records to import: ${options.total}
- Chunk size: ${options.chunkSize}
- Database batch size: ${options.batchSize}
- Clear existing data: ${options.clear ? 'Yes' : 'No'}
- Drop indexes for speed: ${options.dropIndexes ? 'Yes' : 'No'}
    `);
    
    // Check how many companies we already have
    const existingCount = await Company.countDocuments();
    console.log(`Database already has ${existingCount} companies`);
    
    // Clear existing data if requested
    if (options.clear) {
      console.log('Clearing existing company data...');
      const cleared = await clearCompanyData();
      if (!cleared) {
        console.error('Failed to clear existing data. Exiting.');
        process.exit(1);
      }
    }
    
    // Drop indexes if requested
    if (options.dropIndexes) {
      const dropped = await dropIndexes();
      if (!dropped) {
        console.log('Warning: Failed to drop indexes. Continuing anyway.');
      }
    }
    
    // Get the path to the company dataset
    const datasetPath = path.resolve(process.cwd(), '../company_dataset.json');
    
    // Count lines in file
    const totalLines = await countLines(datasetPath);
    
    // Adjust total if needed
    const actualTotal = Math.min(options.total, totalLines);
    if (actualTotal < options.total) {
      console.log(`File only contains ${totalLines} lines, limiting import to that amount`);
    }
    
    // Calculate chunks
    const chunks = calculateChunks(totalLines, actualTotal, options.chunkSize);
    console.log(`Splitting import into ${chunks.length} chunks`);
    
    // Process each chunk in sequence
    let totalImported = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const { start, end } = chunks[i];
      
      console.log(`\nStarting chunk ${i + 1}/${chunks.length} (lines ${start}-${end})...`);
      const result = await processChunk(start, end, i + 1, chunks.length);
      
      totalImported += result.imported;
      totalFailed += result.failed;
      
      // Allow GC to reclaim memory between chunks
      global.gc && global.gc();
    }
    
    // Recreate indexes if they were dropped
    if (options.dropIndexes) {
      console.log('Import completed, recreating indexes...');
      await recreateIndexes();
    }
    
    // Show final counts
    const finalCount = await Company.countDocuments();
    console.log(`
Import completed successfully:
- ${totalImported} companies imported
- ${totalFailed} companies failed to import
- ${finalCount} total companies in database
    `);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during import process:', error);
    process.exit(1);
  }
}

// Run the import
runImport(); 