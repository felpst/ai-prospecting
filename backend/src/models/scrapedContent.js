import mongoose from 'mongoose';
import zlib from 'zlib';
import { promisify } from 'util';

// Promisify zlib methods
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const scrapedContentSchema = new mongoose.Schema({
  // Core identifiers
  url: { 
    type: String, 
    required: true, 
    index: true 
  },
  companyId: {
    type: String,
    index: true,
    sparse: true,
    ref: 'Company'
  },
  domain: { 
    type: String, 
    index: true 
  },
  
  // Metadata
  title: { 
    type: String,
    trim: true
  },
  statusCode: { 
    type: Number 
  },
  scrapeDate: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  
  // Content and compression flags
  mainContent: { 
    type: String,
    select: true  // Always returned in queries
  },
  aboutInfo: { 
    type: String 
  },
  productInfo: { 
    type: String 
  },
  teamInfo: { 
    type: String 
  },
  contactInfo: { 
    type: String 
  },
  rawHtml: { 
    type: Buffer, 
    select: false  // Not returned by default in queries
  },
  isCompressed: {
    type: Boolean,
    default: false
  },
  
  // Processing status
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'processed', 'failed', 'enriched'],
    default: 'pending',
    index: true
  },
  processingAttempts: {
    type: Number,
    default: 0
  },
  processingError: {
    type: String
  },
  lastProcessedAt: {
    type: Date
  },
  
  // Performance metrics
  scrapeDuration: {
    type: Number  // milliseconds
  },
  contentSize: {
    type: Number  // bytes before compression
  },
  
  // TTL index for automatic expiration
  expiresAt: { 
    type: Date,
    expires: 0,  // Automatically remove document when expiresAt is reached
    index: true
  }
}, { 
  timestamps: true,  // Adds createdAt and updatedAt fields
  // Don't include virtuals by default to reduce payload size
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

// Compound indexes for common query patterns
scrapedContentSchema.index({ domain: 1, status: 1 });
scrapedContentSchema.index({ companyId: 1, status: 1 });
scrapedContentSchema.index({ scrapeDate: -1, status: 1 });

// Virtual for combined content (not persisted to db)
scrapedContentSchema.virtual('allContent').get(function() {
  const sections = [];
  if (this.mainContent) sections.push(this.mainContent);
  if (this.aboutInfo) sections.push(this.aboutInfo);
  if (this.productInfo) sections.push(this.productInfo);
  if (this.teamInfo) sections.push(this.teamInfo);
  if (this.contactInfo) sections.push(this.contactInfo);
  return sections.join('\n\n');
});

// Instance methods for compression
scrapedContentSchema.methods.compressHtml = async function() {
  if (!this.rawHtml || this.isCompressed) return;
  
  // Convert Buffer to string if necessary
  const htmlString = Buffer.isBuffer(this.rawHtml) 
    ? this.rawHtml.toString() 
    : this.rawHtml;
  
  // Compress the HTML
  this.rawHtml = await gzip(htmlString);
  this.isCompressed = true;
  this.contentSize = htmlString.length;
  
  return this;
};

scrapedContentSchema.methods.decompressHtml = async function() {
  if (!this.rawHtml || !this.isCompressed) return this.rawHtml;
  
  const decompressed = await gunzip(this.rawHtml);
  return decompressed.toString();
};

// Static methods
scrapedContentSchema.statics.findByUrl = function(url) {
  return this.findOne({ url });
};

scrapedContentSchema.statics.findByDomain = function(domain, status = null) {
  const query = { domain };
  if (status) query.status = status;
  return this.find(query);
};

scrapedContentSchema.statics.findPendingContent = function(limit = 10) {
  return this.find({ 
    status: 'pending',
    processingAttempts: { $lt: 3 }  // Less than 3 attempts
  })
  .sort({ scrapeDate: 1 })  // Oldest first
  .limit(limit);
};

scrapedContentSchema.statics.markAsProcessing = async function(id) {
  return this.findByIdAndUpdate(id, {
    status: 'processing',
    $inc: { processingAttempts: 1 },
    lastProcessedAt: new Date()
  }, { new: true });
};

// Middleware (hooks)
scrapedContentSchema.pre('save', async function(next) {
  // Extract domain from URL if not set
  if (!this.domain && this.url) {
    try {
      this.domain = new URL(this.url).hostname;
    } catch (e) {
      // Invalid URL, leave domain empty
    }
  }
  
  // Set expiration date if not already set
  if (!this.expiresAt) {
    // Default TTL: 7 days
    this.expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
  }
  
  // Compress HTML if provided and not compressed
  if (this.rawHtml && !this.isCompressed) {
    await this.compressHtml();
  }
  
  next();
});

const ScrapedContent = mongoose.model('ScrapedContent', scrapedContentSchema);
export default ScrapedContent; 