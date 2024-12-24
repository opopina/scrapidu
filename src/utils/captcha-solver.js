const Captcha = require('2captcha');
const logger = require('./logger');

class CaptchaSolver {
  constructor() {
    this.solver = new Captcha.Solver(process.env.CAPTCHA_API_KEY);
  }

  async solve(page) {
    try {
      // Detectar el tipo de CAPTCHA
      const captchaType = await this.detectCaptchaType(page);
      
      switch(captchaType) {
        case 'recaptcha':
          return await this.solveRecaptcha(page);
        case 'hcaptcha':
          return await this.solveHCaptcha(page);
        default:
          throw new Error('Tipo de CAPTCHA no soportado');
      }
    } catch (error) {
      logger.error(`Error resolviendo CAPTCHA: ${error.message}`);
      throw error;
    }
  }

  async detectCaptchaType(page) {
    return await page.evaluate(() => {
      if (document.querySelector('.g-recaptcha')) return 'recaptcha';
      if (document.querySelector('.h-captcha')) return 'hcaptcha';
      return 'unknown';
    });
  }

  async solveRecaptcha(page) {
    try {
      const siteKey = await page.evaluate(() => 
        document.querySelector('.g-recaptcha').getAttribute('data-sitekey')
      );
      
      const result = await this.solver.recaptcha({
        sitekey: siteKey,
        url: page.url()
      });

      await page.evaluate(`document.getElementById('g-recaptcha-response').innerHTML='${result.data}';`);
      return result;
    } catch (error) {
      logger.error(`Error en solveRecaptcha: ${error.message}`);
      throw error;
    }
  }

  async solveHCaptcha(page) {
    try {
      const siteKey = await page.evaluate(() => 
        document.querySelector('.h-captcha').getAttribute('data-sitekey')
      );
      
      const result = await this.solver.hcaptcha({
        sitekey: siteKey,
        url: page.url()
      });

      await page.evaluate(`document.getElementsByName('h-captcha-response')[0].innerHTML='${result.data}';`);
      return result;
    } catch (error) {
      logger.error(`Error en solveHCaptcha: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CaptchaSolver; 