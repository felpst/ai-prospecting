import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectToDatabase } from './utils/database.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { initializeData } from './utils/initData.js';

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
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
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
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`Health check available at: http://localhost:${PORT}/health`);
      console.log(`API available at: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 