const { app, BrowserWindow } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const winston = require('winston');
const { runTestCase } = require('./runTests');
const fs = require('fs').promises;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/electron.log' }),
    new winston.transports.Console()
  ]
});

let mainWindow;
let ws;
let clientId;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function connectWebSocket() {
  ws = new WebSocket('ws://localhost:8080');
  logger.info('Attempting to connect to Node server');

  ws.on('open', () => {
    logger.info('Connected to Node server');
    ws.send(JSON.stringify({ type: 'register-electron' }));
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      logger.info(`Received message: ${JSON.stringify(data)}`);

      if (data.type === 'registration') {
        clientId = data.clientId;
        logger.info(`Registered with ID: ${clientId}`);
        mainWindow.webContents.send('client-id', clientId);
      } else if (data.type === 'run-test') {
        logger.info('Running test case');
        const report = await runTestCase(data.testCase);
        const reportPath = path.join(__dirname, 'report.json');
        await fs.writeFile(reportPath, JSON.stringify(report));
        logger.info('Test report saved locally');

        ws.send(JSON.stringify({ type: 'test-result', result: report }));
        logger.info('Test report sent to Node server');

        await fs.unlink(reportPath);
        logger.info('Local test report deleted');
      }
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`);
    }
  });

  ws.on('close', () => {
    logger.info('Disconnected from Node server');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error: ${error.message}`);
  });
}

app.on('ready', () => {
  createWindow();
  connectWebSocket();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});