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
const clientStates = new Map(); // Store client states (busy, queue)
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
          // Check if the client is busy running a test
          const clientState = clientStates.get(clientId) || { busy: false };
          
          if (clientState.busy) {
            // Queue the test case
            if (!clientState.queue) {
              clientState.queue = [];
            }
            clientState.queue.push(testCase);
            logger.info(`Client ${clientId} is busy, queued test case ${testCase.name}`);
          } else {
            // Mark client as busy and send the test case
            clientState.busy = true;
            clientStates.set(clientId, clientState);
            
            // Forward the test case with content to Electron client
            electronClient.send(JSON.stringify({ type: 'run-test', testCase }));
            logger.info(`Sent test case ${testCase.name} to Electron client ${clientId}`);
          }
        } else {
          logger.error(`Electron client ${clientId} not found`);
          if (flaskClient) {
            flaskClient.send(JSON.stringify({ 
              type: 'error', 
              message: `Electron client ${clientId} not found`,
              testCase: testCase.name
            }));
          }
        }
      } else if (data.type === 'test-result') {
        if (flaskClient) {
          flaskClient.send(JSON.stringify({ type: 'test-result', result: data.result }));
          logger.info('Sent test result to Flask backend');
          
          // Check if there are more tests in the queue for this client
          const clientId = data.clientId;
          if (clientId) {
            const clientState = clientStates.get(clientId);
            logger.info(`Client state for ${clientId}: ${JSON.stringify(clientState)}`);
            
            if (clientState && clientState.queue && clientState.queue.length > 0) {
              // Get the next test from the queue
              const nextTest = clientState.queue.shift();
              logger.info(`Processing next test from queue: ${nextTest.name}, remaining: ${clientState.queue.length}`);
              
              // Send the next test to the client
              const electronClient = clients.get(clientId);
              if (electronClient) {
                // Add a longer delay to ensure the previous test is fully completed
                setTimeout(() => {
                  electronClient.send(JSON.stringify({ type: 'run-test', testCase: nextTest }));
                  logger.info(`Sent next test case ${nextTest.name} to Electron client ${clientId}`);
                }, 5000);
              }
            } else {
              // No more tests in the queue, mark client as not busy
              if (clientState) {
                clientState.busy = false;
                clientStates.set(clientId, clientState);
                logger.info(`No more tests in queue for client ${clientId}, marked as not busy`);
              }
            }
          }
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