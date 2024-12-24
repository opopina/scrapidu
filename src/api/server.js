const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const ProductScraper = require('../scrapers/product-scraper');
const logger = require('../utils/logger');

class ScrapingAPI {
  constructor(queue) {
    this.app = express();
    this.scraper = new ProductScraper();
    this.queue = queue;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json());
    
    // Middleware de autenticación
    this.app.use((req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      if (req.path.startsWith('/api/') && apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'API Key inválida' });
      }
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Ruta de health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Endpoint para recibir URLs de n8n
    this.app.post('/api/scrape', async (req, res) => {
      try {
        const { urls, config } = req.body;
        
        if (!Array.isArray(urls)) {
          return res.status(400).json({ 
            error: 'URLs debe ser un array' 
          });
        }

        logger.info(`Iniciando scraping de ${urls.length} URLs`);

        // Usar la cola para el scraping
        const jobs = await Promise.all(
          urls.map(url => this.queue.addUrl(url, config))
        );

        res.json({ 
          success: true, 
          jobIds: jobs.map(job => job.id)
        });
      } catch (error) {
        logger.error('Error en scraping:', error);
        res.status(500).json({ 
          error: error.message 
        });
      }
    });

    // Webhook para recibir notificaciones de n8n
    this.app.post('/webhook/n8n', async (req, res) => {
      try {
        const { workflow, data } = req.body;
        logger.info(`Recibido webhook de n8n - Workflow: ${workflow}`);
        
        // Procesar según el workflow
        switch (workflow) {
          case 'new_products':
            await this.handleNewProducts(data);
            break;
          case 'update_prices':
            await this.handlePriceUpdates(data);
            break;
          default:
            logger.warn(`Workflow desconocido: ${workflow}`);
        }

        res.json({ success: true });
      } catch (error) {
        logger.error('Error en webhook:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint para verificar estado de trabajos
    this.app.get('/api/jobs/:jobId', async (req, res) => {
      try {
        const job = await this.queue.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: 'Trabajo no encontrado' });
        }
        
        const state = await job.getState();
        const result = job.returnvalue;
        
        res.json({
          id: job.id,
          state,
          result,
          progress: job.progress(),
          failedReason: job.failedReason,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          attempts: job.attemptsMade
        });
      } catch (error) {
        logger.error('Error obteniendo estado del trabajo:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint para listar todos los trabajos
    this.app.get('/api/jobs', async (req, res) => {
      try {
        const { status = 'active', page = 1, limit = 10 } = req.query;
        const start = (page - 1) * limit;
        const end = page * limit - 1;

        let jobs;
        switch (status) {
          case 'active':
            jobs = await this.queue.getActive(start, end);
            break;
          case 'completed':
            jobs = await this.queue.getCompleted(start, end);
            break;
          case 'failed':
            jobs = await this.queue.getFailed(start, end);
            break;
          case 'delayed':
            jobs = await this.queue.getDelayed(start, end);
            break;
          case 'waiting':
            jobs = await this.queue.getWaiting(start, end);
            break;
          default:
            jobs = await this.queue.getJobs(start, end);
        }

        const jobsData = await Promise.all(jobs.map(async (job) => ({
          id: job.id,
          state: await job.getState(),
          data: job.data,
          progress: job.progress(),
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          attempts: job.attemptsMade,
          failedReason: job.failedReason
        })));

        res.json({
          page: parseInt(page),
          limit: parseInt(limit),
          status,
          jobs: jobsData
        });
      } catch (error) {
        logger.error('Error listando trabajos:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint para reintentar un trabajo fallido
    this.app.post('/api/jobs/:jobId/retry', async (req, res) => {
      try {
        const job = await this.queue.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        await job.retry();
        res.json({ success: true, message: 'Trabajo programado para reintento' });
      } catch (error) {
        logger.error('Error reintentando trabajo:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Endpoint para cancelar un trabajo
    this.app.delete('/api/jobs/:jobId', async (req, res) => {
      try {
        const job = await this.queue.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: 'Trabajo no encontrado' });
        }

        await job.remove();
        res.json({ success: true, message: 'Trabajo cancelado exitosamente' });
      } catch (error) {
        logger.error('Error cancelando trabajo:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  async handleNewProducts(data) {
    try {
      const { products } = data;
      logger.info(`Procesando ${products.length} nuevos productos`);
      
      for (const product of products) {
        await this.scraper.scrape(product.url, {
          selectors: product.selectors,
          saveToDb: true
        });
      }
    } catch (error) {
      logger.error('Error procesando nuevos productos:', error);
      throw error;
    }
  }

  async handlePriceUpdates(data) {
    try {
      const { products } = data;
      logger.info(`Actualizando precios de ${products.length} productos`);
      
      for (const product of products) {
        const result = await this.scraper.scrape(product.url, {
          selectors: { price: product.priceSelector },
          onlyPrice: true
        });
        
        // Actualizar en base de datos
        await this.scraper.updatePrice(product.id, result.price);
      }
    } catch (error) {
      logger.error('Error actualizando precios:', error);
      throw error;
    }
  }

  async sendToN8N(results) {
    try {
      const axios = require('axios');
      await axios.post(process.env.N8N_WEBHOOK_URL, {
        results,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.N8N_API_KEY
        }
      });
      logger.info('Resultados enviados a n8n exitosamente');
    } catch (error) {
      logger.error('Error enviando resultados a n8n:', error);
      throw error;
    }
  }

  start(port = process.env.API_PORT || 3030) {
    try {
      const server = this.app.listen(port, () => {
        logger.info(`API escuchando en puerto ${port}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Puerto ${port} en uso. Por favor, configura un puerto diferente en .env (API_PORT)`);
          process.exit(1);
        } else {
          logger.error('Error iniciando servidor:', error);
          process.exit(1);
        }
      });

      this.server = server;
    } catch (error) {
      logger.error('Error iniciando servidor:', error);
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      logger.info('Servidor detenido correctamente');
    }
  }
}

module.exports = ScrapingAPI; 