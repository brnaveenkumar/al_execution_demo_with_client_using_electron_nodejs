from flask import Flask, jsonify, request
import os
import json
from flask_cors import CORS
import logging
from logging.handlers import RotatingFileHandler
from websocket import create_connection
import time
import base64
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Logger setup
log_formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s')
log_handler = RotatingFileHandler('logs/flask.log', maxBytes=1000000, backupCount=1)
log_handler.setFormatter(log_formatter)
app.logger.addHandler(log_handler)
app.logger.setLevel(logging.INFO)

ws = None
reports_dir = os.path.join(os.path.dirname(__file__), 'reports')
screenshots_dir = os.path.join(reports_dir, 'screenshots')

def connect_to_node_server():
    global ws
    try:
        ws = create_connection("ws://localhost:8080")
        app.logger.info("Websocket connected")
        app.logger.info("Connected to Node server")
        ws.send(json.dumps({"type": "register-flask"}))
    except Exception as e:
        app.logger.error(f"Failed to connect to Node server: {str(e)}")

def save_report(report):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"report_{report['name']}_{timestamp}.json"
        report_path = os.path.join(reports_dir, report_filename)
        
        if not os.path.exists(reports_dir):
            os.makedirs(reports_dir)
        
        if not os.path.exists(screenshots_dir):
            os.makedirs(screenshots_dir)
        
        if 'screenshots' in report:
            for screenshot_name, screenshot_data in report['screenshots'].items():
                screenshot_path = os.path.join(screenshots_dir, screenshot_name)
                with open(screenshot_path, 'wb') as f:
                    f.write(base64.b64decode(screenshot_data))
                report['screenshots'][screenshot_name] = screenshot_path
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=4)
        
        app.logger.info(f"Test report saved at {report_path}")
    except Exception as e:
        app.logger.error(f"Error saving report: {str(e)}")

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
            app.loger.error(f"Error reading report {report_file}: {str(e)}")
    
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
        app.logger.error(f"Error reading report {filename}: {str(e)}")
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
        app.logger.error(f"Error deleting reports: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error deleting reports: {str(e)}"
        }), 500

@app.route('/execute-tests', methods=['POST'])
def execute_tests():
    try:
        data = request.json
        browser = data.get('browser')
        framework = data.get('framework')
        client_id = data.get('clientId')
        app.logger.info(f"Received execute request: browser={browser}, framework={framework}, clientId={client_id}")

        test_cases_dir = os.path.join(os.path.dirname(__file__), 'test_cases')
        test_files = []
        
        if framework == 'Robot':
            test_files = [f for f in os.listdir(test_cases_dir) if f.endswith('.robot')]
        elif framework == 'Selenium':
            test_files = [f for f in os.listdir(test_cases_dir) if f.endswith('.py') and f != '__init__.py']
        
        app.logger.info(f"Found {len(test_files)} test files: {test_files}")
        
        if not test_files:
            return jsonify({"error": f"No {framework} test files found"}), 400

        for test_file in test_files:
            app.logger.info(f"Starting test: {test_file}")
            with open(os.path.join(test_cases_dir, test_file), 'r') as f:
                test_content = f.read()
            
            test_case = {
                'name': test_file,
                'browser': browser,
                'framework': framework,
                'content': test_content
            }
            
            ws.send(json.dumps({
                "type": "test-case",
                "clientId": client_id,
                "testCase": test_case
            }))
            app.logger.info(f"Sent test case to Node server: {test_file} (framework: {framework})")
            
            # Wait for test result
            while True:
                result = ws.recv()
                result_data = json.loads(result)
                if result_data['type'] == 'test-result':
                    save_report(result_data['result'])
                    app.logger.info(f"Received and saved result for {test_file}")
                    break
                time.sleep(0.1)
        
        app.logger.info("All test cases sent to Electron")
        return jsonify({"message": f"Executed {len(test_files)} test cases"})
    except Exception as e:
        app.logger.error(f"Error in execute_tests: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if not os.path.exists('logs'):
        os.makedirs('logs')
    connect_to_node_server()
    app.run(port=5000, debug=True)