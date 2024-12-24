require('dotenv').config();
const ScrapingQueue = require('./src/core/queue');
const ScrapingAPI = require('./src/api/server');
const ProductScraper = require('./src/scrapers/product-scraper');
const logger = require('./src/utils/logger');

let queue;
let api;

async function main() {
  try {
    // Iniciar la cola de scraping
    queue = new ScrapingQueue();
    await queue.init();

    // Iniciar el procesamiento de la cola
    const scraper = new ProductScraper();
    await queue.processQueue(scraper);
    logger.info('Procesamiento de cola iniciado');

    // Iniciar la API
    api = new ScrapingAPI(queue);
    api.start(process.env.API_PORT || 3030);

    logger.info('ScrappyDoo iniciado correctamente');
  } catch (error) {
    logger.error('Error iniciando ScrappyDoo:', error);
    process.exit(1);
  }
}

// Manejo de cierre gracioso
process.on('SIGTERM', async () => {
  logger.info('Recibida señal SIGTERM, cerrando aplicación...');
  await cleanup();
});

process.on('SIGINT', async () => {
  logger.info('Recibida señal SIGINT, cerrando aplicación...');
  await cleanup();
});

async function cleanup() {
  try {
    if (queue) {
      await queue.close();
    }
    if (api) {
      await api.stop();
    }
    process.exit(0);
  } catch (error) {
    logger.error('Error durante el cierre:', error);
    process.exit(1);
  }
}

main(); 