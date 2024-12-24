const Queue = require('bull');
const logger = require('../utils/logger');

class ScrapingQueue {
  constructor() {
    this.queue = null;
  }

  async init() {
    try {
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

      // Configurar eventos de la cola
      this.queue.on('completed', (job) => {
        logger.info(`Trabajo ${job.id} completado`);
      });

      this.queue.on('failed', (job, err) => {
        logger.error(`Trabajo ${job.id} falló: ${err.message}`);
      });

      this.queue.on('error', (error) => {
        logger.error('Error en la cola:', error);
      });

      logger.info('Cola de scraping inicializada correctamente');
      return this;
    } catch (error) {
      logger.error('Error inicializando la cola:', error);
      throw error;
    }
  }

  async addUrl(url, options = {}) {
    if (!this.queue) {
      throw new Error('Cola no inicializada. Llama a init() primero.');
    }
    return this.queue.add('scrape-url', {
      url,
      options
    });
  }

  async processQueue(scraper) {
    if (!this.queue) {
      throw new Error('Cola no inicializada. Llama a init() primero.');
    }
    
    this.queue.process('scrape-url', async (job) => {
      try {
        const { url, options } = job.data;
        logger.info(`[Job ${job.id}] Iniciando scraping de URL: ${url}`);
        
        // Actualizar progreso
        await job.progress(10);
        
        const result = await scraper.scrape(url, options);
        
        // Actualizar progreso
        await job.progress(100);
        
        logger.info(`[Job ${job.id}] Scraping completado exitosamente`);
        return result;
      } catch (error) {
        logger.error(`[Job ${job.id}] Error en scraping:`, error);
        throw error;
      }
    });

    // Eventos adicionales para debugging
    this.queue.on('active', (job) => {
      logger.info(`[Job ${job.id}] ha comenzado a procesarse`);
    });

    this.queue.on('completed', (job, result) => {
      logger.info(`[Job ${job.id}] completado con resultado:`, result);
    });

    this.queue.on('failed', (job, error) => {
      logger.error(`[Job ${job.id}] falló con error:`, error);
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`[Job ${job.id}] se ha estancado`);
    });

    logger.info('Procesador de cola configurado y listo');
  }

  async close() {
    if (this.queue) {
      await this.queue.close();
      logger.info('Cola cerrada correctamente');
    }
  }

  async getJob(jobId) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getJob(jobId);
  }

  async getJobs(start = 0, end = -1) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getJobs(start, end);
  }

  async getActive(start = 0, end = -1) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getActive(start, end);
  }

  async getCompleted(start = 0, end = -1) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getCompleted(start, end);
  }

  async getFailed(start = 0, end = -1) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getFailed(start, end);
  }

  async getDelayed(start = 0, end = -1) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getDelayed(start, end);
  }

  async getWaiting(start = 0, end = -1) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    return await this.queue.getWaiting(start, end);
  }
}

module.exports = ScrapingQueue; 