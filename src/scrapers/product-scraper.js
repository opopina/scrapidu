const BrowserManager = require('../core/browser');
const CaptchaSolver = require('../utils/captcha-solver');
const db = require('../database/db');
const logger = require('../utils/logger');

class ProductScraper {
  constructor() {
    this.browserManager = new BrowserManager();
    this.captchaSolver = new CaptchaSolver();
  }

  async scrape(url, options = {}) {
    let browser;
    try {
      logger.info(`Iniciando scraping de ${url}`);
      browser = await this.browserManager.createBrowser();
      const page = await this.browserManager.createPage(browser);

      logger.info(`Navegando a ${url}`);
      
      // Intentar cargar la página con diferentes estrategias
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(url, { 
            waitUntil: attempt === 1 ? 'domcontentloaded' : 'networkidle',
            timeout: 30000 * attempt // Incrementar timeout en cada intento
          });
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          logger.warn(`Intento ${attempt} fallido, reintentando...`);
          await page.waitForTimeout(2000 * attempt);
        }
      }

      // Esperar a que la red esté inactiva
      await page.waitForLoadState('networkidle', { timeout: 10000 })
        .catch(() => logger.warn('Network no llegó a estar inactivo'));

      // Esperar a que el contenido principal esté disponible
      const mainSelector = options.selectors?.title || 'h1';
      await Promise.race([
        page.waitForSelector(mainSelector, { timeout: 15000 }),
        page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 })
      ]);

      // Simular comportamiento humano
      await this.simulateHumanBehavior(page);

      // Hacer scroll para cargar contenido dinámico
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });

      logger.info('Extrayendo datos...');
      const product = await this.extractProductData(page, options.selectors);
      
      if (!product.title && !product.rating && !product.description) {
        throw new Error('No se pudo extraer ningún dato de la página');
      }

      if (options.saveToDb) {
        logger.info('Guardando producto en base de datos...');
        await this.saveProduct(product);
      }

      logger.info('Scraping completado exitosamente:', product);
      return product;
    } catch (error) {
      logger.error(`Error scraping ${url}: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        logger.info('Navegador cerrado');
      }
    }
  }

  async extractProductData(page, selectors = {}) {
    try {
      const defaultSelectors = {
        title: 'h1',
        rating: '[data-testid="hero-rating-bar__aggregate-rating__score"]',
        description: '[data-testid="plot-xl"]'
      };

      const finalSelectors = { ...defaultSelectors, ...selectors };

      // Esperar a que al menos uno de los selectores esté presente
      await Promise.race([
        page.waitForSelector(finalSelectors.title),
        page.waitForSelector(finalSelectors.rating),
        page.waitForSelector(finalSelectors.description)
      ]);

      return await page.evaluate((sel) => {
        const getData = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.innerText.trim() : null;
        };

        return {
          title: getData(sel.title),
          rating: getData(sel.rating),
          description: getData(sel.description),
          url: window.location.href,
          timestamp: new Date().toISOString()
        };
      }, finalSelectors);
    } catch (error) {
      logger.error('Error extrayendo datos:', error);
      throw error;
    }
  }

  async saveProduct(product) {
    await db.products.create(product);
  }

  async updatePrice(productId, newPrice) {
    await db.products.findByIdAndUpdate(productId, {
      price: newPrice,
      updatedAt: new Date()
    });
  }

  async detectCaptcha(page) {
    return await page.evaluate(() => {
      return !!document.querySelector('.captcha-container');
    });
  }

  async simulateHumanBehavior(page) {
    // Scroll aleatorio
    await page.evaluate(() => {
      window.scrollTo(0, Math.random() * document.body.scrollHeight);
    });
    await page.waitForTimeout(1000 + Math.random() * 2000);
  }
}

module.exports = ProductScraper; 