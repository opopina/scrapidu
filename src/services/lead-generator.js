const mongoose = require('mongoose');
const logger = require('../utils/logger');

class LeadGenerator {
  constructor() {
    this.leadSchema = new mongoose.Schema({
      source: String,
      productId: String,
      sellerInfo: {
        name: String,
        rating: Number,
        totalSales: Number,
        contactInfo: Object
      },
      productInfo: {
        title: String,
        price: Number,
        condition: String,
        category: String
      },
      potential: {
        score: Number,
        factors: [String]
      },
      status: String,
      createdAt: Date
    });

    this.Lead = mongoose.model('Lead', this.leadSchema);
  }

  async generateLeads(productData) {
    try {
      // Analizar el vendedor
      const sellerScore = await this.analyzeSellerPotential(productData.seller);
      
      // Analizar el producto
      const productScore = this.analyzeProductPotential(productData);

      // Calcular score total
      const totalScore = Math.round(((sellerScore + productScore) / 2) * 10) / 10;

      // Crear lead si cumple criterios
      if (totalScore >= 5) {
        const lead = await this.Lead.create({
          source: 'mercadolibre',
          productId: this.generateProductId(productData),
          sellerInfo: {
            name: productData.seller,
            rating: sellerScore
          },
          productInfo: {
            title: productData.title,
            price: this.extractNumericPrice(productData.price),
            condition: productData.condition
          },
          potential: {
            score: totalScore,
            factors: this.getScoreFactors(totalScore, productData)
          },
          status: 'new',
          createdAt: new Date()
        });

        return {
          leadId: lead._id,
          score: totalScore,
          recommendation: this.getRecommendation(totalScore)
        };
      }

      return null;
    } catch (error) {
      logger.error('Error generando lead:', error);
      throw error;
    }
  }

  async analyzeSellerPotential(sellerName) {
    try {
      // Mejorar análisis del vendedor
      let score = 5; // Score base

      // Ajustar score según características
      if (sellerName.toLowerCase().includes('oficial')) score += 2;
      if (sellerName.toLowerCase().includes('tienda')) score += 1;
      
      // Normalizar score entre 0 y 10
      return Math.min(Math.max(score, 0), 10);
    } catch (error) {
      logger.error('Error analizando vendedor:', error);
      return 5; // Score por defecto
    }
  }

  analyzeProductPotential(productData) {
    try {
      let score = 5; // Score base

      // Análisis de precio
      const price = this.extractNumericPrice(productData.price);
      if (price >= 1500) score += 2;
      else if (price >= 1000) score += 1;

      // Análisis de modelo
      if (productData.title.includes('Pro Max')) score += 2;
      else if (productData.title.includes('Pro')) score += 1;

      // Análisis de condición
      if (productData.condition === 'new') score += 1;

      // Normalizar score
      return Math.min(Math.max(score, 0), 10);
    } catch (error) {
      logger.error('Error analizando producto:', error);
      return 5;
    }
  }

  getScoreFactors(score, productData) {
    const factors = [];
    const price = this.extractNumericPrice(productData.price);

    if (score >= 9) factors.push('ALTO_POTENCIAL');
    if (price >= 1000) factors.push('ALTO_VALOR');
    if (productData.title.includes('Pro Max')) factors.push('GAMA_ALTA');
    if (productData.condition === 'new') factors.push('PRODUCTO_NUEVO');

    return factors;
  }

  getRecommendation(score) {
    if (score >= 9) return '🔥 CONTACTAR_INMEDIATAMENTE';
    if (score >= 7) return '👀 MONITOREAR_ACTIVAMENTE';
    if (score >= 5) return '📊 ANALIZAR_OPORTUNIDAD';
    return '⏳ BAJA_PRIORIDAD';
  }

  extractNumericPrice(priceStr) {
    return parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  }

  generateProductId(productData) {
    // Generar un ID único basado en título y timestamp
    return `${productData.title}-${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }
}

module.exports = new LeadGenerator(); 