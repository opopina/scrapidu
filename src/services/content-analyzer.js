const { OpenAI } = require('openai');
const logger = require('../utils/logger');

class ContentAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async analyze(scrapedData) {
    try {
      const prompt = `Analiza el siguiente contenido web y extrae información relevante:
      ${JSON.stringify(scrapedData, null, 2)}
      
      Por favor, identifica y clasifica:
      1. Tema principal del sitio
      2. Productos o servicios ofrecidos
      3. Información de contacto
      4. Características destacadas
      5. Público objetivo`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      });

      return {
        ...scrapedData,
        analysis: JSON.parse(response.choices[0].message.content)
      };
    } catch (error) {
      logger.error('Error analizando contenido:', error);
      return scrapedData;
    }
  }
}

module.exports = new ContentAnalyzer(); 