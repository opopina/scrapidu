const { chromium } = require('playwright');
const ProxyRotator = require('./proxy-rotator');
const UserAgentRotator = require('./user-agent-rotator');
const logger = require('../utils/logger');

class BrowserManager {
  constructor() {
    this.proxyRotator = new ProxyRotator();
    this.userAgentRotator = new UserAgentRotator();
  }

  async createBrowser() {
    try {
      const proxy = await this.proxyRotator.getNextProxy();
      const userAgent = this.userAgentRotator.getNextUserAgent();

      const browser = await chromium.launch({
        proxy: {
          server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
          username: proxy.username,
          password: proxy.password
        },
        headless: true,
        args: [
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          `--user-agent=${userAgent}`
        ]
      }).catch(async (error) => {
        if (error.message.includes("Executable doesn't exist")) {
          logger.warn('Navegador no encontrado, intentando instalar...');
          await this.installBrowser();
          // Reintentar después de la instalación
          return await chromium.launch({
            proxy: {
              server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
              username: proxy.username,
              password: proxy.password
            },
            headless: true,
            args: [
              '--disable-web-security',
              '--disable-features=IsolateOrigins,site-per-process',
              `--user-agent=${userAgent}`
            ]
          });
        }
        throw error;
      });

      return browser;
    } catch (error) {
      logger.error('Error al crear el navegador:', error.message);
      throw error;
    }
  }

  async installBrowser() {
    try {
      const { execSync } = require('child_process');
      logger.info('Instalando navegador Chromium...');
      execSync('npx playwright install chromium', { stdio: 'inherit' });
      logger.info('Navegador instalado correctamente');
    } catch (error) {
      logger.error('Error al instalar el navegador:', error.message);
      throw error;
    }
  }

  async createPage(browser) {
    const page = await browser.newPage();
    
    // Interceptor para detectar bloqueos
    await page.route('**/*', async route => {
      const response = await route.request().response();
      if (response) {
        const status = response.status();
        if (status === 403 || status === 429) {
          logger.warn(`Detectado bloqueo (Status: ${status}), cambiando proxy...`);
          await this.handleBlock();
        }
      }
      await route.continue();
    });

    // Manejar errores de red
    page.on('requestfailed', request => {
      const failure = request.failure();
      if (failure) {
        logger.warn(`Fallo en request: ${request.url()} - ${failure.errorText}`);
        if (failure.errorText.includes('net::ERR_PROXY_CONNECTION_FAILED')) {
          this.handleBlock();
        }
      }
    });

    // Configurar timeouts
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);

    return page;
  }

  async handleBlock() {
    try {
      await this.proxyRotator.banCurrentProxy();
      logger.info('Proxy baneado y cambiado exitosamente');
    } catch (error) {
      logger.error('Error al manejar el bloqueo:', error.message);
    }
  }
}

module.exports = BrowserManager; 