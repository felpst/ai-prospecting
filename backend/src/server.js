import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectToDatabase } from './utils/database.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { initializeData } from './utils/initData.js';
import cacheService from './utils/cacheService.js';
import logger from './utils/logger.js';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Setup API routes
setupRoutes(app);

// Apply error handler
app.use(errorHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  // Include cache status in health check
  const cacheStatus = cacheService.getStats();
  
  res.status(200).json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    cache: {
      type: cacheStatus.type,
      hitRate: cacheStatus.hitRate,
      uptime: cacheStatus.uptime
    }
  });
});

// Cache stats endpoint
app.get('/api/cache/stats', (req, res) => {
  const stats = cacheService.getStats();
  res.json(stats);
});

// Clear cache endpoint (admin only)
app.post('/api/cache/clear', (req, res) => {
  // In production, this should be protected with authentication
  cacheService.clear()
    .then(() => {
      res.json({ success: true, message: 'Cache cleared successfully' });
    })
    .catch(error => {
      res.status(500).json({ success: false, error: error.message });
    });
});

// Start the server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Initialize data (for development)
    if (process.env.NODE_ENV !== 'production') {
      await initializeData();
    }
    
    // Start the Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`Health check available at: http://localhost:${PORT}/health`);
      logger.info(`API available at: http://localhost:${PORT}/api`);
      logger.info(`Cache system initialized: ${cacheService.useRedis ? 'Redis' : 'In-Memory'}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      gracefulShutdown(server);
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      gracefulShutdown(server);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown function
const gracefulShutdown = async (server) => {
  logger.info('Starting graceful shutdown...');
  
  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close cache connections
    await cacheService.close();
    logger.info('Cache connections closed');
    
    // Exit process
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

startServer(); 