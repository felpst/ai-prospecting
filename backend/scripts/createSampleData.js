#!/usr/bin/env node

/**
 * Create Sample Company Data Script
 * 
 * This script creates a sample dataset for testing the frontend without requiring the large 
 * company_dataset.json file.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Company from '../src/models/company.js';
import { connectToDatabase } from '../src/utils/database.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  count: 500,
  clear: false
};

for (const arg of args) {
  if (arg.startsWith('--count=')) {
    options.count = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--clear') {
    options.clear = true;
  } else if (arg === '--help') {
    console.log(`
Usage: node createSampleData.js [options]

Options:
  --count=<number>    Number of sample companies to create (default: 500)
  --clear             Clear existing companies before adding new ones
  --help              Show this help message
    `);
    process.exit(0);
  }
}

// Sample industries for random assignment
const industries = [
  'Information Technology and Services',
  'Software',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Education',
  'Hospitality',
  'Telecommunications',
  'Consulting'
];

// Sample sizes for random assignment
const sizes = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10001+'
];

// Sample countries and regions
const locations = [
  { country: 'United States', region: 'California', locality: 'San Francisco' },
  { country: 'United States', region: 'California', locality: 'Los Angeles' },
  { country: 'United States', region: 'New York', locality: 'New York City' },
  { country: 'United States', region: 'Texas', locality: 'Austin' },
  { country: 'United States', region: 'Washington', locality: 'Seattle' },
  { country: 'United Kingdom', region: 'England', locality: 'London' },
  { country: 'Canada', region: 'Ontario', locality: 'Toronto' },
  { country: 'Germany', region: 'Berlin', locality: 'Berlin' },
  { country: 'France', region: 'Île-de-France', locality: 'Paris' },
  { country: 'India', region: 'Karnataka', locality: 'Bangalore' }
];

// Generate a random company
function generateCompany(index) {
  const location = locations[Math.floor(Math.random() * locations.length)];
  const foundedYear = Math.floor(Math.random() * (2023 - 1980 + 1)) + 1980;
  
  // Some companies have enrichment, some don't
  const hasEnrichment = Math.random() > 0.7;
  
  return {
    id: `sample${index}`,
    name: `Sample Company ${index}`,
    website: `https://sample${index}.com`,
    industry: industries[Math.floor(Math.random() * industries.length)],
    founded: foundedYear,
    size: sizes[Math.floor(Math.random() * sizes.length)],
    locality: location.locality,
    region: location.region,
    country: location.country,
    linkedin_url: `https://linkedin.com/company/sample${index}`,
    enrichment: hasEnrichment ? 
      `Sample Company ${index} is a ${foundedYear}-founded company specializing in innovative solutions in the ${industries[Math.floor(Math.random() * industries.length)]} industry. Based in ${location.locality}, they have a team of professionals dedicated to excellence.` : 
      undefined,
    last_enriched: hasEnrichment ? new Date() : undefined
  };
}

async function createSampleData() {
  try {
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    console.log('Connected to MongoDB');

    if (options.clear) {
      console.log('Clearing existing companies...');
      await Company.deleteMany({});
      console.log('Existing companies cleared');
    }

    console.log(`Creating ${options.count} sample companies...`);
    
    const sampleCompanies = [];
    for (let i = 1; i <= options.count; i++) {
      sampleCompanies.push(generateCompany(i));
    }
    
    await Company.insertMany(sampleCompanies);
    
    console.log(`Successfully created ${options.count} sample companies`);

    // Verify data was imported
    const count = await Company.countDocuments();
    console.log(`Total companies in database: ${count}`);
    
  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

createSampleData(); 