const mongoose = require('mongoose');
const logger = require('../utils/logger');

class CompetitiveAnalyzer {
  constructor() {
    this.competitorSchema = new mongoose.Schema({
      name: String,
      products: [{
        id: String,
        title: String,
        price: Number,
        date: Date
      }],
      metrics: {
        marketShare: Number,
        pricePosition: String,
        strengths: [String],
        weaknesses: [String]
      }
    });

    this.Competitor = mongoose.model('Competitor', this.competitorSchema);
  }

  async analyzeCompetition(productData) {
    try {
      // Análisis de competidores
      const competitors = await this.findCompetitors(productData);
      
      // Análisis de precios
      const priceAnalysis = await this.analyzePrices(competitors);
      
      // Análisis de mercado
      const marketAnalysis = this.analyzeMarket(competitors);

      // Generar recomendaciones
      const recommendations = this.generateRecommendations(productData, priceAnalysis, marketAnalysis);

      return {
        competitors: competitors.length,
        pricePosition: this.calculatePricePosition(productData.price, priceAnalysis),
        marketShare: await this.calculateMarketShare(productData),
        strengths: this.identifyStrengths(productData, competitors),
        weaknesses: this.identifyWeaknesses(productData, competitors),
        recommendations
      };
    } catch (error) {
      logger.error('Error en análisis competitivo:', error);
      throw error;
    }
  }

  async findCompetitors(productData) {
    try {
      // Extraer modelo y capacidad del título
      const modelMatch = productData.title.match(/iPhone\s+(\d+)\s*(Pro|Pro Max)?/i);
      const storageMatch = productData.title.match(/(\d+)\s*GB/i);
      
      if (!modelMatch) return [];

      const model = modelMatch[1];
      const variant = modelMatch[2] || '';
      const storage = storageMatch ? storageMatch[1] : '';

      // Buscar productos similares y competidores
      const competitors = await this.Competitor.find({
        $or: [
          // Mismo modelo
          {
            'products.title': {
              $regex: `iPhone\\s*${model}\\s*${variant}.*${storage}\\s*GB`,
              $options: 'i'
            }
          },
          // Modelo anterior
          {
            'products.title': {
              $regex: `iPhone\\s*${parseInt(model)-1}\\s*${variant}.*${storage}\\s*GB`,
              $options: 'i'
            }
          },
          // Modelo siguiente
          {
            'products.title': {
              $regex: `iPhone\\s*${parseInt(model)+1}\\s*${variant}.*${storage}\\s*GB`,
              $options: 'i'
            }
          },
          // Misma gama diferente almacenamiento
          {
            'products.title': {
              $regex: `iPhone\\s*${model}\\s*${variant}`,
              $options: 'i'
            }
          }
        ]
      }).limit(10);

      // Guardar este producto como competidor
      const newCompetitor = new this.Competitor({
        name: productData.seller || 'Tienda oficial',
        products: [{
          id: this.generateProductId(productData),
          title: productData.title,
          price: this.extractNumericPrice(productData.price),
          date: new Date()
        }]
      });
      await newCompetitor.save();

      return [newCompetitor, ...competitors];
    } catch (error) {
      logger.error('Error buscando competidores:', error);
      return [];
    }
  }

  generateProductId(productData) {
    return `${productData.title}-${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '-');
  }

  extractKeywords(title) {
    // Extraer palabras clave del título
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => 
        word.length > 3 && 
        !['with', 'para', 'desde', 'hasta'].includes(word)
      );
  }

  extractNumericPrice(priceStr) {
    if (!priceStr) return 0;
    return parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));
  }

  async analyzePrices(competitors) {
    try {
      const prices = competitors
        .flatMap(c => c.products)
        .map(p => p.price)
        .filter(p => p > 0);

      return {
        averagePrice: this.calculateAverage(prices),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        priceRange: Math.max(...prices) - Math.min(...prices),
        competitorCount: prices.length
      };
    } catch (error) {
      logger.error('Error analizando precios:', error);
      return {
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceRange: 0,
        competitorCount: 0
      };
    }
  }

  analyzeMarket(competitors) {
    try {
      const totalProducts = competitors.reduce((sum, c) => sum + c.products.length, 0);
      const recentProducts = competitors
        .flatMap(c => c.products)
        .filter(p => {
          const productDate = new Date(p.date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return productDate >= thirtyDaysAgo;
        });

      return {
        trend: recentProducts.length > totalProducts * 0.3 ? 'CRECIENTE' : 'ESTABLE',
        competitorCount: competitors.length,
        totalProducts,
        recentProducts: recentProducts.length
      };
    } catch (error) {
      logger.error('Error analizando mercado:', error);
      return {
        trend: 'ERROR',
        competitorCount: 0,
        totalProducts: 0,
        recentProducts: 0
      };
    }
  }

  calculateAverage(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  calculatePricePosition(price, priceAnalysis) {
    if (!price || !priceAnalysis.averagePrice) return 'NO_DETERMINADO';

    const priceDiff = ((price - priceAnalysis.averagePrice) / priceAnalysis.averagePrice) * 100;

    if (priceDiff <= -15) return 'PRECIO_BAJO';
    if (priceDiff <= -5) return 'COMPETITIVO_BAJO';
    if (priceDiff >= 15) return 'PRECIO_ALTO';
    if (priceDiff >= 5) return 'COMPETITIVO_ALTO';
    return 'PRECIO_OPTIMO';
  }

  async calculateMarketShare(productData) {
    // Implementar cálculo de cuota de mercado
    return 0;
  }

  identifyStrengths(productData, competitors) {
    // Implementar identificación de fortalezas
    return [];
  }

  identifyWeaknesses(productData, competitors) {
    // Implementar identificación de debilidades
    return [];
  }

  generateRecommendations(productData, priceAnalysis, marketAnalysis) {
    const recommendations = [];
    const price = this.extractNumericPrice(productData.price);
    const position = this.calculatePricePosition(price, priceAnalysis);

    // Recomendaciones basadas en precio
    switch (position) {
      case 'PRECIO_ALTO':
        recommendations.push('⚠️ Precio significativamente alto - Riesgo de perder ventas');
        if (marketAnalysis.competitorCount > 3) {
          recommendations.push('🔄 Alta competencia - Considerar ajuste de precio');
        }
        break;
      case 'COMPETITIVO_ALTO':
        if (marketAnalysis.trend === 'CRECIENTE') {
          recommendations.push('📈 Precio óptimo en mercado creciente');
        } else {
          recommendations.push('📉 Considerar ajuste para mayor competitividad');
        }
        break;
      case 'PRECIO_OPTIMO':
        recommendations.push('✅ Precio óptimo para el mercado actual');
        if (marketAnalysis.competitorCount < 3) {
          recommendations.push('💡 Baja competencia - Oportunidad de mercado');
        }
        break;
      case 'COMPETITIVO_BAJO':
        recommendations.push('💡 Oportunidad de incrementar margen manteniendo competitividad');
        break;
      case 'PRECIO_BAJO':
        recommendations.push('⚠️ Precio significativamente bajo - Posible pérdida de margen');
        break;
    }

    // Recomendaciones de mercado
    if (marketAnalysis.trend === 'CRECIENTE') {
      recommendations.push('📊 Mercado en crecimiento - Considerar aumentar inventario');
    }

    // Recomendaciones de stock
    if (!productData.stock || productData.stock === 'Stock no especificado') {
      recommendations.push('📦 Agregar información de stock para mejorar visibilidad');
    }

    return recommendations;
  }
}

module.exports = new CompetitiveAnalyzer(); 