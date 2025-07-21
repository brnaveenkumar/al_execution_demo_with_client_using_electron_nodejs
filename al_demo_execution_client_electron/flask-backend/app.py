from flask import Flask, request, jsonify
from flask_cors import CORS
import websocket
import json
import os
from datetime import datetime
import logging
import asyncio
import threading

# Logger setup
os.makedirs('logs', exist_ok=True)
log_file = 'logs/flask.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS

ws = None
test_results = []

def on_message(ws, message):
    logger.info(f"Received message from Node: {message}")
    try:
        data = json.loads(message)
        if data['type'] == 'test-result':
            result = data['result']
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            report_path = f"reports/report_{result['name']}_{timestamp}.json"
            with open(report_path, 'w') as f:
                json.dump(result, f)
            logger.info(f"Test report saved at {report_path}")
            test_results.append(result)
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")

def on_error(ws, error):
    logger.error(f"WebSocket error: {str(error)}")

def on_close(ws, close_status_code, close_msg):
    logger.info("WebSocket connection closed")
    ws = None

def on_open(ws):
    logger.info("Connected to Node server")
    ws.send(json.dumps({'type': 'register-flask'}))

def connect_websocket():
    global ws
    ws = websocket.WebSocketApp("ws://localhost:8080",
                                on_open=on_open,
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close)
    ws.run_forever()

def start_websocket():
    threading.Thread(target=connect_websocket, daemon=True).start()

@app.route('/execute', methods=['POST'])
def execute_tests():
    data = request.json
    browser = data.get('browser')
    client_id = data.get('clientId')
    logger.info(f"Received execute request: browser={browser}, clientId={client_id}")

    test_cases = [
        {'name': 'test_google_search', 'browser': browser},
        {'name': 'test_wikipedia', 'browser': browser}
    ]

    global test_results
    test_results = []

    async def send_test_cases():
        for test_case in test_cases:
            if ws:
                ws.send(json.dumps({'type': 'test-case', 'clientId': client_id, 'testCase': test_case}))
                logger.info(f"Sent test case {test_case['name']} to Node server")
                await asyncio.sleep(5)  # Wait for test to complete
            else:
                logger.error("WebSocket not connected")
                return {'status': 'error', 'message': 'WebSocket not connected'}

        # Wait for all results
        while len(test_results) < len(test_cases):
            await asyncio.sleep(1)

        return {'status': 'success', 'results': test_results}

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(send_test_cases())
    loop.close()

    return jsonify(result)

if __name__ == '__main__':
    os.makedirs('reports', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    start_websocket()
    app.run(port=5000)