#!/usr/bin/env node

/**
 * Docker Entrypoint Script
 * 
 * This script runs when the backend container starts and ensures the database has data.
 * It will:
 * 1. Check if companies already exist in the database
 * 2. If not, try to import from the full dataset if available (using optimized import for large datasets)
 * 3. If full dataset is not available, create sample data (500 companies)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import helper functions
import { getDataStatus } from '../src/services/dataImportService.js';

// Connect to MongoDB with retry logic
async function connectToDatabase() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/ai-prospecting';
  console.log(`Connecting to MongoDB at ${mongoURI}...`);
  
  let retries = 10; // Increase retries for Docker environment where MongoDB might take longer to start
  const retryDelay = 3000; // 3 seconds between retries
  
  while (retries > 0) {
    try {
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB');
      return true;
    } catch (error) {
      console.error(`Failed to connect to MongoDB (${retries} retries left):`, error.message);
      retries--;
      
      if (retries === 0) {
        console.error('Failed to connect to MongoDB after multiple attempts');
        return false;
      }
      
      // Wait longer before retrying in Docker environment
      console.log(`Waiting ${retryDelay/1000} seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  return false;
}

// Run data import or create sample data
async function ensureDataExists() {
  // Check if database has data
  const status = await getDataStatus();
  if (status.success && status.isImported) {
    console.log(`Database already has ${status.count} companies. No need to import.`);
    return true;
  }
  
  // Check if full dataset exists
  const fullDatasetPath = path.resolve(process.cwd(), '../company_dataset.json');
  if (fs.existsSync(fullDatasetPath)) {
    console.log('Full dataset found. Running optimized import script...');
    return await runOptimizedImport(fullDatasetPath);
  } else {
    console.log('Full dataset not found. Creating sample data...');
    return runSampleDataGeneration();
  }
}

// Run optimized import with 100,000 companies
async function runOptimizedImport(datasetPath) {
  // Use optimized import if we're targeting 100k+ records
  const importScript = path.join(__dirname, 'optimizedImport.js');
  
  // Check if optimized import script exists
  if (fs.existsSync(importScript)) {
    console.log('Using optimized import for large dataset (100,000 companies)...');
    
    // Calculate file size to detect if we need special handling
    const stats = fs.statSync(datasetPath);
    const fileSizeInGB = stats.size / (1024 * 1024 * 1024);
    console.log(`Dataset size: ${fileSizeInGB.toFixed(2)} GB`);
    
    // Set appropriate memory allocation based on file size
    const memoryNeeded = Math.max(4096, Math.ceil(fileSizeInGB * 1024));
    console.log(`Allocating ${memoryNeeded}MB memory for import`);
    
    return new Promise((resolve) => {
      // Run with increased Node memory and optimized parameters
      const child = fork(
        importScript, 
        [
          '--total=100000', 
          '--chunk=10000', 
          '--batch=20', 
          '--clear', 
          '--drop-indexes'
        ], 
        { 
          stdio: 'inherit',
          execArgv: [`--max-old-space-size=${memoryNeeded}`],
          env: {
            ...process.env,
            NODE_OPTIONS: `--max-old-space-size=${memoryNeeded}`
          }
        }
      );
      
      child.on('exit', (code) => {
        if (code === 0) {
          console.log('Optimized import completed successfully');
          resolve(true);
        } else {
          console.error(`Optimized import script exited with code ${code}`);
          console.log('Falling back to regular import...');
          return runRegularImport();
        }
      });
    });
  } else {
    console.log('Optimized import script not found, using regular import...');
    return runRegularImport();
  }
}

// Run regular import with limited records
function runRegularImport() {
  return new Promise((resolve) => {
    console.log('Running regular import with 10,000 companies...');
    const child = fork(
      path.join(__dirname, 'importCompanies.js'), 
      ['--limit=10000', '--batch=50', '--clear'], 
      { stdio: 'inherit' }
    );
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log('Import completed successfully');
        resolve(true);
      } else {
        console.error(`Import script exited with code ${code}`);
        console.log('Falling back to sample data generation...');
        resolve(runSampleDataGeneration());
      }
    });
  });
}

// Run sample data generation
function runSampleDataGeneration() {
  return new Promise((resolve) => {
    console.log('Creating 500 sample companies...');
    const child = fork(
      path.join(__dirname, 'createSampleData.js'), 
      ['--count=500', '--clear'], 
      { stdio: 'inherit' }
    );
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log('Sample data generation completed successfully');
        resolve(true);
      } else {
        console.error(`Sample data generation exited with code ${code}`);
        resolve(false);
      }
    });
  });
}

// Start the API server
function startServer() {
  return new Promise((resolve) => {
    console.log('Starting API server...');
    const child = fork(
      path.join(process.cwd(), 'src/server.js'), 
      [], 
      { stdio: 'inherit' }
    );
    
    // This should keep running indefinitely
    child.on('exit', (code) => {
      console.error(`API server exited with code ${code}`);
      resolve(false);
    });
  });
}

// Main entry point
async function main() {
  try {
    // Connect to database
    const connected = await connectToDatabase();
    if (!connected) {
      process.exit(1);
    }
    
    // Ensure data exists in the database
    const dataEnsured = await ensureDataExists();
    if (!dataEnsured) {
      console.error('Failed to ensure data exists');
      // Continue anyway, as the server might still be usable with empty DB
    }
    
    // Start the API server
    await startServer();
  } catch (error) {
    console.error('Error in entrypoint script:', error);
    process.exit(1);
  }
}

main(); 