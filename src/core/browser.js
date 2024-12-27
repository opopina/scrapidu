const { chromium } = require('playwright');
const logger = require('../utils/logger');

class BrowserManager {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async createBrowser() {
    try {
      logger.info('Iniciando navegador...');
      return await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
          '--disable-features=BlockInsecurePrivateNetworkRequests'
        ]
      });
    } catch (error) {
      logger.error('Error creando navegador:', error);
      throw error;
    }
  }

  async createPage(browser) {
    try {
      logger.info('Creando nueva página...');
      const context = await browser.newContext({
        userAgent: this.userAgent,
        viewport: { width: 1366, height: 768 }
      });

      return await context.newPage();
    } catch (error) {
      logger.error('Error creando página:', error);
      throw error;
    }
  }
}

module.exports = BrowserManager; 