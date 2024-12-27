const UrlFinder = require('../services/url-finder');
const ProductScraper = require('../scrapers/product-scraper');
const logger = require('../utils/logger');

async function runIntegrationTest() {
  let scraper;
  try {
    logger.info('🔄 Iniciando prueba de integración...\n');
    
    // 1. Buscar URLs de productos
    logger.info('1️⃣ Buscando URLs de productos...');
    const urlResults = await UrlFinder.findUrls('https://listado.mercadolibre.com.ec/iphone', {
      depth: 1,
      maxUrls: 5,
      patterns: [
        '/p/',
        'iphone',
        '-MEC-'
      ],
      excludePatterns: [
        'usado',
        'reacondicionado',
        'refurbished'
      ]
    });

    if (urlResults.urls.length === 0) {
      throw new Error('No se encontraron URLs para scrapear');
    }

    logger.info(`\n✅ Se encontraron ${urlResults.urls.length} URLs\n`);

    // 2. Configurar el scraper
    scraper = new ProductScraper();
    const results = [];

    // 3. Scrapear cada URL
    logger.info('2️⃣ Iniciando scraping de productos...\n');
    for (const url of urlResults.urls) {
      try {
        logger.info(`🔍 Scrapeando: ${url}`);
        
        const productData = await scraper.scrape(url, {
          selectors: {
            title: 'h1.ui-pdp-title',
            price: '.andes-money-amount__fraction',
            description: '.ui-pdp-description__content',
            condition: '.ui-pdp-header__subtitle',
            seller: '.ui-pdp-seller__header__title',
            stock: '.ui-pdp-stock-information',
            currency: '.andes-money-amount__currency-symbol',
            decimals: '.andes-money-amount__cents',
            location: '.ui-pdp-media__location'
          },
          waitForSelector: '.ui-pdp-price',
          timeout: 30000,
          evaluate: async (page, selectors) => {
            const data = {};
            
            data.title = await page.$eval(selectors.title, el => el.textContent.trim());
            
            try {
              const price = await page.$eval(selectors.price, el => el.textContent.trim());
              const decimals = await page.$eval(selectors.decimals, el => el.textContent.trim())
                .catch(() => '00');
              const currency = await page.$eval(selectors.currency, el => el.textContent.trim());
              data.price = `${currency}${price},${decimals}`;
            } catch (e) {
              data.price = 'Precio no disponible';
            }

            data.condition = await page.$eval(selectors.condition, el => el.textContent.trim())
              .catch(() => 'No especificada');
            
            data.seller = await page.$eval(selectors.seller, el => el.textContent.trim())
              .catch(() => 'Vendedor no especificado');
            
            data.stock = await page.$eval(selectors.stock, el => el.textContent.trim())
              .catch(() => 'Stock no especificado');

            data.location = await page.$eval(selectors.location, el => el.textContent.trim())
              .catch(() => 'Ubicación no especificada');

            return data;
          }
        });

        const cleanProduct = {
          url: url.split('#')[0],
          title: productData.title,
          price: productData.price,
          condition: productData.condition,
          seller: productData.seller,
          stock: productData.stock,
          location: productData.location
        };

        results.push(cleanProduct);
        logger.info(`✅ Producto scrapeado exitosamente\n`);
        
        // Esperar entre requests para evitar bloqueos
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        logger.error(`❌ Error scrapeando ${url}: ${error.message}\n`);
      }
    }

    // 4. Mostrar resultados
    logger.info('\n📊 Resumen de resultados:');
    logger.info(`Total URLs encontradas: ${urlResults.urls.length}`);
    logger.info(`Total productos scrapeados: ${results.length}`);
    
    logger.info('\n📝 Detalles de productos:');
    results.forEach((product, index) => {
      logger.info(`\n🏷️ Producto ${index + 1}:`);
      logger.info(`📱 Título: ${product.title || 'No disponible'}`);
      logger.info(`💰 Precio: ${product.price || 'No disponible'}`);
      logger.info(`📦 Condición: ${product.condition || 'No disponible'}`);
      logger.info(`👤 Vendedor: ${product.seller || 'No disponible'}`);
      logger.info(`📊 Stock: ${product.stock || 'No disponible'}`);
      logger.info(`🔗 URL: ${product.url}\n`);
    });

  } catch (error) {
    logger.error('❌ Error en prueba de integración:', error);
  } finally {
    if (scraper?.browser) {
      await scraper.browser.close();
      logger.info('🔒 Navegador cerrado correctamente');
    }
  }
}

// Ejecutar la prueba
runIntegrationTest().catch(error => {
  logger.error('Error fatal:', error);
  process.exit(1);
}); 