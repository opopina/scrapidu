const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ProxyRotator {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.bannedProxies = new Set();
    this.loadProxies();
  }

  async loadProxies() {
    try {
      const proxyFile = await fs.readFile(
        path.join(__dirname, '../../config/proxies.json'),
        'utf-8'
      );
      this.proxies = JSON.parse(proxyFile).proxies;
      logger.info(`Cargados ${this.proxies.length} proxies`);
    } catch (error) {
      logger.error('Error cargando proxies:', error);
      throw error;
    }
  }

  async getNextProxy() {
    if (this.proxies.length === 0) {
      throw new Error('No hay proxies disponibles');
    }

    let attempts = 0;
    const maxAttempts = this.proxies.length;

    while (attempts < maxAttempts) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      if (!this.bannedProxies.has(proxy.host)) {
        return proxy;
      }

      attempts++;
    }

    throw new Error('Todos los proxies están baneados');
  }

  async banCurrentProxy() {
    const currentProxy = this.proxies[this.currentIndex];
    this.bannedProxies.add(currentProxy.host);
    logger.warn(`Proxy baneado: ${currentProxy.host}`);
  }
}

module.exports = ProxyRotator; 