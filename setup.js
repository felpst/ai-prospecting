#!/usr/bin/env node

/**
 * AI-Prospecting Setup Script
 * 
 * This script prepares the environment for running the AI-Prospecting platform.
 * It checks if the company_dataset.json file exists, and if not, downloads a sample file.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import https from 'https';
import { createWriteStream } from 'fs';

// Convert to ES modules style
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up paths
const datasetPath = path.join(__dirname, 'company_dataset.json');
const sampleUrl = 'https://github.com/eyaltoledano/ai-prospecting-dataset/raw/main/sample_100k_companies.json';

// Check if file exists
async function fileExists(filePath) {
  try {
    await promisify(fs.access)(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

// Download file with progress reporting
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading sample dataset from ${url}...`);
    console.log('This may take a few minutes depending on your internet connection.');
    console.log('The file is approximately 100MB in size.');
    
    const file = createWriteStream(destination);
    let receivedBytes = 0;
    let totalBytes = 0;
    let lastReportedProgress = 0;
    
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      
      response.on('data', chunk => {
        receivedBytes += chunk.length;
        const progress = Math.floor((receivedBytes / totalBytes) * 100);
        
        // Report progress at 10% intervals to avoid console spam
        if (progress >= lastReportedProgress + 10) {
          lastReportedProgress = Math.floor(progress / 10) * 10;
          process.stdout.write(`Download progress: ${progress}%\r`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`\nDownload complete! File saved to ${destination}`);
        resolve();
      });
    }).on('error', err => {
      fs.unlink(destination, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Create a simple sample file with a few companies
async function createMinimalSampleFile(filePath) {
  console.log('Creating a minimal sample file with a few companies...');
  
  // Sample companies data (100 companies)
  const companies = Array.from({ length: 100 }, (_, i) => ({
    id: `company${i+1}`,
    name: `Sample Company ${i+1}`,
    website: `https://example${i+1}.com`,
    industry: ['Software', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'][i % 5],
    size: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'][i % 7],
    locality: ['San Francisco', 'New York', 'London', 'Berlin', 'Tokyo'][i % 5],
    region: ['California', 'New York', 'England', 'Berlin', 'Tokyo'][i % 5],
    country: ['United States', 'United States', 'United Kingdom', 'Germany', 'Japan'][i % 5],
    founded: 1980 + Math.floor(i/3),
    description: `This is a sample company description for Company ${i+1}. It operates in the ${['Software', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'][i % 5]} industry.`,
    employee_count: [5, 25, 100, 300, 750, 2500, 10000][i % 7],
    revenue: ['$1M-$5M', '$5M-$10M', '$10M-$50M', '$50M-$100M', '$100M+'][i % 5]
  }));
  
  // Write each company as a separate JSON line
  const stream = fs.createWriteStream(filePath);
  
  for (const company of companies) {
    stream.write(JSON.stringify(company) + '\n');
  }
  
  stream.end();
  console.log(`Created minimal sample file with 100 companies at ${filePath}`);
}

// Main function
async function main() {
  console.log('AI-Prospecting Setup');
  console.log('====================');
  
  // Check if dataset exists
  const exists = await fileExists(datasetPath);
  
  if (exists) {
    const stats = fs.statSync(datasetPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`Dataset file already exists (${fileSizeMB.toFixed(2)} MB)`);
    console.log('Setup complete! You can now run: docker-compose up');
    return;
  }
  
  // File doesn't exist, try to download
  console.log('Company dataset file not found.');
  
  try {
    // Attempt to download the sample file
    await downloadFile(sampleUrl, datasetPath);
    console.log('Setup complete! You can now run: docker-compose up');
  } catch (error) {
    console.error(`Error downloading sample dataset: ${error.message}`);
    console.log('Creating a minimal dataset instead...');
    
    try {
      // Create a minimal sample file as fallback
      await createMinimalSampleFile(datasetPath);
      console.log('Setup complete with minimal dataset! You can now run: docker-compose up');
      console.log('Note: Only 100 sample companies were created. For a more realistic experience,');
      console.log('you may want to obtain the full dataset and place it at the root as company_dataset.json');
    } catch (fallbackError) {
      console.error(`Error creating minimal dataset: ${fallbackError.message}`);
      console.error('Setup failed. Please manually create a company_dataset.json file before running the application.');
      process.exit(1);
    }
  }
}

// Run the script
main().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
}); 