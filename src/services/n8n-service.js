const axios = require('axios');
const logger = require('../utils/logger');

class N8NService {
  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n.ricochetdeveloper.com';
    this.webhookPath = process.env.N8N_WEBHOOK_PATH || '/webhook/scrappy-events';
    this.apiKey = process.env.N8N_API_KEY;
    this.retryCount = 1;
    this.retryDelay = 1000;
    this.timeout = 5000;
    this.pendingEvents = new Map();
  }

  async notifyEvent(event, data) {
    const eventId = `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const similarEventPending = Array.from(this.pendingEvents.values())
      .some(e => e.event === event && JSON.stringify(e.data) === JSON.stringify(data));
    
    if (similarEventPending) {
      logger.debug(`Evento similar pendiente, ignorando: ${event}`);
      return null;
    }

    this.pendingEvents.set(eventId, { event, data, timestamp: Date.now() });

    try {
      const webhookUrl = `${this.baseUrl}${this.webhookPath}`;
      
      const response = await axios.post(webhookUrl, {
        event,
        data,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        timeout: this.timeout,
        validateStatus: status => status < 500
      });

      if (response.status === 200) {
        logger.info(`Evento ${event} notificado exitosamente a n8n`);
        this.pendingEvents.delete(eventId);
        return response.data;
      }

      throw new Error(`Error ${response.status}: ${response.data}`);

    } catch (error) {
      logger.error(`Error notificando evento ${event} a n8n:`, error.message);
      this.pendingEvents.delete(eventId);
      return null;
    }
  }

  async notifyJobCompleted(jobId, result) {
    return this.notifyEvent('job_completed', { jobId, result });
  }

  async notifyJobFailed(jobId, error) {
    return this.notifyEvent('job_failed', { 
      jobId, 
      error: error.message,
      stack: error.stack
    });
  }

  cleanupPendingEvents() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;

    for (const [id, event] of this.pendingEvents.entries()) {
      if (now - event.timestamp > maxAge) {
        this.pendingEvents.delete(id);
      }
    }
  }
}

module.exports = new N8NService(); 