#!/usr/bin/env node

import mongoose from 'mongoose';
import 'dotenv/config';
import Company from '../src/models/company.js';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-prospecting';
    await mongoose.connect(mongoURI);
    console.log(`Connected to MongoDB at ${mongoURI}`);
    
    // Get total count
    const totalCount = await Company.countDocuments();
    console.log(`\nTotal companies in database: ${totalCount}`);
    
    // Get industries count
    const industries = await Company.aggregate([
      { $group: { _id: '$industry', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    console.log('\nTop 10 industries:');
    industries.forEach(i => console.log(`- ${i._id || 'Unknown'}: ${i.count}`));
    
    // Get locations count
    const countries = await Company.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    console.log('\nTop 10 countries:');
    countries.forEach(c => console.log(`- ${c._id || 'Unknown'}: ${c.count}`));
    
    // Get company sizes
    const sizes = await Company.aggregate([
      { $group: { _id: '$size', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\nCompany sizes:');
    sizes.forEach(s => console.log(`- ${s._id || 'Unknown'}: ${s.count}`));
    
    // Sample companies
    const samples = await Company.find().limit(5);
    console.log('\nSample companies:');
    samples.forEach(c => console.log(JSON.stringify({
      id: c.id,
      name: c.name,
      industry: c.industry,
      location: `${c.locality || ''}, ${c.region || ''}, ${c.country || ''}`.replace(/, ,/g, ',').replace(/^, |, $/g, ''),
      founded: c.founded,
      size: c.size
    }, null, 2)));
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 