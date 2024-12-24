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
    const browser = await this.browserManager.createBrowser();
    const page = await this.browserManager.createPage(browser);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });

      // Detectar y resolver CAPTCHA si existe
      if (await this.detectCaptcha(page)) {
        await this.captchaSolver.solve(page);
      }

      const product = await this.extractProductData(page);
      await this.saveProduct(product);

      return product;
    } catch (error) {
      logger.error(`Error scraping ${url}: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async extractProductData(page) {
    return await page.evaluate(() => ({
      name: document.querySelector('h1')?.innerText,
      price: document.querySelector('.price')?.innerText,
      rating: document.querySelector('.rating')?.innerText,
      stock: document.querySelector('.stock')?.innerText,
      // Añadir más selectores según necesidad
    }));
  }

  async saveProduct(product) {
    await db.products.create(product);
  }

  async detectCaptcha(page) {
    return await page.evaluate(() => {
      return !!document.querySelector('.captcha-container');
    });
  }
}

module.exports = ProductScraper; 