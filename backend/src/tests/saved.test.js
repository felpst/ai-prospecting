/**
 * Tests for Saved Companies API Endpoints
 * 
 * Tests the functionality of endpoints for managing saved companies.
 */

import { expect } from 'chai';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../routes/index.js';
import User from '../models/user.js';
import Company from '../models/company.js';

describe('Saved Companies API', () => {
  let app;
  let testUser;
  let testCompanies = [];
  
  // Setup test app and database connection
  before(async () => {
    // Connect to test database if not already connected
    if (mongoose.connection.readyState === 0) {
      const testDbUrl = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ai-prospecting-test';
      await mongoose.connect(testDbUrl);
    }
    
    // Setup Express app
    app = express();
    app.use(express.json());
    setupRoutes(app);
    
    // Create test user
    await User.deleteMany({ email: 'demo@example.com' });
    testUser = new User({
      email: 'demo@example.com',
      saved_companies: []
    });
    await testUser.save();
    
    // Create test companies
    await Company.deleteMany({ id: { $in: ['test-company-1', 'test-company-2', 'test-company-3'] } });
    
    for (let i = 1; i <= 3; i++) {
      const company = new Company({
        id: `test-company-${i}`,
        name: `Test Company ${i}`,
        industry: 'Software',
        description: `Description for Test Company ${i}`
      });
      await company.save();
      testCompanies.push(company);
    }
  });
  
  // Clean up after tests
  after(async () => {
    // Remove test data
    await User.deleteMany({ email: 'demo@example.com' });
    await Company.deleteMany({ id: { $in: ['test-company-1', 'test-company-2', 'test-company-3'] } });
  });
  
  describe('GET /api/saved', () => {
    it('should return empty array when no companies are saved', async () => {
      const response = await request(app).get('/api/saved');
      
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.equal(0);
    });
    
    it('should return saved companies when companies are saved', async () => {
      // Save a company first
      const user = await User.findOne({ email: 'demo@example.com' });
      user.saved_companies = ['test-company-1', 'test-company-2'];
      await user.save();
      
      const response = await request(app).get('/api/saved');
      
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.equal(2);
      expect(response.body[0].id).to.equal('test-company-1');
      expect(response.body[1].id).to.equal('test-company-2');
      
      // Reset for next tests
      user.saved_companies = [];
      await user.save();
    });
  });
  
  describe('POST /api/saved/:companyId', () => {
    it('should save a company successfully', async () => {
      const response = await request(app).post('/api/saved/test-company-1');
      
      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Company saved successfully');
      expect(response.body.companyId).to.equal('test-company-1');
      
      // Verify company was saved in database
      const updatedUser = await User.findOne({ email: 'demo@example.com' });
      expect(updatedUser.saved_companies).to.include('test-company-1');
    });
    
    it('should not duplicate saved companies', async () => {
      // Save the same company again
      const response = await request(app).post('/api/saved/test-company-1');
      
      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Company saved successfully');
      
      // Verify no duplication in database
      const updatedUser = await User.findOne({ email: 'demo@example.com' });
      const occurrences = updatedUser.saved_companies.filter(id => id === 'test-company-1').length;
      expect(occurrences).to.equal(1);
      
      // Clean up for next tests
      updatedUser.saved_companies = [];
      await updatedUser.save();
    });
    
    it('should return 404 for non-existent company', async () => {
      const response = await request(app).post('/api/saved/non-existent-company');
      
      expect(response.status).to.equal(404);
      // Let's check that it's a JSON response with an error message
      // but be flexible about the exact structure
      expect(response.body).to.be.an('object');
      expect(response.text).to.include('not found');
    });
  });
  
  describe('DELETE /api/saved/:companyId', () => {
    beforeEach(async () => {
      // Ensure company is saved first - use findOneAndUpdate to avoid versioning issues
      await User.findOneAndUpdate(
        { email: 'demo@example.com' },
        { saved_companies: ['test-company-1', 'test-company-2'] }
      );
    });
    
    it('should remove a company from saved list', async () => {
      const response = await request(app).delete('/api/saved/test-company-1');
      
      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Company removed from saved list');
      expect(response.body.companyId).to.equal('test-company-1');
      
      // Verify company was removed in database
      const updatedUser = await User.findOne({ email: 'demo@example.com' });
      expect(updatedUser.saved_companies).to.not.include('test-company-1');
      expect(updatedUser.saved_companies).to.include('test-company-2');
    });
    
    it('should not error when removing a company that is not in saved list', async () => {
      const response = await request(app).delete('/api/saved/test-company-3');
      
      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Company removed from saved list');
    });
  });
  
  describe('GET /api/saved/:companyId/check', () => {
    beforeEach(async () => {
      // Set up a user with a saved company
      await User.findOneAndUpdate(
        { email: 'demo@example.com' },
        { saved_companies: ['test-company-1'] }
      );
    });
    
    it('should return true for a saved company', async () => {
      const response = await request(app).get('/api/saved/test-company-1/check');
      
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body.isSaved).to.be.true;
      expect(response.body.companyId).to.equal('test-company-1');
    });
    
    it('should return false for a non-saved company', async () => {
      const response = await request(app).get('/api/saved/test-company-2/check');
      
      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body.isSaved).to.be.false;
      expect(response.body.companyId).to.equal('test-company-2');
    });
  });
}); 