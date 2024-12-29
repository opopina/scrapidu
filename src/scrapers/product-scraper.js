const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const UrlResolver = require('../services/url-resolver');

class ProductScraper {
  constructor() {
    this.browser = null;
    this.pagePool = [];
    this.maxRetries = 1;
    this.navigationTimeout = 30000;
    this.waitForTimeout = 15000;
    this.maxConcurrent = 3;
  }

  async getPage() {
    try {
      // Inicializar navegador si no existe
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
          ]
        });
      }

      // Reusar página del pool si hay disponible
      const freePage = this.pagePool.find(p => !p.inUse);
      if (freePage) {
        freePage.inUse = true;
        return freePage.page;
      }

      // Crear nueva página si no excedemos el máximo
      if (this.pagePool.length < this.maxConcurrent) {
        const page = await this.browser.newPage();
        logger.info('Creando nueva página...');
        this.pagePool.push({ page, inUse: true });
        return page;
      }

      // Esperar máximo 3 segundos por una página libre
      const startTime = Date.now();
      while (Date.now() - startTime < 3000) {
        const availablePage = this.pagePool.find(p => !p.inUse);
        if (availablePage) {
          availablePage.inUse = true;
          return availablePage.page;
        }
        await new Promise(r => setTimeout(r, 100));
      }

      throw new Error('No hay páginas disponibles después de 3 segundos');
    } catch (error) {
      logger.error('Error creando página:', error);
      throw error;
    }
  }

  async releasePage(page) {
    try {
      const poolEntry = this.pagePool.find(p => p.page === page);
      if (poolEntry) {
        try {
          await page.goto('about:blank', { timeout: 2000 });
        } catch (error) {
          logger.warn('Error navegando a about:blank, ignorando:', error.message);
        }
        poolEntry.inUse = false;
      }
    } catch (error) {
      logger.error('Error liberando página:', error);
    }
  }

  async extractData(page, options) {
    try {
      // Extraer datos básicos
      const title = await page.title();
      const url = page.url();

      // Extraer metadatos
      const meta = await page.evaluate(() => {
        const description = document.querySelector('meta[name="description"]')?.content;
        const keywords = document.querySelector('meta[name="keywords"]')?.content;
        return { description, keywords };
      });

      // Extraer contenido principal
      const content = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => ({
            level: h.tagName.toLowerCase(),
            text: h.textContent.trim()
          }));

        const paragraphs = Array.from(document.querySelectorAll('p'))
          .map(p => p.textContent.trim())
          .filter(text => text.length > 50)
          .slice(0, 5);

        return { headings, paragraphs };
      });

      return {
        url,
        title,
        meta,
        content,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error extrayendo datos:', error);
      throw error;
    }
  }

  async scrape(url, options = {}) {
    let page;
    try {
      page = await this.getPage();
      
      // Configurar timeouts
      await page.setDefaultNavigationTimeout(this.navigationTimeout);
      await page.setDefaultTimeout(this.waitForTimeout);

      // Configurar evasión de detección
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // Ocultar webdriver
        Object.defineProperty(navigator, 'languages', {
          get: () => ['es-ES', 'es', 'en']
        });

        // Simular plataforma
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32'
        });

        // Simular plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {
                type: "application/x-google-chrome-pdf",
                suffixes: "pdf",
                description: "Portable Document Format",
                enabledPlugin: Plugin
              },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            }
          ]
        });
      });

      // Configurar headers
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      // Navegar a la URL
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: this.navigationTimeout
      });

      // Esperar por el selector especificado
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options.timeout || this.waitForTimeout
        });
      }

      // Si hay una función evaluate personalizada, usarla
      if (options.evaluate) {
        return await options.evaluate(page, options.selectors);
      }

      // Si no, usar el scraping básico
      const result = {};
      for (const [key, selector] of Object.entries(options.selectors)) {
        try {
          const element = await page.$(selector);
          if (element) {
            result[key] = await page.evaluate(el => el.textContent.trim(), element);
          }
        } catch (error) {
          logger.warn(`Error extrayendo ${key}: ${error.message}`);
          result[key] = null;
        }
      }

      return result;

    } catch (error) {
      logger.error(`Error scraping ${url}: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        await this.releasePage(page);
      }
    }
  }
}

module.exports = ProductScraper; 