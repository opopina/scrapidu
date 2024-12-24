const Queue = require('bull');
const logger = require('../utils/logger');

class ScrapingQueue {
  constructor() {
    this.queue = new Queue('scraping-queue', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      },
      limiter: {
        max: 5, // máximo de trabajos concurrentes
        duration: 1000 // en un segundo
      }
    });

    this.queue.on('completed', (job) => {
      logger.info(`Trabajo ${job.id} completado`);
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Trabajo ${job.id} falló: ${err.message}`);
    });
  }

  async addUrl(url, options = {}) {
    return this.queue.add('scrape-url', {
      url,
      options
    });
  }

  async processQueue(scraper) {
    this.queue.process('scrape-url', async (job) => {
      const { url, options } = job.data;
      return await scraper.scrape(url, options);
    });
  }
}

module.exports = ScrapingQueue; 