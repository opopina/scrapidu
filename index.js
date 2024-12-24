require('dotenv').config();
const ScrapingQueue = require('./src/core/queue');
const ProductScraper = require('./src/scrapers/product-scraper');
const logger = require('./src/utils/logger');

async function main() {
  const queue = new ScrapingQueue();
  const scraper = new ProductScraper();

  // Configurar el procesamiento de la cola
  await queue.processQueue(scraper);

  // Añadir URLs para scrapear
  const urls = [
    'https://ejemplo.com/producto1',
    'https://ejemplo.com/producto2'
    // Añadir más URLs
  ];

  for (const url of urls) {
    await queue.addUrl(url);
  }
}

main().catch(error => {
  logger.error('Error en la aplicación principal:', error);
  process.exit(1);
}); 