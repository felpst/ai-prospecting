/**
 * Database Configuration
 * 
 * Handles MongoDB connections and provides a connection pool.
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

// Load .env from project root
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '..', '..', '..', '.env') });
} catch (error) {
  console.error('Error loading .env file:', error);
}

// MongoDB connection string
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/challenge';

// Connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Create a MongoDB client
const client = new MongoClient(MONGO_URI, options);

// Database connection state
let dbConnection = null;
let isConnected = false;

/**
 * Connect to MongoDB and return a database connection.
 * @returns {Promise<import('mongodb').Db>} A database connection.
 */
export const getDatabaseConnection = async () => {
  if (dbConnection && isConnected) {
    return dbConnection;
  }

  try {
    if (!isConnected) {
      logger.info('Connecting to MongoDB...');
      await client.connect();
      isConnected = true;
      logger.info('Connected to MongoDB');
    }

    // Extract database name from connection string
    const dbName = MONGO_URI.split('/').pop().split('?')[0];
    dbConnection = client.db(dbName);

    return dbConnection;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    isConnected = false;
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

/**
 * Close the MongoDB connection.
 * @returns {Promise<void>}
 */
export const closeConnection = async () => {
  if (isConnected) {
    try {
      await client.close();
      dbConnection = null;
      isConnected = false;
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error(`Error closing MongoDB connection: ${error.message}`);
    }
  }
};

// Handle process termination
process.on('SIGINT', () => {
  closeConnection().then(() => {
    logger.info('MongoDB connection closed due to application termination');
    process.exit(0);
  });
});

export default {
  getDatabaseConnection,
  closeConnection
}; 