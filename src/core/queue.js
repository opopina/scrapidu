const Queue = require('bull');
const logger = require('../utils/logger');
const n8nService = require('../services/n8n-service');

class ScrapingQueue {
  constructor() {
    this.queue = null;
    this.concurrentJobs = 3; // Número de jobs paralelos
    this.jobTimeout = 180000; // 3 minutos por job
  }

  async init() {
    try {
      this.queue = new Queue('scraping-queue', {
        redis: {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT
        }
      });

      // Limpiar jobs estancados al inicio
      await this.cleanupStalledJobs();
      
      logger.info('Cola de scraping inicializada correctamente');
      return this;
    } catch (error) {
      logger.error('Error inicializando la cola:', error);
      throw error;
    }
  }

  async cleanupStalledJobs() {
    try {
      // Obtener todos los jobs activos y estancados
      const activeJobs = await this.queue.getActive();
      const stalledJobs = activeJobs.filter(job => job.isStalled());

      if (stalledJobs.length > 0) {
        logger.info(`Limpiando ${stalledJobs.length} jobs estancados...`);
        
        for (const job of stalledJobs) {
          try {
            // Marcar como fallido y remover
            await job.moveToFailed({
              message: 'Job removido por estancamiento'
            });
            await job.remove();
            logger.info(`Job ${job.id} removido por estancamiento`);
          } catch (error) {
            logger.error(`Error limpiando job ${job.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error en cleanupStalledJobs:', error);
    }
  }

  async addUrl(url, options = {}) {
    if (!this.queue) {
      throw new Error('Cola no inicializada. Llama a init() primero.');
    }
    const job = await this.queue.add('scrape-url', {
      url,
      options
    });
    await n8nService.notifyEvent('job_created', { 
      jobId: job.id, 
      url, 
      options 
    });
    return job;
  }

  async processQueue(scraper) {
    if (!this.queue) {
      throw new Error('Cola no inicializada');
    }
    
    // Limpiar jobs antiguos al inicio
    await this.cleanupOldJobs();
    
    // Mostrar estado inicial
    const initialStatus = await this.getQueueStatus();
    logger.showJobStatus(
      initialStatus.active,
      initialStatus.completed,
      initialStatus.failed
    );

    this.queue.process('scrape-url', this.concurrentJobs, async (job) => {
      try {
        const { url, options } = job.data;
        logger.info(`🔄 Iniciando scraping de ${url}`, { jobId: job.id });
        
        // Agregar progreso
        await job.progress(10);
        const result = await scraper.scrape(url, options);
        await job.progress(100);
        
        return result;

      } catch (error) {
        // Categorizar errores
        if (error.message.includes('timeout')) {
          logger.error(`⏱ Timeout en ${url}`, { jobId: job.id });
        } else if (error.message.includes('blocked')) {
          logger.error(`🚫 Acceso bloqueado en ${url}`, { jobId: job.id });
        } else {
          logger.error(`❌ Error en ${url}: ${error.message}`, { jobId: job.id });
        }
        throw error;
      }
    });

    // Eventos para monitoreo con mejor feedback
    this.queue.on('completed', async (job, result) => {
      logger.info(`✅ Job completado: ${job.data.url}`, { jobId: job.id });
      await n8nService.notifyJobCompleted(job.id, result);
      
      const status = await this.getQueueStatus();
      logger.showJobStatus(status.active, status.completed, status.failed);
    });

    this.queue.on('failed', async (job, error) => {
      logger.error(`❌ Job fallido: ${job.data.url}`, { jobId: job.id });
      await n8nService.notifyJobFailed(job.id, error);
      
      const status = await this.getQueueStatus();
      logger.showJobStatus(status.active, status.completed, status.failed);
    });

    this.queue.on('stalled', async (job) => {
      logger.warn(`⚠ Job estancado: ${job.data.url}`, { jobId: job.id });
      await this.handleStalledJob(job);
    });
  }

  async cleanupOldJobs() {
    try {
      const olderThan = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
      const oldJobs = await this.queue.clean(olderThan, 'completed');
      const oldFailedJobs = await this.queue.clean(olderThan, 'failed');
      
      logger.info(`🧹 Limpiados ${oldJobs.length + oldFailedJobs.length} jobs antiguos`);
    } catch (error) {
      logger.error('Error limpiando jobs antiguos:', error);
    }
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

  async getQueueStatus() {
    return {
      active: await this.queue.getActive(),
      completed: await this.queue.getCompleted(),
      failed: await this.queue.getFailed(),
      delayed: await this.queue.getDelayed(),
      waiting: await this.queue.getWaiting()
    };
  }
}

module.exports = ScrapingQueue; 