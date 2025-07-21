const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

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

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map(); // Store Electron clients with their IDs
let flaskClient = null;

wss.on('connection', (ws) => {
  logger.info('New connection established');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      logger.info(`Received message: ${JSON.stringify(data)}`);

      if (data.type === 'register-electron') {
        const clientId = uuidv4();
        clients.set(clientId, ws);
        ws.send(JSON.stringify({ type: 'registration', clientId }));
        logger.info(`Electron client registered with ID: ${clientId}`);
      } else if (data.type === 'register-flask') {
        flaskClient = ws;
        logger.info('Flask backend registered');
      } else if (data.type === 'test-case') {
        const { clientId, testCase } = data;
        const electronClient = clients.get(clientId);
        if (electronClient) {
          electronClient.send(JSON.stringify({ type: 'run-test', testCase }));
          logger.info(`Sent test case to Electron client ${clientId}`);
        } else {
          logger.error(`Electron client ${clientId} not found`);
          if (flaskClient) {
            flaskClient.send(JSON.stringify({ type: 'error', message: `Electron client ${clientId} not found` }));
          }
        }
      } else if (data.type === 'test-result') {
        if (flaskClient) {
          flaskClient.send(JSON.stringify({ type: 'test-result', result: data.result }));
          logger.info('Sent test result to Flask backend');
        } else {
          logger.error('Flask backend not connected');
        }
      }
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`);
    }
  });

  ws.on('close', () => {
    logger.info('Connection closed');
    for (const [clientId, client] of clients) {
      if (client === ws) {
        clients.delete(clientId);
        logger.info(`Electron client ${clientId} disconnected`);
        break;
      }
    }
    if (ws === flaskClient) {
      flaskClient = null;
      logger.info('Flask backend disconnected');
    }
  });
});

logger.info('Node WebSocket server running on ws://localhost:8080');