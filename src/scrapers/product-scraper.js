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
      
      // Configurar timeouts más largos
      await page.setDefaultNavigationTimeout(this.navigationTimeout);
      await page.setDefaultTimeout(this.waitForTimeout);

      // Configurar evasión de detección
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
      });

      // Configurar headers más realistas
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      });

      // Navegar a la URL con mejor manejo de errores
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.navigationTimeout
        });
      } catch (error) {
        if (error.message.includes('timeout')) {
          throw new Error(`⏱ Timeout navegando a ${url} después de ${this.navigationTimeout}ms`);
        }
        throw error;
      }

      // Esperar a que la página cargue
      try {
        await page.waitForSelector('body', { 
          timeout: this.waitForTimeout,
          visible: true
        });
      } catch (error) {
        logger.warn(`⚠️ Timeout esperando body en ${url}, continuando...`);
      }

      // Extraer datos
      const result = await this.extractData(page, options);
      return result;

    } catch (error) {
      throw error;
    } finally {
      if (page) {
        await this.releasePage(page);
      }
    }
  }
}

module.exports = ProductScraper; 