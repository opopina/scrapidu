const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectWithRetry = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('Conectado a MongoDB exitosamente');
      break;
    } catch (err) {
      retries++;
      logger.error(`Error conectando a MongoDB (intento ${retries}/${maxRetries}):`, err.message);
      
      if (retries === maxRetries) {
        logger.error('Máximo número de intentos alcanzado. No se pudo conectar a MongoDB');
        throw err;
      }
      
      // Esperar 5 segundos antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

connectWithRetry();

const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  rating: String,
  stock: String,
  url: String,
  scrapedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

module.exports = {
  products: Product,
  connectWithRetry // Exportamos la función por si necesitamos reconectar
}; 