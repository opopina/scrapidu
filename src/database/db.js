const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/scrappy-doo';
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    logger.info('📦 Conexión a MongoDB establecida');
    
    // Manejar eventos de conexión
    mongoose.connection.on('error', err => {
      logger.error('Error de MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB desconectado');
    });

  } catch (error) {
    logger.error('Error conectando a MongoDB:', error);
    throw error;
  }
};

module.exports = { connectDB }; 