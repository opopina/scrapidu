const axios = require('axios');
require('dotenv').config();

async function testAPI() {
  try {
    // Test 1: Health Check
    console.log('\n🏥 Probando Health Check...');
    const health = await axios.get('http://localhost:3000/health');
    console.log('Health Check:', health.data);

    // Test 2: Scraping simple
    console.log('\n🕷️ Probando Scraping...');
    const scrapeResponse = await axios.post('http://localhost:3000/api/scrape', {
      urls: ['https://example.com'],
      config: {
        selectors: {
          title: 'h1',
          description: 'p'
        }
      }
    }, {
      headers: {
        'x-api-key': process.env.API_KEY
      }
    });
    console.log('Resultado Scraping:', scrapeResponse.data);

    // Test 3: Webhook n8n
    console.log('\n🔄 Probando Webhook n8n...');
    const webhookResponse = await axios.post('http://localhost:3000/webhook/n8n', {
      workflow: 'new_products',
      data: {
        products: [{
          url: 'https://example.com',
          selectors: {
            title: 'h1',
            price: '.price'
          }
        }]
      }
    });
    console.log('Resultado Webhook:', webhookResponse.data);

    console.log('\n✅ Todas las pruebas completadas exitosamente!');
  } catch (error) {
    console.error('\n❌ Error en las pruebas:', error.response?.data || error.message);
  }
}

testAPI(); 