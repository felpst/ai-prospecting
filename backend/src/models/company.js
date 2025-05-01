import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  // Original dataset fields
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  website: {
    type: String,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  founded: {
    type: Number
  },
  size: {
    type: String
  },
  locality: {
    type: String,
    trim: true,
    index: true
  },
  region: {
    type: String,
    trim: true,
    index: true
  },
  country: {
    type: String,
    trim: true,
    index: true
  },
  industry: {
    type: String,
    trim: true,
    index: true
  },
  linkedin_url: {
    type: String,
    trim: true
  },
  
  // Additional fields for AI enrichment
  enrichment: {
    type: String,
    trim: true
  },
  last_enriched: {
    type: Date
  }
}, {
  timestamps: true
});

// Text search index on key fields
companySchema.index({
  name: 'text',
  industry: 'text',
  locality: 'text',
  region: 'text',
  country: 'text'
});

// Virtual for full location string
companySchema.virtual('location').get(function() {
  const parts = [];
  if (this.locality) parts.push(this.locality);
  if (this.region) parts.push(this.region);
  if (this.country) parts.push(this.country);
  return parts.join(', ');
});

// Export the model
const Company = mongoose.model('Company', companySchema);
export default Company; 