const { ipcRenderer } = require('electron');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/renderer.log' }),
    new winston.transports.Console()
  ]
});

ipcRenderer.on('client-id', (event, clientId) => {
  logger.info(`Received client ID: ${clientId}`);
  document.getElementById('client-id').textContent = `Client ID: ${clientId}`;
});