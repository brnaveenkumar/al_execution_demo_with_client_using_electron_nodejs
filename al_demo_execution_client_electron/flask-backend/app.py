from flask import Flask, request, jsonify
from flask_cors import CORS
from websocket import WebSocketApp
import json
import os
import base64
from datetime import datetime
import logging
import asyncio
import threading
import time
from webdriver_manager.chrome import ChromeDriverManager

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
            
            # Save screenshots separately if they exist
            if 'screenshots' in result and result['screenshots']:
                screenshots_dir = os.path.join('reports', 'screenshots')
                os.makedirs(screenshots_dir, exist_ok=True)
                
                for name, data in result['screenshots'].items():
                    screenshot_path = os.path.join(screenshots_dir, f"{result['name']}_{timestamp}_{name}")
                    try:
                        with open(screenshot_path, 'wb') as f:
                            f.write(base64.b64decode(data))
                        logger.info(f"Screenshot saved at {screenshot_path}")
                    except Exception as e:
                        logger.error(f"Error saving screenshot {name}: {str(e)}")
            
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
    try:
        ws = WebSocketApp("ws://localhost:8080",
                         on_open=on_open,
                         on_message=on_message,
                         on_error=on_error,
                         on_close=on_close)
        ws.run_forever()
    except Exception as e:
        logger.error(f"Failed to connect to WebSocket server: {str(e)}")
        ws = None

def start_websocket():
    def run_websocket():
        while True:
            try:
                connect_websocket()
                time.sleep(5)  # Wait before attempting to reconnect
            except Exception as e:
                logger.error(f"WebSocket connection error: {str(e)}")
                time.sleep(5)  # Wait before attempting to reconnect

    threading.Thread(target=run_websocket, daemon=True).start()

@app.route('/reports', methods=['GET'])
def get_reports():
    reports_dir = 'reports'
    if not os.path.exists(reports_dir):
        return jsonify({
            "status": "error",
            "message": "No reports found"
        }), 404
    
    # Only include files that start with 'report_' and end with '.json'
    report_files = [f for f in os.listdir(reports_dir) if f.startswith('report_') and f.endswith('.json')]
    reports = []
    
    for report_file in report_files:
        try:
            with open(os.path.join(reports_dir, report_file), 'r') as f:
                report_data = json.load(f)
                # Extract timestamp from filename or use data timestamp
                timestamp = None
                if 'timestamp' in report_data:
                    timestamp = report_data['timestamp']
                else:
                    # Try to extract timestamp from filename
                    parts = report_file.split('_')
                    if len(parts) > 1:
                        try:
                            timestamp = parts[-1].replace('.json', '')
                        except:
                            timestamp = '00000000_000000'  # Default timestamp
                
                reports.append({
                    "filename": report_file,
                    "timestamp": timestamp,
                    "data": report_data
                })
        except Exception as e:
            logger.error(f"Error reading report {report_file}: {str(e)}")
    
    # Sort reports by timestamp (newest first)
    reports.sort(key=lambda x: x.get('timestamp', '00000000_000000'), reverse=True)
    
    return jsonify({
        "status": "success",
        "reports": reports
    })

@app.route('/reports/<filename>', methods=['GET'])
def get_report(filename):
    report_path = os.path.join('reports', filename)
    if not os.path.exists(report_path):
        return jsonify({
            "status": "error",
            "message": f"Report {filename} not found"
        }), 404
    
    try:
        with open(report_path, 'r') as f:
            report_data = json.load(f)
        return jsonify({
            "status": "success",
            "report": report_data
        })
    except Exception as e:
        logger.error(f"Error reading report {filename}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error reading report: {str(e)}"
        }), 500

@app.route('/reports/delete-all', methods=['POST'])
def delete_all_reports():
    reports_dir = 'reports'
    screenshots_dir = os.path.join(reports_dir, 'screenshots')
    deleted_count = 0
    
    try:
        # Delete all report files
        if os.path.exists(reports_dir):
            for filename in os.listdir(reports_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(reports_dir, filename)
                    os.remove(file_path)
                    deleted_count += 1
        
        # Delete all screenshots
        if os.path.exists(screenshots_dir):
            for filename in os.listdir(screenshots_dir):
                file_path = os.path.join(screenshots_dir, filename)
                os.remove(file_path)
                deleted_count += 1
        
        return jsonify({
            "status": "success",
            "message": f"Deleted {deleted_count} reports and screenshots"
        })
    except Exception as e:
        logger.error(f"Error deleting reports: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error deleting reports: {str(e)}"
        }), 500

@app.route('/execute-tests', methods=['POST'])
def execute_tests():
    # Import selenium libraries only when needed
    import importlib.util
    spec = importlib.util.find_spec('selenium')
    if spec is None:
        return jsonify({
            "status": "error",
            "message": "Selenium is not installed on the server"
        }), 500

    # Import Service and webdriver only when needed
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.support.ui import WebDriverWait
    
    data = request.json
    browser = data.get('browser')
    client_id = data.get('clientId')
    logger.info(f"Received execute request: browser={browser}, clientId={client_id}")

    test_results = []
    driver = None
    
    try:
        # Setup Chrome WebDriver
        service = Service(ChromeDriverManager().install())
        options = webdriver.ChromeOptions()
        driver = webdriver.Chrome(service=service, options=options)
        wait = WebDriverWait(driver, 10)
        
        # Get all test files from test_cases directory
        test_files = [f for f in os.listdir('test_cases') if f.endswith('.py')]
        logger.info(f"Found {len(test_files)} test files: {test_files}")
        
        if not test_files:
            logger.error("No test files found in test_cases directory")
            return jsonify({
                "status": "error",
                "message": "No test files found in test_cases directory"
            }), 404
            
        for test_file in test_files:
            test_path = os.path.join('test_cases', test_file)
            
            try:
                logger.info(f"Starting test: {test_file}")
                
                # Read the test file content
                with open(test_path, 'r') as f:
                    test_file_content = f.read()
                
                # Send test case to Node server for Electron execution
                if ws:
                    test_data = {
                        'type': 'test-case',
                        'clientId': client_id,
                        'testCase': {
                            'name': test_file,
                            'browser': browser,
                            'content': test_file_content
                        }
                    }
                    ws.send(json.dumps(test_data))
                    logger.info(f"Sent test case to Node server: {test_file}")
                    # Add a small delay between sending test files
                    time.sleep(1)
                else:
                    raise Exception("WebSocket connection not available")
            except Exception as e:
                logger.error(f"Failed to send test {test_file}: {str(e)}")
                test_results.append({
                    "name": test_file,
                    "status": "failed",
                    "error": str(e)
                })
        
        logger.info("All test cases sent to Electron")
            
    except Exception as e:
        logger.error(f"Test setup failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Test setup failed: {str(e)}"
        }), 500
        
    finally:
        if driver:
            driver.quit()

    # Send results to WebSocket if connected
    if ws:
        ws.send(json.dumps({
            'type': 'test-results',
            'clientId': client_id,
            'results': test_results
        }))

    # Create reports directory if it doesn't exist
    os.makedirs('reports', exist_ok=True)

    # We don't need to create a summary report anymore since we're handling individual test reports
    # The React frontend will fetch all reports directly

    return jsonify({
        'status': 'success',
        'results': test_results
    })

if __name__ == '__main__':
    os.makedirs('reports', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    start_websocket()
    app.run(port=5000)