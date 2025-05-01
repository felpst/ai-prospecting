import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server.js';
import Company from '../models/company.js';

/**
 * Integration tests for Company API endpoints
 */
describe('Company API Endpoints', () => {
  beforeAll(async () => {
    // Create test data
    await Company.create({
      id: 'test123',
      name: 'Test Company',
      website: 'https://testcompany.com',
      industry: 'Software',
      founded: 2020,
      size: '11-50',
      locality: 'San Francisco',
      region: 'California',
      country: 'United States',
      linkedin_url: 'linkedin.com/company/test-company'
    });

    // Create a company with enrichment data
    await Company.create({
      id: 'enriched456',
      name: 'Enriched Company',
      industry: 'Technology',
      country: 'Canada',
      enrichment: 'This is an AI-generated summary of the company.',
      last_enriched: new Date()
    });
  });

  afterAll(async () => {
    // Clean up test data
    await Company.deleteMany({
      id: { $in: ['test123', 'enriched456'] }
    });
    
    // Close MongoDB connection
    await mongoose.connection.close();
  });

  describe('GET /api/companies/:id', () => {
    it('should return a company by ID', async () => {
      const res = await request(app)
        .get('/api/companies/test123')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.company).toBeDefined();
      expect(res.body.company.id).toBe('test123');
      expect(res.body.company.name).toBe('Test Company');
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.executionTime).toBeDefined();
    });

    it('should return enrichment data when available', async () => {
      const res = await request(app)
        .get('/api/companies/enriched456')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.company).toBeDefined();
      expect(res.body.company.id).toBe('enriched456');
      expect(res.body.company.enrichmentData).toBeDefined();
      expect(res.body.company.enrichmentData.summary).toBe('This is an AI-generated summary of the company.');
      expect(res.body.meta.enrichmentAvailable).toBe(true);
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(app)
        .get('/api/companies/nonexistent')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain('not found');
    });

    it('should return 400 for invalid company ID format', async () => {
      const res = await request(app)
        .get('/api/companies/inv@lid!id')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });
}); 