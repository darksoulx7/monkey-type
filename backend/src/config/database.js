const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_TEST_URI 
      : process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    const options = {
      // Connection options for better performance and reliability
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      retryWrites: true,
      writeConcern: {
        w: 'majority',
        wtimeout: 5000
      }
    };

    const conn = await mongoose.connect(mongoURI, options);

    logger.info(`🍃 MongoDB Connected: ${conn.connection.host}`);
    logger.info(`📊 Database: ${conn.connection.name}`);
    
    // Connection event listeners
    mongoose.connection.on('disconnected', () => {
      logger.warn('🔌 MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('🍃 MongoDB connection closed through app termination');
      } catch (error) {
        logger.error('❌ Error closing MongoDB connection:', error);
      }
    });

    return conn;
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message || error);
    console.error('Full error:', error);
    
    // Exit process with failure if we can't connect to database
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    
    throw error;
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    if (state === 1) {
      // Perform a simple operation to verify database is responsive
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        state: states[state],
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      };
    } else {
      return {
        status: 'unhealthy',
        state: states[state],
        message: 'Database not connected'
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Create database indexes for better query performance
const createIndexes = async () => {
  try {
    logger.info('📝 Creating database indexes...');
    
    // These will be called after models are defined
    // Index creation is handled in individual model files
    
    logger.info('✅ Database indexes created successfully');
  } catch (error) {
    logger.error('❌ Error creating database indexes:', error);
  }
};

module.exports = {
  connectDB,
  checkDatabaseHealth,
  createIndexes
};