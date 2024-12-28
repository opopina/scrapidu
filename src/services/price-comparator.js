const UrlFinder = require('./url-finder');
const ProductScraper = require('../scrapers/product-scraper');
const logger = require('../utils/logger');

class PriceComparator {
  constructor() {
    this.scraper = new ProductScraper();
    this.platforms = [
      {
        name: 'Mercado Libre',
        baseUrl: 'https://www.mercadolibre.com.ec',
        searchUrl: 'https://listado.mercadolibre.com.ec'
      },
      // Agregar más plataformas aquí
    ];
  }

  async compareProduct(productName) {
    const results = [];
    
    for (const platform of this.platforms) {
      try {
        const urls = await UrlFinder.findUrls(
          `${platform.searchUrl}/${encodeURIComponent(productName)}`,
          {
            depth: 1,
            maxUrls: 5,
            patterns: ['/p/', productName.toLowerCase()],
            excludePatterns: ['usado', 'reacondicionado']
          }
        );

        for (const url of urls.urls) {
          const productData = await this.scraper.scrape(url, {
            selectors: {
              title: 'h1.ui-pdp-title',
              price: '.andes-money-amount__fraction',
              seller: '.ui-pdp-seller__header__title',
              condition: '.ui-pdp-header__subtitle',
              stock: '.ui-pdp-stock-information'
            }
          });

          results.push({
            platform: platform.name,
            url,
            ...productData
          });
        }
      } catch (error) {
        logger.error(`Error comparando precios en ${platform.name}:`, error);
      }
    }

    return this.analyzeResults(results);
  }

  analyzeResults(results) {
    const analysis = {
      totalResults: results.length,
      averagePrice: 0,
      lowestPrice: null,
      highestPrice: null,
      priceRange: 0,
      recommendations: []
    };

    // Calcular estadísticas
    const prices = results.map(r => this.extractPrice(r.price)).filter(p => !isNaN(p));
    
    if (prices.length > 0) {
      analysis.averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      analysis.lowestPrice = Math.min(...prices);
      analysis.highestPrice = Math.max(...prices);
      analysis.priceRange = analysis.highestPrice - analysis.lowestPrice;
    }

    // Generar recomendaciones
    if (analysis.lowestPrice) {
      const bestDeal = results.find(r => this.extractPrice(r.price) === analysis.lowestPrice);
      analysis.recommendations.push({
        type: 'BEST_DEAL',
        message: `Mejor precio encontrado en ${bestDeal.platform}: ${bestDeal.price}`,
        url: bestDeal.url
      });
    }

    return analysis;
  }

  extractPrice(priceStr) {
    return parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  }
}

module.exports = new PriceComparator(); 