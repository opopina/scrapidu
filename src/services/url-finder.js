const { chromium } = require('playwright');
const logger = require('../utils/logger');

class UrlFinder {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });
    }
  }

  async findUrls(startUrl, options = {}) {
    await this.initialize();
    const urls = new Set();
    
    try {
      const page = await this.context.newPage();
      
      // Interceptar y bloquear recursos innecesarios
      await page.route('**/*', route => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      logger.info(`🔍 Iniciando búsqueda desde: ${startUrl}`);
      
      // Navegar con timeout personalizado
      await page.goto(startUrl, { 
        waitUntil: 'networkidle',
        timeout: options.timeout || 30000
      });

      // Scroll suave
      await this.smoothScroll(page);

      // Buscar enlaces según el marketplace
      const links = await this.extractLinks(page, options);
      
      // Filtrar y validar URLs
      for (const link of links) {
        if (this.isValidUrl(link, options.patterns, options.excludePatterns)) {
          urls.add(link);
          logger.info(`✅ URL encontrada: ${link}`);
        }
      }

      await page.close();

    } catch (error) {
      logger.error(`Error en findUrls: ${error.message}`);
      throw error;
    }

    const validUrls = Array.from(urls).slice(0, options.maxUrls || 10);
    return { urls: validUrls, total: validUrls.length };
  }

  async smoothScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= 2000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    // Esperar a que se cargue contenido dinámico
    await page.waitForTimeout(2000);
  }

  async extractLinks(page, options) {
    const selectors = this.getSelectorsForMarketplace(options.marketplace);
    const links = new Set();

    for (const selector of selectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const href = await element.getAttribute('href');
          if (href) {
            const fullUrl = new URL(href, page.url()).href;
            links.add(fullUrl);
          }
        }
      } catch (error) {
        logger.warn(`Error extrayendo links con selector ${selector}: ${error.message}`);
      }
    }

    return Array.from(links);
  }

  getSelectorsForMarketplace(marketplace) {
    switch (marketplace) {
      case 'mercadolibre':
        return [
          '.ui-search-item__group__element a',
          '.shops__items-group a',
          '.ui-search-result__image a',
          '.ui-search-result__content a',
          'a[href*="/MEC-"]'
        ];
      case 'ebay':
        return ['.s-item__link', 'a[href*="/itm/"]'];
      case 'amazon':
        return [
          'a[href*="/dp/"]',
          'a[href*="/gp/product/"]',
          'a[href*="/gp/aw/d/"]',
          '.s-result-item a'
        ];
      default:
        return ['a[href]'];
    }
  }

  isValidUrl(url, patterns = [], excludePatterns = []) {
    if (patterns.length === 0) return true;
    if (excludePatterns.some(pattern => url.includes(pattern))) return false;
    return patterns.some(pattern => url.includes(pattern));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
  }
}

module.exports = new UrlFinder(); 