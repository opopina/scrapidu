const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class UrlFinder {
  constructor() {
    this.visitedUrls = new Set();
    this.maxDepth = 3;
    this.maxUrls = 100;
    this.browser = null;
  }

  async findUrls(startUrl, options = {}) {
    const {
      depth = 2,
      maxUrls = 50,
      patterns = [],
      excludePatterns = []
    } = options;

    try {
      // Inicializar navegador
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1920,1080'
        ]
      });

      this.visitedUrls.clear();
      const urls = new Set();
      
      logger.info(`🔍 Iniciando búsqueda desde: ${startUrl}`);
      await this.crawl(startUrl, urls, depth, patterns, excludePatterns, maxUrls);
      
      return {
        startUrl,
        total: urls.size,
        urls: Array.from(urls),
        patterns,
        excludePatterns
      };

    } catch (error) {
      logger.error(`Error buscando URLs desde ${startUrl}:`, error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async crawl(url, urlSet, depth, patterns, excludePatterns, maxUrls) {
    if (depth <= 0 || urlSet.size >= maxUrls || this.visitedUrls.has(url)) {
      return;
    }

    try {
      this.visitedUrls.add(url);
      logger.info(`Explorando: ${url} (profundidad: ${depth})`);

      const page = await this.browser.newPage();
      
      // Configurar página
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');
      await page.setDefaultNavigationTimeout(30000);

      // Interceptar y bloquear recursos innecesarios
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Navegar a la URL
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      // Esperar a que los productos se carguen
      await page.waitForSelector('.ui-search-layout', { timeout: 15000 })
        .catch(() => logger.warn('No se encontró el selector .ui-search-layout'));

      // Hacer scroll
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= Math.min(10000, document.body.scrollHeight)) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Esperar un momento después del scroll
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extraer URLs
      const links = await page.evaluate(() => {
        const productLinks = new Set();
        
        // Múltiples selectores para mayor cobertura
        const selectors = [
          '.ui-search-layout__item a',
          '.ui-search-result__image > a',
          '.ui-search-result__content a',
          'a[href*="/MEC-"]'
        ];

        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(link => {
            if (link.href) productLinks.add(link.href);
          });
        });

        return Array.from(productLinks);
      });

      logger.info(`Enlaces encontrados en ${url}: ${links.length}`);

      // Filtrar y agregar URLs
      for (const link of links) {
        if (this.matchesPatterns(link, patterns, excludePatterns)) {
          if (urlSet.size < maxUrls) {
            urlSet.add(link);
            logger.info(`✅ URL de producto encontrada: ${link}`);
          }
        }
      }

      await page.close();

      // Crawl recursivo con delay
      for (const link of links) {
        if (urlSet.size < maxUrls) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.crawl(link, urlSet, depth - 1, patterns, excludePatterns, maxUrls);
        }
      }

    } catch (error) {
      logger.warn(`Error explorando ${url}: ${error.message}`);
    }
  }

  matchesPatterns(url, patterns, excludePatterns) {
    if (patterns.length === 0) return true;
    if (excludePatterns.some(pattern => url.includes(pattern))) return false;
    return patterns.some(pattern => url.includes(pattern));
  }
}

module.exports = new UrlFinder(); 