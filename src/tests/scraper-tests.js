const ProductScraper = require('../scrapers/product-scraper');
const logger = require('../utils/logger');
require('dotenv').config();

async function runTests() {
  const scraper = new ProductScraper();
  const testCases = [
    {
      name: 'Test básico - Página estática',
      url: 'https://example.com',
      expectedFields: ['title', 'meta', 'content']
    },
    {
      name: 'Test e-commerce - Amazon',
      url: 'https://www.amazon.com',
      options: {
        selectors: {
          title: '#productTitle',
          price: '.a-price-whole',
          rating: '#acrPopover .a-icon-alt'
        }
      }
    },
    {
      name: 'Test tienda local - Mercado Libre Ecuador',
      url: 'https://www.mercadolibre.com.ec',
      options: {
        selectors: {
          title: '.ui-pdp-title',
          price: '.andes-money-amount__fraction',
          seller: '.ui-pdp-seller__link-trigger'
        }
      }
    }
  ];

  logger.info('🧪 Iniciando pruebas del scraper...\n');

  for (const test of testCases) {
    try {
      logger.info(`📝 Ejecutando: ${test.name}`);
      console.time(test.name);

      const result = await scraper.scrape(test.url, test.options);

      // Validar resultado
      if (test.expectedFields) {
        const missingFields = test.expectedFields.filter(field => !result[field]);
        if (missingFields.length > 0) {
          throw new Error(`Campos faltantes: ${missingFields.join(', ')}`);
        }
      }

      console.timeEnd(test.name);
      logger.info('✅ Prueba exitosa\n');
      logger.info('Resultado:', JSON.stringify(result, null, 2));

    } catch (error) {
      console.timeEnd(test.name);
      logger.error(`❌ Prueba fallida: ${error.message}\n`);
    }
  }

  // Pruebas de manejo de errores
  try {
    logger.info('🧪 Probando manejo de errores...');
    await scraper.scrape('https://sitio-que-no-existe.com');
  } catch (error) {
    logger.info('✅ Manejo de error correcto:', error.message);
  }

  // Pruebas de concurrencia
  try {
    logger.info('\n🧪 Probando scraping concurrente...');
    console.time('Scraping concurrente');

    const urls = [
      'https://example.com',
      'https://example.org',
      'https://example.net'
    ];

    const results = await Promise.all(
      urls.map(url => scraper.scrape(url))
    );

    console.timeEnd('Scraping concurrente');
    logger.info(`✅ ${results.length} páginas procesadas concurrentemente\n`);

  } catch (error) {
    logger.error('❌ Error en prueba concurrente:', error);
  }

  // Pruebas de rendimiento
  try {
    logger.info('🧪 Prueba de rendimiento...');
    const startTime = Date.now();
    let pagesProcessed = 0;

    for (let i = 0; i < 5; i++) {
      await scraper.scrape('https://example.com');
      pagesProcessed++;
    }

    const timeElapsed = Date.now() - startTime;
    const avgTime = timeElapsed / pagesProcessed;

    logger.info(`✅ Rendimiento promedio: ${avgTime.toFixed(2)}ms por página`);
    logger.info(`   Total: ${pagesProcessed} páginas en ${(timeElapsed/1000).toFixed(2)}s\n`);

  } catch (error) {
    logger.error('❌ Error en prueba de rendimiento:', error);
  }

  // Prueba de memoria
  try {
    logger.info('🧪 Monitoreando uso de memoria...');
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Realizar varios scrapes
    for (let i = 0; i < 10; i++) {
      await scraper.scrape('https://example.com');
    }

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryDiff = finalMemory - initialMemory;

    logger.info(`✅ Uso de memoria:
      Inicial: ${initialMemory.toFixed(2)} MB
      Final: ${finalMemory.toFixed(2)} MB
      Diferencia: ${memoryDiff.toFixed(2)} MB\n`);

  } catch (error) {
    logger.error('❌ Error en prueba de memoria:', error);
  }

  // Cerrar el navegador al finalizar
  await scraper.browser?.close();
  logger.info('🏁 Pruebas completadas');
}

// Ejecutar las pruebas
runTests().catch(error => {
  logger.error('Error ejecutando pruebas:', error);
  process.exit(1);
}); 