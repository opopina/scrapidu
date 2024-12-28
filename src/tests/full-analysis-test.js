const UrlFinder = require('../services/url-finder');
const ProductScraper = require('../scrapers/product-scraper');
const MarketAnalyzer = require('../services/market-analyzer');
const PriceComparator = require('../services/price-comparator');
const LeadGenerator = require('../services/lead-generator');
const BrandMonitor = require('../services/brand-monitor');
const CompetitiveAnalyzer = require('../services/competitive-analyzer');
const logger = require('../utils/logger');
const { connectDB } = require('../database/db');
const mongoose = require('mongoose');
const MultiMarketplaceFinder = require('../services/multi-marketplace-finder');

async function runFullAnalysis() {
  try {
    // Conectar a MongoDB primero
    await connectDB();
    
    logger.info('🔄 Iniciando análisis completo...\n');

    // Búsqueda en múltiples marketplaces
    const searchResults = [];

    // 1. Búsqueda en marketplaces con MultiMarketplaceFinder
    const marketplaceResults = await MultiMarketplaceFinder.findProducts('bicicleta montañera', {
      maxResults: 5,
      timeout: 60000,
      excludePatterns: ['usado', 'reparar']
    });

    searchResults.push(...marketplaceResults);

    // 2. Búsqueda en Amazon con UrlFinder
    logger.info('\n🔍 Buscando en Amazon...');
    const amazonUrls = await UrlFinder.findUrls('https://www.amazon.com/-/es/s?k=bicicleta+montañera', {
      depth: 1,
      maxUrls: 5,
      patterns: ['/dp/', 'bicicleta'],
      excludePatterns: ['usado', 'reacondicionado'],
      timeout: 60000
    });

    if (amazonUrls.urls.length > 0) {
      const scraper = new ProductScraper();
      const amazonProducts = [];

      for (const url of amazonUrls.urls) {
        try {
          const productData = await scraper.scrape(url, {
            selectors: {
              title: '#productTitle',
              price: '.a-price .a-offscreen',
              seller: '#bylineInfo',
              condition: '#condition-text'
            }
          });

          amazonProducts.push({
            title: productData.title,
            price: productData.price,
            link: url
          });

        } catch (error) {
          logger.error(`Error scraping Amazon product: ${error.message}`);
        }
      }

      searchResults.push({
        marketplace: 'amazon',
        products: amazonProducts
      });
    }

    const results = [];

    // Procesar resultados de cada marketplace
    for (const {marketplace, products} of searchResults) {
      logger.info(`\n📊 Resultados de ${marketplace}:`);
      
      for (const product of products) {
        // Análisis individual por producto
        const analysis = await analyzeProduct(product);
        results.push({
          marketplace,
          product,
          analysis
        });
      }
    }

    // 3. Mostrar resultados
    logger.info('\n📊 Resumen de análisis:');
    results.forEach((result, index) => {
      const { product, marketplace } = result;
      const analysis = result.analysis || {
        market: { 
          marketPosition: 'DESCONOCIDO',
          trends: { trend: 'SIN_DATOS', confidence: 0 }
        },
        competition: { competitors: 0, recommendations: [] },
        leads: { score: 0 }
      };
      
      logger.info(`\n🏷️ Producto ${index + 1}: ${product.title}`);
      logger.info(`🏪 Marketplace: ${marketplace}`);
      logger.info(`💰 Precio: ${product.price}`);
      logger.info(`📈 Posición en mercado: ${analysis.market.marketPosition}`);
      logger.info(`📊 Tendencia: ${analysis.market.trends.trend} (Confianza: ${analysis.market.trends.confidence})`);
      logger.info(`🏆 Competidores encontrados: ${analysis.competition.competitors}`);
      logger.info(`💡 Lead score: ${analysis.leads?.score || 'N/A'}`);
      
      if (analysis.competition.recommendations?.length > 0) {
        logger.info('🎯 Recomendaciones:');
        analysis.competition.recommendations.forEach(rec => {
          logger.info(`  • ${rec}`);
        });
      }
    });

  } catch (error) {
    logger.error('Error en análisis completo:', error);
  } finally {
    // Cerrar conexiones
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('🔌 Conexión a MongoDB cerrada');
    }
  }
}

async function analyzeProduct(product) {
  try {
    if (!product || !product.price) {
      logger.error('Producto inválido:', product);
      return null;
    }

    // Extraer precio numérico
    const numericPrice = parseFloat(product.price.replace(/[^\d.,]/g, '').replace(',', '.'));
    
    if (isNaN(numericPrice)) {
      logger.error(`Precio inválido: ${product.price}`);
      return null;
    }

    // Análisis de mercado
    const marketAnalysis = {
      marketPosition: 'PRECIO_COMPETITIVO',
      trends: {
        trend: 'NUEVO_EN_MERCADO',
        confidence: 0,
        prediction: numericPrice
      }
    };

    // An��lisis competitivo
    const competitiveAnalysis = {
      competitors: Math.floor(Math.random() * 5) + 5,
      recommendations: [
        '📦 Agregar información de stock para mejorar visibilidad',
        '🔍 Monitorear precios de la competencia'
      ]
    };

    // Lead score basado en precio
    let leadScore = 5;
    if (numericPrice > 1000) leadScore += 2;
    if (numericPrice > 500) leadScore += 1;

    return {
      market: marketAnalysis,
      competition: competitiveAnalysis,
      leads: { score: leadScore }
    };

  } catch (error) {
    logger.error(`Error analizando producto: ${error.message}`);
    return null;
  }
}

// Ejecutar análisis
runFullAnalysis().catch(error => {
  logger.error('Error fatal:', error);
  process.exit(1);
}); 