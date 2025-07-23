const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/runTests.log' }),
    new winston.transports.Console()
  ]
});

async function runTestCase(testCase, testFilePath) {
  logger.info(`Starting test case: ${testCase.name}`);
  let report = { name: testCase.name, status: 'failed', error: null };

  try {
    // Execute the Python test file using the system's Python interpreter
    logger.info(`Executing Python test file: ${testFilePath}`);
    
    // Run the Python test file directly and capture the output
    const result = await new Promise((resolve, reject) => {
      logger.info(`Spawning Python process to run: ${testFilePath}`);
      
      // Check if Python is available
      const pythonVersionProcess = spawn('python', ['--version']);
      
      pythonVersionProcess.on('error', (err) => {
        logger.error(`Failed to start Python: ${err.message}`);
        resolve({
          status: 'failed',
          error: `Failed to start Python: ${err.message}`,
          output: ''
        });
      });
      
      let pythonVersion = '';
      pythonVersionProcess.stdout.on('data', (data) => {
        pythonVersion += data.toString();
      });
      
      pythonVersionProcess.stderr.on('data', (data) => {
        pythonVersion += data.toString();
      });
      
      pythonVersionProcess.on('close', (code) => {
        logger.info(`Python version: ${pythonVersion.trim()}, exit code: ${code}`);
        
        // Create a temporary directory for the test
        const testDir = path.join(__dirname, 'temp_test_' + Date.now());
        fs.mkdir(testDir, { recursive: true })
          .then(() => {
            // Copy the test file to the temp directory
            const tempTestPath = path.join(testDir, path.basename(testFilePath));
            return fs.copyFile(testFilePath, tempTestPath)
              .then(() => tempTestPath);
          })
          .then((tempTestPath) => {
            // Now run the actual test from the temp directory
            logger.info(`Running test from temp directory: ${tempTestPath}`);
            
            // Use -m unittest to run the test properly
            const pythonProcess = spawn('python', [tempTestPath]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
              const output = data.toString();
              stdout += output;
              logger.info(`Python stdout: ${output}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
              const error = data.toString();
              stderr += error;
              logger.error(`Python stderr: ${error}`);
            });
            
            pythonProcess.on('error', (err) => {
              logger.error(`Failed to start Python process: ${err.message}`);
              resolve({
                status: 'failed',
                error: `Failed to start Python process: ${err.message}`,
                output: ''
              });
            });
            
            pythonProcess.on('close', (code) => {
              logger.info(`Python process exited with code ${code}`);
              
              // Check for screenshots in the temp directory
              const screenshots = {};
              const screenshotFiles = ['before_login.png', 'after_login.png', 'error.png', 'divisions_page.png', 'edit_page.png', 'after_update.png', 'after_go_back.png', 'users_page.png', 'after_logout.png', 'after_first_pagination.png', 'after_second_pagination.png'];
              
              Promise.all(screenshotFiles.map(async (file) => {
                try {
                  const filePath = path.join(testDir, file);
                  const exists = await fs.access(filePath).then(() => true).catch(() => false);
                  
                  if (exists) {
                    logger.info(`Found screenshot: ${file}`);
                    const data = await fs.readFile(filePath);
                    screenshots[file] = data.toString('base64');
                  }
                } catch (err) {
                  logger.error(`Error reading screenshot ${file}: ${err.message}`);
                }
              })).then(async () => {
                // Clean up the temp directory
                try {
                  const files = await fs.readdir(testDir);
                  for (const file of files) {
                    await fs.unlink(path.join(testDir, file));
                  }
                  await fs.rmdir(testDir);
                  logger.info(`Cleaned up temp directory: ${testDir}`);
                } catch (err) {
                  logger.error(`Error cleaning up temp directory: ${err.message}`);
                }
                
                if (code === 0) {
                  resolve({
                    status: 'passed',
                    output: stdout,
                    screenshots
                  });
                } else {
                  resolve({
                    status: 'failed',
                    error: stderr || `Process exited with code ${code}`,
                    output: stdout,
                    screenshots
                  });
                }
              });
            });
          })
          .catch((err) => {
            logger.error(`Error setting up temp directory: ${err.message}`);
            resolve({
              status: 'failed',
              error: `Error setting up temp directory: ${err.message}`,
              output: ''
            });
          });
      });
    });
    
    // Update the report with the test results
    report.status = result.status;
    report.output = result.output;
    
    if (result.screenshots) {
      report.screenshots = result.screenshots;
    }
    
    if (result.status === 'passed') {
      report.steps = [
        { step: 'Execute Python test file', status: 'passed' },
        { step: 'Test completed successfully', status: 'passed' }
      ];
    } else {
      report.error = result.error;
      report.steps = [
        { step: 'Execute Python test file', status: 'failed' },
        { step: 'Error details', status: 'failed', message: result.error }
      ];
    }
    
    logger.info(`Test execution completed with status: ${result.status}`);
  } catch (error) {
    report.error = error.message;
    report.status = 'failed';
    logger.error(`Test case failed: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);  // Add stack trace for better debugging
  }
  
  return report;
}

module.exports = { runTestCase };