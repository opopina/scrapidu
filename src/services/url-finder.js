const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class UrlFinder {
  constructor() {
    this.marketplaces = {
      mercadolibre: {
        baseUrl: 'https://listado.mercadolibre.com.ec',
        searchPath: '/'
      },
      ebay: {
        baseUrl: 'https://www.ebay.com',
        searchPath: '/sch/i.html',
        queryParam: '_nkw'
      }
      // Amazon removido para evitar duplicación
    };
  }

  async findUrls(startUrl, options = {}) {
    // Si la URL es de Amazon, saltamos el proceso
    if (startUrl.includes('amazon.com')) {
      return { urls: [] };
    }
    
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const urls = new Set();
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');
      
      logger.info(`🔍 Iniciando búsqueda desde: ${startUrl}`);
      
      await page.goto(startUrl, { 
        waitUntil: 'networkidle0',
        timeout: options.timeout || 30000
      });

      // Esperar y hacer scroll
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.evaluate(() => window.scrollBy(0, 500));
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Buscar enlaces de productos
      const links = await page.$$eval('a[href*="/dp/"]', elements => 
        elements.map(el => el.href)
      );

      links.forEach(link => {
        if (this.isValidUrl(link, options.patterns, options.excludePatterns)) {
          urls.add(link);
          logger.info(`✅ URL encontrada: ${link}`);
        }
      });

    } catch (error) {
      logger.error(`Error en findUrls: ${error.message}`);
    } finally {
      await browser.close();
    }

    return {
      urls: Array.from(urls).slice(0, options.maxUrls || 10)
    };
  }

  isValidUrl(url, patterns, excludePatterns) {
    if (patterns.length === 0) return true;
    if (excludePatterns.some(pattern => url.includes(pattern))) return false;
    return patterns.some(pattern => url.includes(pattern));
  }
}

module.exports = new UrlFinder(); 