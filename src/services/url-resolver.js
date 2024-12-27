const dns = require('dns').promises;
const logger = require('../utils/logger');

class UrlResolver {
  constructor() {
    this.commonTlds = ['.com', '.com.ec', '.ec', '.net'];
    this.maxAttempts = 3;
    this.timeout = 120000; // 2 minutos timeout total
  }

  async resolveUrl(url) {
    const startTime = Date.now();
    const attempts = [];
    const results = {
      originalUrl: url,
      attemptedUrls: [],
      timeElapsed: 0,
      success: false,
      error: null
    };

    try {
      // 1. Intentar URL original
      const originalUrl = this.normalizeUrl(url);
      results.attemptedUrls.push(originalUrl);
      
      if (await this.isUrlValid(originalUrl)) {
        results.success = true;
        results.resolvedUrl = originalUrl;
        return results;
      }

      // 2. Intentar variaciones
      const variations = this.generateUrlVariations(url);
      
      for (const variant of variations) {
        results.timeElapsed = Date.now() - startTime;
        
        if (results.timeElapsed > this.timeout) {
          results.error = {
            type: 'TIMEOUT',
            message: 'Tiempo máximo excedido',
            attemptedUrls: results.attemptedUrls,
            timeElapsed: results.timeElapsed
          };
          logger.warn('Timeout alcanzado', results);
          return results;
        }

        results.attemptedUrls.push(variant);
        if (await this.isUrlValid(variant)) {
          results.success = true;
          results.resolvedUrl = variant;
          return results;
        }
      }

      results.error = {
        type: 'NO_VALID_URL',
        message: 'No se encontró URL válida',
        attemptedUrls: results.attemptedUrls,
        timeElapsed: results.timeElapsed
      };
      return results;

    } catch (error) {
      results.error = {
        type: 'UNEXPECTED_ERROR',
        message: error.message,
        attemptedUrls: results.attemptedUrls,
        timeElapsed: Date.now() - startTime
      };
      return results;
    }
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.href;
    } catch {
      // Si no es una URL válida, intentar agregarle https://
      return this.normalizeUrl(`https://${url}`);
    }
  }

  generateUrlVariations(url) {
    try {
      const urlObj = new URL(this.normalizeUrl(url));
      const domain = urlObj.hostname;
      const variations = new Set();

      // Quitar/agregar www.
      if (domain.startsWith('www.')) {
        variations.add(`https://${domain.slice(4)}`);
      } else {
        variations.add(`https://www.${domain}`);
      }

      // Probar diferentes TLDs
      const baseDomain = domain.split('.')[0];
      this.commonTlds.forEach(tld => {
        variations.add(`https://${baseDomain}${tld}`);
        variations.add(`https://www.${baseDomain}${tld}`);
      });

      return Array.from(variations);
    } catch (error) {
      logger.error(`Error generando variaciones para ${url}:`, error);
      return [];
    }
  }

  async isUrlValid(url) {
    try {
      const urlObj = new URL(url);
      await dns.lookup(urlObj.hostname);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new UrlResolver(); 