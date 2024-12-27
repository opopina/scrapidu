const n8nService = require('../services/n8n-service');

// ... resto del código ...

async function processJob(job) {
  try {
    logger.info(`[Job ${job.id}] ha comenzado a procesarse`);
    
    // Notificar inicio del job
    await n8nService.notifyJobCreated(job.id, job.data.url, job.data.options);

    const scraper = new ProductScraper();
    const result = await scraper.scrape(job.data.url, job.data.options);

    // Notificar resultado exitoso
    await n8nService.sendScrapingResult(job.id, result);

    logger.info(`[Job ${job.id}] Scraping completado exitosamente`);
    return result;
  } catch (error) {
    // Notificar error
    await n8nService.notifyJobFailed(job.id, error);
    
    logger.error(`[Job ${job.id}] Error:`, error);
    throw error;
  }
} 