const readline = require('readline');
const multiMarketplaceFinder = require('../services/multi-marketplace-finder');
const logger = require('../utils/logger');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startSearch() {
  try {
    // Preguntar al usuario qué quiere buscar
    const query = await new Promise(resolve => {
      rl.question('🔍 ¿Qué producto quieres buscar? ', answer => {
        resolve(answer.trim());
      });
    });

    if (!query) {
      logger.error('❌ La búsqueda no puede estar vacía');
      return;
    }

    logger.info(`🔄 Buscando "${query}" en todos los marketplaces...`);

    // Realizar la búsqueda
    const results = await multiMarketplaceFinder.findProducts(query, {
      maxResults: 5,
      timeout: 30000
    });

    // Mostrar resultados
    results.forEach(({ marketplace, products }) => {
      if (products.length > 0) {
        logger.info(`\n📊 Resultados de ${marketplace}:`);
        products.forEach(product => {
          logger.info(`\n🏷️ ${product.title}`);
          logger.info(`💰 ${product.price}`);
          logger.info(`🔗 ${product.link}`);
        });
      }
    });

  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
  } finally {
    rl.close();
    await multiMarketplaceFinder.close();
  }
}

// Iniciar la aplicación
startSearch(); 