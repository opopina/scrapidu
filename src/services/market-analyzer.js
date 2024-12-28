const logger = require('../utils/logger');
const mongoose = require('mongoose');

class MarketAnalyzer {
  constructor() {
    this.priceHistory = mongoose.model('PriceHistory', {
      productId: String,
      title: String,
      price: Number,
      seller: String,
      timestamp: Date,
      platform: String
    });
  }

  async analyzeProduct(productData) {
    try {
      // Generar un ID único para el producto
      const productId = this.generateProductId(productData);

      // Guardar histórico de precios
      await this.priceHistory.create({
        productId,
        title: productData.title,
        price: this.extractNumericPrice(productData.price),
        seller: productData.seller,
        timestamp: new Date(),
        platform: 'mercadolibre'
      });

      // Análisis de precio
      const priceAnalysis = await this.analyzePriceHistory(productId);
      
      // Análisis de competencia
      const competitorAnalysis = await this.analyzeCompetitors(productData);

      // Calcular posición en el mercado
      const marketPosition = await this.calculateMarketPosition(productData, priceAnalysis);

      // Analizar tendencias
      const trends = await this.analyzeTrends(productData);

      return {
        priceAnalysis,
        competitorAnalysis,
        marketPosition,
        trends
      };
    } catch (error) {
      logger.error('Error en análisis de mercado:', error);
      throw error;
    }
  }

  generateProductId(productData) {
    // Generar ID único basado en título y vendedor
    return `${productData.title}-${productData.seller}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }

  async calculateMarketPosition(productData, priceAnalysis) {
    try {
      const price = this.extractNumericPrice(productData.price);
      
      if (!priceAnalysis.averagePrice) {
        return 'NUEVO_EN_MERCADO';
      }

      // Calcular posición relativa al precio promedio
      const priceDiff = ((price - priceAnalysis.averagePrice) / priceAnalysis.averagePrice) * 100;

      if (priceDiff <= -10) return 'BAJO_MERCADO';
      if (priceDiff >= 10) return 'SOBRE_MERCADO';
      return 'PRECIO_COMPETITIVO';

    } catch (error) {
      logger.error('Error calculando posición de mercado:', error);
      return 'NO_DETERMINADO';
    }
  }

  async analyzeTrends(productData) {
    try {
      // Guardar precio actual en histórico
      await this.priceHistory.create({
        productId: this.generateProductId(productData),
        title: productData.title,
        price: this.extractNumericPrice(productData.price),
        date: new Date()
      });

      // Obtener histórico de 30 días
      const history = await this.priceHistory
        .find({
          title: { $regex: new RegExp(productData.title, 'i') }
        })
        .sort({ date: -1 })
        .limit(30);

      if (history.length < 2) {
        return {
          trend: 'NUEVO_EN_MERCADO',
          confidence: 0,
          prediction: null
        };
      }

      // Calcular tendencia
      const prices = history.map(h => h.price);
      const firstPrice = prices[prices.length - 1];
      const lastPrice = prices[0];
      const priceDiff = ((lastPrice - firstPrice) / firstPrice) * 100;

      let trend;
      if (priceDiff > 5) trend = 'ALCISTA';
      else if (priceDiff < -5) trend = 'BAJISTA';
      else trend = 'ESTABLE';

      return {
        trend,
        confidence: Math.min(Math.abs(priceDiff) / 10, 1),
        prediction: lastPrice * (1 + (priceDiff / 200)) // Predicción más conservadora
      };
    } catch (error) {
      logger.error('Error analizando tendencias:', error);
      return {
        trend: 'ERROR',
        confidence: 0,
        prediction: null
      };
    }
  }

  async analyzePriceHistory(productId) {
    const history = await this.priceHistory
      .find({ productId })
      .sort({ timestamp: -1 })
      .limit(30);

    return {
      currentPrice: history[0]?.price,
      averagePrice: this.calculateAverage(history.map(h => h.price)),
      minPrice: Math.min(...history.map(h => h.price)),
      maxPrice: Math.max(...history.map(h => h.price)),
      priceVolatility: this.calculateVolatility(history.map(h => h.price))
    };
  }

  async analyzeCompetitors(productData) {
    // Análisis de competidores
    return {
      totalCompetitors: 0,
      pricePosition: 'pending',
      marketShare: 'pending',
      competitorPrices: []
    };
  }

  extractNumericPrice(priceStr) {
    return parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  }

  calculateAverage(numbers) {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  calculateVolatility(prices) {
    const avg = this.calculateAverage(prices);
    const squaredDiffs = prices.map(p => Math.pow(p - avg, 2));
    return Math.sqrt(this.calculateAverage(squaredDiffs));
  }
}

module.exports = new MarketAnalyzer(); 