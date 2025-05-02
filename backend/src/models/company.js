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

// Optimized text search index with weights for different fields
companySchema.index({
  name: 'text',
  industry: 'text',
  locality: 'text',
  region: 'text',
  country: 'text'
}, {
  name: 'optimized_text_search',
  weights: {
    name: 10,         // Company name is most important
    industry: 5,       // Industry is very relevant
    locality: 3,       // City/locality is moderately important
    region: 2,         // Region/state is less important
    country: 1         // Country is least important in text search
  },
  default_language: 'english'
});

// Compound indexes for common query patterns
companySchema.index({ industry: 1, country: 1 }, { 
  name: 'idx_industry_country',
  background: true
});

companySchema.index({ industry: 1, size: 1 }, {
  name: 'idx_industry_size',
  background: true
});

companySchema.index({ country: 1, region: 1, locality: 1 }, {
  name: 'idx_location_hierarchy',
  background: true
});

companySchema.index({ founded: 1 }, {
  name: 'idx_founded',
  background: true
});

// Compound index for sorting by name within an industry
companySchema.index({ industry: 1, name: 1 }, {
  name: 'idx_industry_name_sort',
  background: true
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