const { chromium } = require('playwright');
const logger = require('../utils/logger');

class BrowserManager {
  async createBrowser() {
    try {
      logger.info('Iniciando navegador...');
      return await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
        ignoreHTTPSErrors: true,
        timeout: 60000,
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
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        geolocation: { latitude: 40.7128, longitude: -74.0060 }, // NYC coordinates
        bypassCSP: true,
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1',
          'Sec-Fetch-Dest': 'document',
        },
        proxy: {
          server: process.env.PROXY_SERVER,
          username: process.env.PROXY_USER,
          password: process.env.PROXY_PASS
        },
        // Rotación de User Agents
        userAgent: this.getRandomUserAgent(),
        // Evadir detección de automation
        bypassCSP: true,
        javaScriptEnabled: true,
        hasTouch: true,
        isMobile: Math.random() > 0.5,
        deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
      });

      // Evadir fingerprinting
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });

      const page = await context.newPage();
      
      // Interceptar y modificar requests
      await page.route('**/*', async route => {
        const request = route.request();
        if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet' || request.resourceType() === 'font') {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      return page;
    } catch (error) {
      logger.error('Error creando página:', error);
      throw error;
    }
  }
}

module.exports = BrowserManager; 