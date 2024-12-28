const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class MultiMarketplaceFinder {
  constructor() {
    this.browser = null;
    this.marketplaces = {
      mercadolibre: {
        baseUrl: 'https://listado.mercadolibre.com.ec',
        searchPath: '/',
        parse: async (page) => {
          const products = [];
          try {
            // Esperar a que cargue cualquiera de los selectores posibles
            await Promise.race([
              page.waitForSelector('.ui-search-layout__item', { timeout: 15000 }),
              page.waitForSelector('.shops__layout-item', { timeout: 15000 }),
              page.waitForSelector('.ui-search-result', { timeout: 15000 })
            ]);

            // Scroll más lento y esperar más tiempo
            await page.evaluate(async () => {
              await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 50;  // Más lento
                const timer = setInterval(() => {
                  window.scrollBy(0, distance);
                  totalHeight += distance;
                  if(totalHeight >= 1500){  // Scroll más largo
                    clearInterval(timer);
                    resolve();
                  }
                }, 200);  // Más tiempo entre scrolls
              });
            });

            await new Promise(resolve => setTimeout(resolve, 5000));  // Esperar más

            // Intentar diferentes selectores
            const selectors = [
              '.ui-search-layout__item',
              '.shops__layout-item',
              '.ui-search-result'
            ];

            for (const selector of selectors) {
              const items = await page.$$eval(selector, elements => {
                return elements.map(el => {
                  // Intentar diferentes selectores para título y precio
                  const title = 
                    el.querySelector('.ui-search-item__title')?.textContent?.trim() ||
                    el.querySelector('.shops__item-title')?.textContent?.trim() ||
                    el.querySelector('h2')?.textContent?.trim();

                  const price = 
                    el.querySelector('.andes-money-amount__fraction')?.textContent?.trim() ||
                    el.querySelector('.price-tag-fraction')?.textContent?.trim();

                  const link = 
                    el.querySelector('a[href*="mercadolibre"]')?.href ||
                    el.querySelector('a[href*="articulo"]')?.href;

                  if (title && price && link && !title.includes('Publicidad')) {
                    return { title, price: `US$ ${price}`, link };
                  }
                  return null;
                }).filter(item => item !== null);
              });

              if (items.length > 0) {
                products.push(...items);
                break;  // Si encontramos productos, salimos del loop
              }
            }

            logger.info(`🔍 Encontrados ${products.length} productos en MercadoLibre`);
            if (products.length === 0) {
              logger.debug('⚠️ No se encontraron productos en MercadoLibre');
              // Guardar HTML para debug
              await page.evaluate(() => document.documentElement.outerHTML)
                .then(html => logger.debug('HTML de la página:', html.substring(0, 500) + '...'));
            }

          } catch (error) {
            logger.error(`Error en parse de MercadoLibre: ${error.message}`);
          }
          return products;
        }
      },
      ebay: {
        baseUrl: 'https://www.ebay.com',
        searchPath: '/sch/i.html',
        queryParam: '_nkw',
        parse: async (page) => {
          const products = [];
          try {
            await page.waitForSelector('.s-item__wrapper', { timeout: 10000 });
            await page.evaluate(() => window.scrollBy(0, 500));
            await new Promise(resolve => setTimeout(resolve, 2000));

            const items = await page.$$('.s-item__wrapper');
            
            for (const item of items) {
              try {
                const title = await item.$eval('.s-item__title span', el => el.textContent.trim());
                const price = await item.$eval('.s-item__price', el => el.textContent.trim());
                const link = await item.$eval('.s-item__link', el => el.href);

                if (title && price && link && 
                    !title.includes('Shop on eBay') &&
                    !title.includes('Similar sponsored items')) {
                  products.push({ title, price, link });
                  logger.debug(`Producto extraído: ${title} - ${price}`);
                }
              } catch (e) {
                logger.debug(`Error extrayendo producto: ${e.message}`);
              }
            }
          } catch (error) {
            logger.error(`Error en parse de eBay: ${error.message}`);
          }
          return products;
        }
      },
      amazon: {
        baseUrl: 'https://www.amazon.com/-/es',
        searchPath: '/s',
        queryParam: 'k',
        parse: async (page) => {
          const products = [];
          const processedUrls = new Set();
          
          try {
            // Configurar interceptación de recursos
            await page.setRequestInterception(true);
            page.on('request', (request) => {
              if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.abort();
              } else {
                request.continue();
              }
            });

            await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 });
            
            // Scroll suave
            await page.evaluate(async () => {
              await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 50;
                const timer = setInterval(() => {
                  window.scrollBy(0, distance);
                  totalHeight += distance;
                  if(totalHeight >= 1500){
                    clearInterval(timer);
                    resolve();
                  }
                }, 200);
              });
            });

            await new Promise(resolve => setTimeout(resolve, 5000));

            const items = await page.$$eval('[data-component-type="s-search-result"]', elements => {
              return elements.map(el => {
                const title = el.querySelector('h2 span')?.textContent?.trim();
                const price = el.querySelector('.a-price-whole')?.textContent?.trim();
                const link = el.querySelector('a[href*="/dp/"]')?.href;
                
                if (title && price && link) {
                  const productId = link.match(/\/dp\/([A-Z0-9]+)/)?.[1];
                  return { 
                    title, 
                    price: `US$ ${price}`, 
                    link,
                    productId
                  };
                }
                return null;
              }).filter(item => item !== null);
            });

            // Deduplicar por productId
            items.forEach(item => {
              if (item.productId && !processedUrls.has(item.productId)) {
                processedUrls.add(item.productId);
                products.push({
                  title: item.title,
                  price: item.price,
                  link: item.link
                });
              }
            });

            logger.info(`🔍 Encontrados ${products.length} productos en Amazon`);

          } catch (error) {
            logger.error(`Error en parse de Amazon: ${error.message}`);
          }
          return products.slice(0, 5); // Limitar a 5 productos
        }
      }
    };
  }

  async initialize() {
    this.browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async findProducts(query, options = {}) {
    if (!this.browser) await this.initialize();
    const results = [];

    for (const [marketplace, config] of Object.entries(this.marketplaces)) {
      try {
        logger.info(`🔍 Buscando en ${marketplace}...`);
        
        const page = await this.browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36');

        const searchUrl = config.queryParam 
          ? `${config.baseUrl}${config.searchPath}?${config.queryParam}=${encodeURIComponent(query)}`
          : `${config.baseUrl}${config.searchPath}${encodeURIComponent(query)}`;

        logger.info(`📍 URL: ${searchUrl}`);

        await page.goto(searchUrl, { 
          waitUntil: 'networkidle0',
          timeout: options.timeout || 30000 
        });

        const products = await config.parse(page);
        const slicedProducts = products.slice(0, options.maxResults || 5);
        
        slicedProducts.forEach(product => {
          logger.info(`✅ Producto encontrado: ${product.title} - ${product.price}`);
        });

        await page.close();
        results.push({ marketplace, products: slicedProducts });

      } catch (error) {
        logger.error(`❌ Error en ${marketplace}: ${error.message}`);
        results.push({ marketplace, products: [] });
      }
    }

    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new MultiMarketplaceFinder(); 