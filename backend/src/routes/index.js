import { Router } from 'express';
import { ApiError } from '../utils/errorHandler.js';
import companiesRoutes from './companies.js';
import savedRoutes from './saved.js';
import dataRoutes from './data.js';
import searchRoutes from './search.routes.js';
import adminRoutes from './admin.routes.js';

/**
 * Setup all API routes
 * @param {Express} app - Express application
 */
export const setupRoutes = (app) => {
  const apiRouter = Router();
  
  // Mount API routes
  apiRouter.use('/companies', companiesRoutes);
  apiRouter.use('/saved', savedRoutes);
  apiRouter.use('/data', dataRoutes);
  apiRouter.use('/search', searchRoutes);
  apiRouter.use('/admin', adminRoutes);
  
  // Root API endpoint
  apiRouter.get('/', (req, res) => {
    res.json({
      message: 'AI-Prospecting API',
      version: '0.1.0'
    });
  });
  
  // Mount the API router on /api path
  app.use('/api', apiRouter);
  
  // Handle 404 errors for API routes
  app.use('/api/*', (req, res, next) => {
    next(new ApiError(`Route not found: ${req.originalUrl}`, 404));
  });
  
  // Handle 404 for all other routes
  app.use('*', (req, res) => {
    res.status(404).json({ error: { message: 'Resource not found' } });
  });
  
  // Root route redirect to API
  app.get('/', (req, res) => {
    res.redirect('/api');
  });
}; 