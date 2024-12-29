const logger = require('../utils/logger');
const BrowserManager = require('./browser');
const MercadoLibreScraper = require('../scrapers/mercadolibre');
const AmazonScraper = require('../scrapers/amazon');
const { sleep } = require('../utils/helpers');

class Scraper {
  constructor() {
    this.browserManager = new BrowserManager();
    this.mercadolibreScraper = new MercadoLibreScraper();
    this.amazonScraper = new AmazonScraper();
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async initialize() {
    try {
      this.browser = await this.browserManager.createBrowser();
      logger.info('Navegador inicializado correctamente');
    } catch (error) {
      logger.error('Error inicializando el navegador:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      logger.info('Navegador cerrado correctamente');
    }
  }

  async scrapeWithRetry(scraper, page, searchTerm) {
    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        const results = await scraper.searchProducts(page, searchTerm);
        if (results && results.length > 0) {
          return results;
        }
        logger.warn(`Intento ${retries + 1} no produjo resultados, reintentando...`);
      } catch (error) {
        logger.error(`Error en intento ${retries + 1}:`, error);
      }
      retries++;
      if (retries < this.maxRetries) {
        logger.info(`Esperando ${this.retryDelay/1000} segundos antes de reintentar...`);
        await sleep(this.retryDelay);
        await page.reload({ waitUntil: 'networkidle' });
      }
    }
    return [];
  }

  async scrape(searchTerm) {
    if (!this.browser) {
      await this.initialize();
    }

    const results = {
      mercadolibre: [],
      amazon: []
    };

    try {
      // Scraping MercadoLibre
      const mlPage = await this.browserManager.createPage(this.browser);
      logger.info('Iniciando scraping de MercadoLibre...');
      results.mercadolibre = await this.scrapeWithRetry(this.mercadolibreScraper, mlPage, searchTerm);
      await mlPage.close();

      // Esperar un momento entre scraping de diferentes sitios
      await sleep(2000);

      // Scraping Amazon
      const amazonPage = await this.browserManager.createPage(this.browser);
      logger.info('Iniciando scraping de Amazon...');
      results.amazon = await this.scrapeWithRetry(this.amazonScraper, amazonPage, searchTerm);
      await amazonPage.close();

    } catch (error) {
      logger.error('Error durante el scraping:', error);
    }

    return results;
  }
}

module.exports = Scraper; 