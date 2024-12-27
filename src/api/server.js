const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const ProductScraper = require('../scrapers/product-scraper');
const logger = require('../utils/logger');
const dns = require('dns').promises;

class ScrapingAPI {
  constructor(queue) {
    this.app = express();
    this.scraper = new ProductScraper();
    this.queue = queue;
    this.requestCache = new Map();
    this.requestCounts = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json());
    
    // Rate limiting super permisivo para pruebas
    this.app.use((req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowStart = now - 60000; // Ventana de 1 minuto

      if (!this.requestCounts.has(ip)) {
        this.requestCounts.set(ip, []);
      }

      const requests = this.requestCounts.get(ip);
      const recentRequests = requests.filter(time => time > windowStart);
      this.requestCounts.set(ip, recentRequests);

      // Configurar headers de rate limit
      const limit = 60; // 60 requests por minuto
      const remaining = Math.max(0, limit - recentRequests.length);
      const reset = Math.ceil((windowStart + 60000) / 1000);

      res.set({
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'X-RateLimit-Window': '60s'
      });

      if (recentRequests.length >= limit) {
        const retryAfter = Math.ceil((windowStart + 60000 - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        
        return res.status(429).json({
          error: 'Demasiadas peticiones',
          retryAfter,
          message: `Por favor espere ${retryAfter} segundos antes de reintentar`,
          limit,
          remaining: 0,
          reset
        });
      }

      recentRequests.push(now);
      next();
    });

    this.app.use((req, res, next) => {
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

        // Validar URLs antes de procesarlas
        const validationResults = await Promise.all(
          urls.map(async (url) => {
            const sanitizedUrl = await sanitizeUrl(url);
            return {
              originalUrl: url,
              isValid: Boolean(sanitizedUrl),
              sanitizedUrl
            };
          })
        );

        const validUrls = validationResults
          .filter(result => result.isValid)
          .map(result => result.sanitizedUrl);

        if (validUrls.length === 0) {
          return res.status(400).json({
            error: 'No se encontraron URLs válidas para procesar',
            validationResults
          });
        }

        // Crear los jobs con timeout más corto
        const jobs = await Promise.all(
          validUrls.map(url => this.queue.addUrl(url, {
            ...config,
            timeout: config.timeout || 30000, // 30 segundos máximo
            maxRetries: config.maxRetries || 1
          }))
        );

        // Esperar a que todos los jobs terminen con timeout
        const results = await Promise.race([
          Promise.all(
            jobs.map(job => new Promise(async (resolve) => {
              try {
                const result = await job.finished();
                resolve({
                  id: job.id,
                  url: job.data.url,
                  status: 'completed',
                  result
                });
              } catch (error) {
                resolve({
                  id: job.id,
                  url: job.data.url,
                  status: 'failed',
                  error: error.message
                });
              }
            }))
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout global')), 45000) // 45 segundos máximo total
          )
        ]);

        res.json({ 
          success: true,
          totalUrls: urls.length,
          validUrls: validUrls.length,
          validationResults,
          jobs: results
        });

      } catch (error) {
        logger.error('Error en scraping:', error);
        res.status(500).json({ error: error.message });
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

  async start(port = process.env.API_PORT || 3030) {
    try {
      const server = this.app.listen(port, () => {
        logger.info(`API escuchando en puerto ${port}`);
      });

      await this.queue.processQueue(this.scraper);

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Puerto ${port} en uso`);
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

  generateRequestHash(urls) {
    const crypto = require('crypto');
    const data = JSON.stringify(urls.sort());
    return crypto.createHash('md5').update(data).digest('hex');
  }

  isDuplicateRequest(hash) {
    const now = Date.now();
    const lastRequest = this.requestCache.get(hash);
    
    if (lastRequest && (now - lastRequest) < 5000) { // 5 segundos
      return true;
    }
    return false;
  }

  registerRequest(hash) {
    this.requestCache.set(hash, Date.now());
    
    // Limpiar entradas antiguas cada cierto tiempo
    if (this.requestCache.size > 1000) {
      const now = Date.now();
      for (const [key, timestamp] of this.requestCache.entries()) {
        if (now - timestamp > 300000) { // 5 minutos
          this.requestCache.delete(key);
        }
      }
    }
  }
}

// Función para validar un dominio usando DNS
async function isDomainValid(domain) {
  try {
    // Solo validar que el dominio tenga una estructura válida
    if (domain.split('.').length < 2) {
      return false;
    }

    const result = await dns.lookup(domain);
    return Boolean(result?.address);
  } catch {
    return false;
  }
}

// Función mejorada para limpiar y validar URLs
async function sanitizeUrl(url) {
  if (!url) return null;
  
  try {
    // Asegurarse de que la URL tenga un protocolo
    let urlStr = url.toLowerCase().trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }

    // Validar formato de URL
    const urlObj = new URL(urlStr);
    
    // Validar que tenga un dominio válido
    const domainParts = urlObj.hostname.split('.');
    if (domainParts.length < 2) {
      logger.warn(`URL inválida (dominio incompleto): ${url}`);
      return null;
    }

    // Validar que el dominio exista
    const isDomainReachable = await isDomainValid(urlObj.hostname);
    if (!isDomainReachable) {
      logger.warn(`Dominio no alcanzable: ${urlObj.hostname}`);
      return null;
    }

    return urlObj.href;
  } catch (error) {
    logger.warn(`URL inválida: ${url} - ${error.message}`);
    return null;
  }
}

module.exports = ScrapingAPI; 