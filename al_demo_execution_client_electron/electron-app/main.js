const { app, BrowserWindow, ipcMain } = require('electron');
const WebSocket = require('ws');
const path = require('path');
const { runTestCase } = require('./runTests');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/main.log' }),
    new winston.transports.Console()
  ]
});

// Create logs directory
async function ensureLogsDir() {
  try {
    await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
    logger.info('Logs directory created or already exists');
  } catch (err) {
    logger.error(`Failed to create logs directory: ${err.message}`);
  }
}

// Create the main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  return mainWindow;
}

// Dependency check and installation
async function checkAndInstallDependencies(mainWindow) {
  const sendStatus = (message, type = 'info') => {
    mainWindow.webContents.send('dependency-status', { message, type });
    logger.info(message);
  };

  // Check for Python
  sendStatus('Checking for Python...');
  let pythonCommand = 'python';
  try {
    const pythonCheck = await new Promise((resolve, reject) => {
      const process = spawn(pythonCommand, ['--version']);
      let output = '';
      process.stdout.on('data', (data) => output += data.toString());
      process.stderr.on('data', (data) => output += data.toString());
      process.on('close', (code) => resolve({ code, output }));
      process.on('error', (err) => reject(err));
    });

    if (pythonCheck.code === 0) {
      sendStatus(`Python found: ${pythonCheck.output.trim()}`, 'success');
    } else {
      sendStatus(`Python check failed: ${pythonCheck.output.trim()}`, 'error');
      throw new Error('Python not found');
    }
  } catch (err) {
    pythonCommand = 'python3';
    try {
      const python3Check = await new Promise((resolve, reject) => {
        const process = spawn(pythonCommand, ['--version']);
        let output = '';
        process.stdout.on('data', (data) => output += data.toString());
        process.stderr.on('data', (data) => output += data.toString());
        process.on('close', (code) => resolve({ code, output }));
        process.on('error', (err) => reject(err));
      });

      if (python3Check.code === 0) {
        sendStatus(`Python found: ${python3Check.output.trim()}`, 'success');
      } else {
        sendStatus('Python not found. Please install Python manually and add it to PATH.', 'error');
        throw new Error('Python not found');
      }
    } catch (err) {
      sendStatus('Python not found. Please install Python manually and add it to PATH.', 'error');
      throw err;
    }
  }

  // Check and install Python packages
  const requiredPackages = ['selenium', 'webdriver-manager', 'robotframework', 'robotframework-seleniumlibrary'];
  for (const pkg of requiredPackages) {
    sendStatus(`Checking for ${pkg}...`);
    try {
      const pipList = await new Promise((resolve, reject) => {
        const process = spawn(pythonCommand, ['-m', 'pip', 'list']);
        let output = '';
        process.stdout.on('data', (data) => output += data.toString());
        process.stderr.on('data', (data) => output += data.toString());
        process.on('close', (code) => resolve({ code, output }));
        process.on('error', (err) => reject(err));
      });

      if (pipList.code === 0 && pipList.output.includes(pkg)) {
        sendStatus(`${pkg} is already installed, moving to next step`, 'success');
      } else {
        sendStatus(`${pkg} not found, installing latest version...`, 'info');
        const pipInstall = await new Promise((resolve, reject) => {
          const process = spawn(pythonCommand, ['-m', 'pip', 'install', pkg, '--upgrade']);
          let output = '';
          process.stdout.on('data', (data) => output += data.toString());
          process.stderr.on('data', (data) => output += data.toString());
          process.on('close', (code) => resolve({ code, output }));
          process.on('error', (err) => reject(err));
        });

        if (pipInstall.code === 0) {
          sendStatus(`Successfully installed ${pkg}`, 'success');
        } else {
          sendStatus(`Failed to install ${pkg}: ${pipInstall.output}`, 'error');
          throw new Error(`Failed to install ${pkg}`);
        }
      }
    } catch (err) {
      sendStatus(`Error checking/installing ${pkg}: ${err.message}`, 'error');
      throw err;
    }
  }

  sendStatus('All dependencies installed, ready to execute tests', 'success');
  return pythonCommand;
}

// WebSocket connection and test execution
async function connectWebSocket(mainWindow, pythonCommand) {
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.on('open', () => {
    logger.info('Connected to Node server');
    mainWindow.webContents.send('dependency-status', {
      message: 'Client connected to Node server',
      type: 'success'
    });
    ws.send(JSON.stringify({ type: 'register-electron' }));
  });

  ws.on('message', async (data) => {
    const message = JSON.parse(data);
    logger.info(`Received message: ${JSON.stringify(message)}`);

    if (message.type === 'registration') {
      logger.info(`Registered with ID: ${message.clientId}`);
      mainWindow.webContents.send('dependency-status', {
        message: `Registered with Node server, Client ID: ${message.clientId}`,
        type: 'success'
      });
    } else if (message.type === 'run-test') {
      const testCase = message.testCase;
      logger.info(`Running test case: ${testCase.name}`);
      mainWindow.webContents.send('dependency-status', {
        message: `Running test case: ${testCase.name}`,
        type: 'info'
      });

      const testDir = path.join(__dirname, 'test_' + Date.now());
      await fs.mkdir(testDir, { recursive: true });
      const testFilePath = path.join(testDir, testCase.name);
      await fs.writeFile(testFilePath, testCase.content);
      logger.info(`Test file saved at: ${testFilePath}`);

      const report = await runTestCase(testCase, testFilePath);
      report.screenshots = report.screenshots || {};
      
      try {
        await fs.rm(testDir, { recursive: true, force: true });
        logger.info(`Cleaned up test directory: ${testDir}`);
      } catch (err) {
        logger.error(`Error cleaning up test directory: ${err.message}`);
      }

      logger.info('Test report saved locally');
      ws.send(JSON.stringify({
        type: 'test-result',
        result: report,
        clientId: message.clientId
      }));
      logger.info('Test report sent to Node server');
      mainWindow.webContents.send('dependency-status', {
        message: `Test case ${testCase.name} completed with status: ${report.status}`,
        type: report.status === 'passed' ? 'success' : 'error'
      });
    }
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err.message}`);
    mainWindow.webContents.send('dependency-status', {
      message: `WebSocket error: ${err.message}`,
      type: 'error'
    });
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
    mainWindow.webContents.send('dependency-status', {
      message: 'WebSocket connection closed, attempting to reconnect...',
      type: 'info'
    });
    setTimeout(() => connectWebSocket(mainWindow, pythonCommand), 5000);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await ensureLogsDir();
  const mainWindow = createWindow();

  try {
    const pythonCommand = await checkAndInstallDependencies(mainWindow);
    await connectWebSocket(mainWindow, pythonCommand);
  } catch (err) {
    logger.error(`Failed to initialize: ${err.message}`);
    mainWindow.webContents.send('dependency-status', {
      message: `Initialization failed: ${err.message}`,
      type: 'error'
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});