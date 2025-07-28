const WebSocket = require('ws');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/node-server.log' }),
    new winston.transports.Console()
  ]
});

// Create logs directory
async function ensureLogsDir() {
  try {
    await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
    logger.info('Logs directory created or already exists');
  } catch (err) {
    logger.error(`Error creating logs directory: ${err.message}`);
  }
}

const wss = new WebSocket.Server({ port: 8080 });
logger.info('Node WebSocket server running on ws://localhost:8080');

const clients = new Map();
const flaskClient = new Set();
const clientState = new Map();

wss.on('connection', (ws) => {
  logger.info('New connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      logger.info(`Received message: ${JSON.stringify(data)}`);

      if (data.type === 'register-electron') {
        const clientId = Math.random().toString(36).substring(2, 15);
        clients.set(clientId, ws);
        clientState.set(clientId, { busy: false, queue: [] });
        ws.send(JSON.stringify({ type: 'registration', clientId }));
        logger.info(`Electron client registered with ID: ${clientId}`);
      } else if (data.type === 'register-flask') {
        flaskClient.add(ws);
        logger.info('Flask backend registered');
      } else if (data.type === 'test-case') {
        const clientId = data.clientId;
        const client = clients.get(clientId);
        if (!client) {
          logger.error(`No client found for ID: ${clientId}`);
          return;
        }

        const state = clientState.get(clientId);
        state.queue.push(data.testCase);
        logger.info(`Queued test case ${data.testCase.name} for client ${clientId}`);

        if (!state.busy) {
          sendNextTest(clientId);
        }
      } else if (data.type === 'test-result') {
        const clientId = data.clientId;
        const state = clientState.get(clientId);
        state.busy = false;

        flaskClient.forEach((flaskWs) => {
          flaskWs.send(JSON.stringify({
            type: 'test-result',
            result: data.result
          }));
          logger.info('Sent test result to Flask backend');
        });

        logger.info(`Client state for ${clientId}: ${JSON.stringify(state)}`);
        sendNextTest(clientId);
      }
    } catch (err) {
      logger.error(`Error processing message: ${err.message}`);
    }
  });

  ws.on('close', () => {
    logger.info('Connection closed');
    for (const [clientId, clientWs] of clients) {
      if (clientWs === ws) {
        clients.delete(clientId);
        clientState.delete(clientId);
        logger.info(`Client ${clientId} disconnected`);
        break;
      }
    }
    flaskClient.delete(ws);
  });
});

function sendNextTest(clientId) {
  const state = clientState.get(clientId);
  if (!state || state.queue.length === 0) {
    logger.info(`No more tests in queue for client ${clientId}, marked as not busy`);
    state.busy = false;
    return;
  }

  if (!state.busy) {
    const testCase = state.queue.shift();
    const client = clients.get(clientId);
    if (client) {
      state.busy = true;
      client.send(JSON.stringify({
        type: 'run-test',
        testCase,
        clientId
      }));
      logger.info(`Sent test case ${testCase.name} (framework: ${testCase.framework}) to Electron client ${clientId}`);
    }
  }
}

ensureLogsDir();