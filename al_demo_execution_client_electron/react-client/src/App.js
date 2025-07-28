import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [selectedBrowser, setBrowser] = useState('Chrome');
  const [selectedFramework, setFramework] = useState('Selenium');
  const [clientId, setClientId] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(false);

  useEffect(() => {
    // Generate a random client ID on component mount
    setClientId(generateClientId());
    
    // Fetch available reports
    fetchReports();
  }, []);
  
  const fetchReports = async () => {
    try {
      const response = await fetch('http://localhost:5000/reports');
      const data = await response.json();
      if (data.status === 'success') {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };
  
  const deleteAllReports = async () => {
    if (window.confirm('Are you sure you want to delete all reports?')) {
      try {
        const response = await fetch('http://localhost:5000/reports/delete-all', {
          method: 'POST'
        });
        const data = await response.json();
        if (data.status === 'success') {
          alert(data.message);
          fetchReports(); // Refresh the reports list
        } else {
          alert(`Error: ${data.message}`);
        }
      } catch (error) {
        console.error('Error deleting reports:', error);
        alert(`Error deleting reports: ${error.message}`);
      }
    }
  };
  
  const viewReport = async (filename) => {
    try {
      const response = await fetch(`http://localhost:5000/reports/${filename}`);
      const data = await response.json();
      if (data.status === 'success') {
        // Extract timestamp from filename
        let timestamp = '';
        const parts = filename.split('_');
        if (parts.length >= 2) {
          // Get the date and time parts
          const datePart = parts[parts.length - 2] || '';
          const timePart = parts[parts.length - 1].replace('.json', '') || '';
          timestamp = datePart + '_' + timePart;
        }
        
        // Create a formatted report object with the necessary fields
        const formattedReport = {
            timestamp: timestamp,
            browser: data.report.browser,
          framework: data.report.framework || selectedFramework,
          clientId: data.report.clientId || 'N/A',
          results: [data.report] // Wrap the report in an array for consistent rendering
        };
        setSelectedReport(formattedReport);
        setViewingReport(true);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
  };

  const generateClientId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  };

  const executeTests = async () => {
    setLoading(true);
    try {
      // Call Flask API to initiate tests
      const response = await fetch('http://localhost:5000/execute-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          browser: selectedBrowser,
          framework: selectedFramework,
          clientId: clientId
        }),
      });

      const data = await response.json();
      setTestResults(data);
      
      // Wait for tests to complete and fetch the latest reports
      setTimeout(async () => {
        await fetchReports();
        const latestReports = await fetch('http://localhost:5000/reports');
        const reportsData = await latestReports.json();
        
        if (reportsData.status === 'success' && reportsData.reports.length > 0) {
          // Get all reports
          const allReports = reportsData.reports;
          const allResults = [];
          
          // Fetch each report
          for (const report of allReports) {
            try {
              const reportResponse = await fetch(`http://localhost:5000/reports/${report.filename}`);
              const reportData = await reportResponse.json();
              
              if (reportData.status === 'success') {
                allResults.push(reportData.report);
              }
            } catch (error) {
              console.error(`Error fetching report ${report.filename}:`, error);
            }
          }
          
          // Create a formatted report object with all test results
          const formattedResults = {
            timestamp: new Date().toISOString(),
            browser: selectedBrowser,
            framework: selectedFramework,
            clientId: clientId,
            results: allResults,
            status: 'success'
          };
          setTestResults(formattedResults);
        }
        setLoading(false);
      }, 120000); // Wait 120 seconds for all tests to complete
    } catch (error) {
      setTestResults({
        message: "Error executing tests: " + error.message,
        status: "error"
      });
      setLoading(false);
    }
  };

  return (
    <div className="App">
      {viewingReport ? (
        <div className="report-viewer">
          <h1>Test Report</h1>
          <button onClick={() => setViewingReport(false)}>Back</button>
          
          {selectedReport && (
            <div className="report-details">
              <h2>Report Details</h2>
              <p><strong>Timestamp:</strong> {selectedReport.timestamp}</p>
              <p><strong>Browser:</strong> {selectedReport.browser}</p>
              <p><strong>Framework:</strong> {selectedReport.framework}</p>
              <p><strong>Client ID:</strong> {selectedReport.clientId}</p>
              
              <h3>Test Results:</h3>
              {selectedReport.results && selectedReport.results.map((result, index) => (
                <div key={index} className={`test-result ${result.status}`}>
                  <h4>{result.name}</h4>
                  <p>Status: {result.status}</p>
                  {result.error && (
                    <div className="error-message">
                      <h5>Error:</h5>
                      <pre>{result.error}</pre>
                    </div>
                  )}
                  {result.output && (
                    <div className="output">
                      <h5>Output:</h5>
                      <pre>{result.output}</pre>
                    </div>
                  )}
                  {result.steps && result.steps.length > 0 && (
                    <div className="test-steps">
                      <h5>Test Steps:</h5>
                      <ul>
                        {result.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className={step.status}>
                            {step.step} - {step.status}
                            {step.message && <div className="step-message">{step.message}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="test-runner">
          <h1>Test Runner</h1>
          
          <div className="form-group">
            <label>Browser:</label>
            <select 
              value={selectedBrowser}
              onChange={(e) => setBrowser(e.target.value)}
            >
              <option value="Chrome">Chrome</option>
              <option value="Edge">Edge</option>
              <option value="Firefox">Firefox</option>
            </select>
          </div>

          <div className="form-group">
            <label>Test Framework:</label>
            <select 
              value={selectedFramework}
              onChange={(e) => setFramework(e.target.value)}
            >
              <option value="Selenium">Selenium</option>
              <option value="Robot">Robot</option>
            </select>
          </div>
          <div className="form-group">
            <label>Electron Client ID:</label>
            <input 
              type="text" 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter Client ID"
            />
          </div>

          <button 
            onClick={executeTests}
            disabled={loading}
          >
            {loading ? 'Executing Tests...' : 'Execute All Tests'}
          </button>
          
          {loading && (
            <div className="loading-indicator">
              <p>Running all test cases. Please wait...</p>
              <p>This may take up to 2 minutes to complete.</p>
              <p>Browser windows will open and close automatically.</p>
              <div className="spinner"></div>
            </div>
          )}
          
          <div className="reports-section">
            <h2>Available Reports</h2>
            <div className="reports-actions">
              <button onClick={fetchReports}>Refresh Reports</button>
              <button onClick={deleteAllReports} className="delete-button">Delete All Reports</button>
            </div>
            {reports.length > 0 ? (
              <ul className="reports-list">
                {reports.map((report, index) => (
                  <li key={index}>
                    {report.filename}
                    <button onClick={() => viewReport(report.filename)}>View</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No reports available</p>
            )}
          </div>

          {testResults && (
            <div className={`results ${testResults.status}`}>
              <h2>Test Results:</h2>
              {testResults.results ? testResults.results.map((result, index) => (
                <div key={index} className={`test-result ${result.status}`}>
                  <h3>{result.name}</h3>
                  <p>Status: {result.status}</p>
                  {result.error && (
                    <div className="error-message">
                      <h4>Error:</h4>
                      <pre>{result.error}</pre>
                    </div>
                  )}
                  {result.output && (
                    <div className="output">
                      <h4>Output:</h4>
                      <pre>{result.output}</pre>
                    </div>
                  )}
                  {result.steps && result.steps.length > 0 && (
                    <div className="test-steps">
                      <h4>Test Steps:</h4>
                      <ul>
                        {result.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className={step.status}>
                            {step.step} - {step.status}
                            {step.message && <div className="step-message">{step.message}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.screenshots && Object.keys(result.screenshots).length > 0 && (
                    <div className="screenshots">
                      <h4>Screenshots:</h4>
                      {Object.entries(result.screenshots).map(([name, data]) => (
                        <div key={name} className="screenshot">
                          <h5>{name}</h5>
                          <img src={`data:image/png;base64,${data}`} alt={`Screenshot ${name}`} />
                        </div>
                      ))}
                    </div>
                  )}
                  {result.screenshot && (
                    <div className="screenshot">
                      <h4>Screenshot:</h4>
                      <img src={`data:image/png;base64,${result.screenshot}`} alt="Test Screenshot" />
                    </div>
                  )}
                </div>
              )) : (
                <div>Waiting for test results...</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;