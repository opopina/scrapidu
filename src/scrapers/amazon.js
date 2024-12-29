const logger = require('../utils/logger');
const { sleep, formatPrice } = require('../utils/helpers');

class AmazonScraper {
  constructor() {
    this.baseUrl = 'https://www.amazon.com';
    this.maxRetries = 3;
    this.defaultTimeout = 30000;
  }

  async searchProducts(page, searchTerm) {
    try {
      logger.info(`Buscando productos en Amazon para: ${searchTerm}`);
      
      const searchUrl = `${this.baseUrl}/s?k=${encodeURIComponent(searchTerm)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: this.defaultTimeout });
      
      // Esperar a que la página cargue completamente
      await this.handleInitialLoad(page);

      // Extraer productos
      return await this.extractProducts(page);
    } catch (error) {
      logger.error(`Error en búsqueda de Amazon: ${error.message}`);
      return [];
    }
  }

  async handleInitialLoad(page) {
    try {
      // Esperar por el contenedor principal de resultados
      await page.waitForSelector('[data-component-type="s-search-results"]', { timeout: this.defaultTimeout });
      
      // Scroll suave para cargar contenido lazy
      await this.performSmartScroll(page);
      
      // Esperar un momento para que se cargue todo el contenido dinámico
      await sleep(2000);
    } catch (error) {
      logger.error(`Error en carga inicial de Amazon: ${error.message}`);
      throw error;
    }
  }

  async performSmartScroll(page) {
    try {
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.documentElement.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    } catch (error) {
      logger.error(`Error en scroll: ${error.message}`);
    }
  }

  async extractProducts(page) {
    try {
      return await page.$$eval('[data-component-type="s-search-result"]', (results) => {
        return results.slice(0, 10).map(result => {
          try {
            const titleElement = result.querySelector('h2 a.a-link-normal');
            const priceElement = result.querySelector('.a-price .a-offscreen');
            const ratingElement = result.querySelector('.a-icon-star-small');
            const imageElement = result.querySelector('img.s-image');
            const linkElement = result.querySelector('h2 a.a-link-normal');

            const title = titleElement ? titleElement.textContent.trim() : '';
            const price = priceElement ? priceElement.textContent.trim() : '';
            const rating = ratingElement ? ratingElement.textContent.trim() : '';
            const image = imageElement ? imageElement.src : '';
            const link = linkElement ? linkElement.href : '';

            return {
              title,
              price,
              rating,
              image,
              link,
              source: 'Amazon'
            };
          } catch (error) {
            console.error('Error extrayendo producto:', error);
            return null;
          }
        }).filter(product => product !== null);
      });
    } catch (error) {
      logger.error(`Error extrayendo productos de Amazon: ${error.message}`);
      return [];
    }
  }
}

module.exports = AmazonScraper; 