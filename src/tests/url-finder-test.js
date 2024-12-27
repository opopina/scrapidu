const UrlFinder = require('../services/url-finder');
const logger = require('../utils/logger');

async function testUrlFinder() {
  try {
    logger.info('🔍 Probando buscador de URLs...\n');

    // Test con Mercado Libre - búsqueda de iPhones
    const result = await UrlFinder.findUrls('https://listado.mercadolibre.com.ec/iphone', {
      depth: 1,
      maxUrls: 10,
      patterns: [
        '/p/',         // URLs de productos
        'iphone',      // Debe contener iphone
        '-MEC-'        // Código de producto ML Ecuador
      ],
      excludePatterns: [
        'login',
        'registration',
        'cart',
        'questions',
        'shipping',
        '#position'    // Excluir URLs de posición en listado
      ]
    });

    logger.info(`\n✅ URLs encontradas: ${result.total}`);
    logger.info('Patrones buscados:', result.patterns);
    logger.info('Patrones excluidos:', result.excludePatterns);
    logger.info('\nURLs encontradas:');
    result.urls.forEach((url, index) => {
      logger.info(`${index + 1}. ${url}`);
    });

  } catch (error) {
    logger.error('❌ Error en prueba:', error);
  }
}

testUrlFinder();