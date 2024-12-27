const winston = require('winston');
const chalk = require('chalk');

// Formato personalizado para consola
const consoleFormat = winston.format.printf(({ level, message, timestamp, jobId }) => {
  const ts = new Date(timestamp).toLocaleTimeString();
  
  switch(level) {
    case 'info':
      if (message.includes('completado')) {
        return chalk.green(`[${ts}] ✓ Job ${jobId}: ${message}`);
      }
      return chalk.blue(`[${ts}] ℹ ${message}`);
    
    case 'warn':
      return chalk.yellow(`[${ts}] ⚠ ${message}`);
    
    case 'error':
      if (message.includes('Navigation timeout')) {
        return chalk.red(`[${ts}] ⏱ Timeout en ${jobId || 'job'}: ${message}`);
      }
      return chalk.red(`[${ts}] ✖ ${message}`);
    
    default:
      return `[${ts}] ${message}`;
  }
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        consoleFormat
      )
    })
  ]
});

// Agregar método para mostrar estado de jobs
logger.showJobStatus = (activeJobs, completedJobs, failedJobs) => {
  console.log('\n' + chalk.cyan('Estado actual de jobs:'));
  console.log(chalk.blue(`⚡ Activos: ${activeJobs.length}`));
  console.log(chalk.green(`✓ Completados: ${completedJobs.length}`));
  console.log(chalk.red(`✖ Fallidos: ${failedJobs.length}`));
  console.log(''); // Línea en blanco para separar
};

module.exports = logger; 