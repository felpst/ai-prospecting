import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 */
export const connectToDatabase = async () => {
  try {
    const connectionString = process.env.MONGODB_URI;
    
    if (!connectionString) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    
    await mongoose.connect(connectionString, {
      // These options are no longer needed in mongoose 6+, but keeping for clarity
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    
    console.log('MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    
    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to application termination');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}; 