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
        logger.info(`Running test case: ${data.testCase.name}`);
        
        try {
          // Create a unique directory for this test
          const testDir = path.join(__dirname, 'test_' + Date.now());
          await fs.mkdir(testDir, { recursive: true });
          
          // Save the test file content to the test directory
          const testFilePath = path.join(testDir, data.testCase.name);
          await fs.writeFile(testFilePath, data.testCase.content);
          logger.info(`Test file saved at: ${testFilePath}`);
          
          // Run the test case
          const report = await runTestCase(data.testCase, testFilePath);
          
          // Save the report locally
          const reportPath = path.join(testDir, 'report.json');
          await fs.writeFile(reportPath, JSON.stringify(report));
          logger.info('Test report saved locally');

          // Send the report back to the Node server with clientId
          ws.send(JSON.stringify({ 
            type: 'test-result', 
            result: report,
            clientId: clientId
          }));
          logger.info('Test report sent to Node server');

          // Clean up temporary files
          try {
            const files = await fs.readdir(testDir);
            for (const file of files) {
              await fs.unlink(path.join(testDir, file));
            }
            await fs.rmdir(testDir);
            logger.info(`Cleaned up test directory: ${testDir}`);
          } catch (cleanupError) {
            logger.error(`Error cleaning up test directory: ${cleanupError.message}`);
          }
        } catch (error) {
          logger.error(`Error processing test case: ${error.message}`);
          // Send error report back to Node server
          ws.send(JSON.stringify({ 
            type: 'test-result', 
            result: {
              name: data.testCase.name,
              status: 'failed',
              error: `Error processing test case: ${error.message}`,
              output: error.stack || ''
            },
            clientId: clientId
          }));
        }
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

app.on('ready', async () => {
  // Create logs directory if it doesn't exist
  try {
    await fs.mkdir('logs', { recursive: true });
    logger.info('Logs directory created or already exists');
  } catch (error) {
    logger.error(`Error creating logs directory: ${error.message}`);
  }
  
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