const logger = require('../utils/logger');
const UrlFinder = require('./url-finder');

class MultiMarketplaceFinder {
  constructor() {
    this.marketplaces = {
      mercadolibre: {
        baseUrl: 'https://listado.mercadolibre.com.ec',
        searchPath: '/',
        timeout: 30000
      },
      ebay: {
        baseUrl: 'https://www.ebay.com',
        searchPath: '/sch/i.html',
        queryParam: '_nkw',
        timeout: 30000
      },
      amazon: {
        baseUrl: 'https://www.amazon.com',
        searchPath: '/s',
        queryParam: 'k',
        timeout: 30000
      }
    };
  }

  async findProducts(searchTerm, options = {}) {
    const results = [];
    const errors = [];

    for (const [marketplace, config] of Object.entries(this.marketplaces)) {
      try {
        logger.info(`🔍 Buscando en ${marketplace}...`);
        
        // Construir URL de búsqueda
        const searchUrl = this.buildSearchUrl(config, searchTerm);
        logger.info(`📍 URL: ${searchUrl}`);

        // Configurar opciones específicas por marketplace
        const searchOptions = {
          timeout: config.timeout,
          maxUrls: options.maxResults || 5,
          patterns: this.getPatterns(marketplace),
          excludePatterns: options.excludePatterns || ['usado', 'reparar'],
          retries: 2
        };

        // Realizar búsqueda con reintentos
        const searchResult = await this.searchWithRetry(
          marketplace,
          searchUrl,
          searchOptions
        );

        if (searchResult.products && searchResult.products.length > 0) {
          results.push({
            marketplace,
            products: searchResult.products
          });
        }

      } catch (error) {
        logger.error(`❌ Error en ${marketplace}: ${error.message}`);
        errors.push({ marketplace, error: error.message });
      }
    }

    // Registrar estadísticas
    logger.info(`\n📊 Resumen de búsqueda:
      - Marketplaces exitosos: ${results.length}
      - Marketplaces con error: ${errors.length}
      - Total productos encontrados: ${results.reduce((sum, r) => sum + r.products.length, 0)}`);

    return results;
  }

  buildSearchUrl(config, searchTerm) {
    const encodedTerm = encodeURIComponent(searchTerm);
    if (config.queryParam) {
      return `${config.baseUrl}${config.searchPath}?${config.queryParam}=${encodedTerm}`;
    }
    return `${config.baseUrl}${config.searchPath}${encodedTerm}`;
  }

  getPatterns(marketplace) {
    switch (marketplace) {
      case 'mercadolibre':
        return ['/p/', '-MEC-', '/MEC-', 'click1'];
      case 'ebay':
        return ['/itm/', 'hash=item'];
      case 'amazon':
        return ['/dp/', '/gp/product/', '/gp/aw/d/'];
      default:
        return [];
    }
  }

  async searchWithRetry(marketplace, url, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= options.retries; attempt++) {
      try {
        const result = await UrlFinder.findUrls(url, {
          ...options,
          marketplace // Pasar el marketplace para configuración específica
        });

        // Procesar y validar resultados
        const products = await this.processResults(result.urls, marketplace);
        
        if (products.length > 0) {
          logger.info(`🔍 Encontrados ${products.length} productos en ${marketplace}`);
          return { products };
        }

        throw new Error('No se encontraron productos válidos');

      } catch (error) {
        lastError = error;
        logger.warn(`Intento ${attempt}/${options.retries} fallido en ${marketplace}: ${error.message}`);
        
        if (attempt < options.retries) {
          // Esperar antes de reintentar (tiempo exponencial)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  async processResults(urls, marketplace) {
    const products = [];
    
    for (const url of urls) {
      try {
        // Aquí normalmente harías scraping del producto
        // Por ahora solo simulamos datos básicos
        const product = {
          title: `Producto de ${marketplace}`,
          price: `US$ ${(Math.random() * 1000 + 500).toFixed(2)}`,
          link: url
        };

        products.push(product);
        logger.info(`✅ Producto encontrado: ${product.title} - ${product.price}`);
      } catch (error) {
        logger.warn(`Error procesando producto ${url}: ${error.message}`);
      }
    }

    return products;
  }
}

module.exports = new MultiMarketplaceFinder(); 