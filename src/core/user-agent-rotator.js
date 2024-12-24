const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class UserAgentRotator {
  constructor() {
    this.userAgents = [];
    this.currentIndex = 0;
    this.loadUserAgents();
  }

  async loadUserAgents() {
    try {
      const userAgentFile = await fs.readFile(
        path.join(__dirname, '../../config/user-agents.json'),
        'utf-8'
      );
      this.userAgents = JSON.parse(userAgentFile).userAgents;
      logger.info(`Cargados ${this.userAgents.length} user agents`);
    } catch (error) {
      logger.error('Error cargando user agents:', error);
      throw error;
    }
  }

  getNextUserAgent() {
    if (this.userAgents.length === 0) {
      throw new Error('No hay user agents disponibles');
    }

    const userAgent = this.userAgents[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.userAgents.length;
    return userAgent;
  }
}

module.exports = UserAgentRotator; 