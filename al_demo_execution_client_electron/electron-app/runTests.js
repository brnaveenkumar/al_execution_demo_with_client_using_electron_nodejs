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
    logger.info(`Starting test case: ${testCase.name} with framework: ${testCase.framework} and browser: ${testCase.browser}`);
    let report = {
        name: testCase.name,
        status: 'failed',
        error: null,
        framework: testCase.framework,
        browser: testCase.browser,
        output: '',
        screenshots: {},
        steps: []
    };

    try {
        // Normalize browser name to lowercase for consistency
        const browser = testCase.browser ? testCase.browser.toLowerCase() : 'chrome';
        const validBrowsers = ['chrome', 'firefox', 'edge'];
        if (!validBrowsers.includes(browser)) {
            throw new Error(`Invalid browser specified: ${browser}. Supported browsers: ${validBrowsers.join(', ')}`);
        }

        // Determine the command based on the framework
        let command, args;
        if (testCase.framework === 'Robot') {
            command = 'robot';
            args = ['--variable', `BROWSER:${browser}`, testFilePath];
        } else {
            command = 'python';
            args = [testFilePath, browser];
        }

        // Verify the command exists
        logger.info(`Checking if ${command} is available`);
        const versionResult = await new Promise((resolve) => {
            const versionProcess = spawn(command, ['--version']);
            let versionOutput = '';
            versionProcess.stdout.on('data', (data) => {
                versionOutput += data.toString();
            });
            versionProcess.stderr.on('data', (data) => {
                versionOutput += data.toString();
            });
            versionProcess.on('error', (err) => {
                logger.error(`Failed to start ${command}: ${err.message}`);
                resolve({
                    status: 'failed',
                    error: `Failed to start ${command}: ${err.message}`,
                    output: versionOutput
                });
            });
            versionProcess.on('close', (code) => {
                logger.info(`${command} version: ${versionOutput.trim()}, exit code: ${code}`);
                resolve({
                    status: code === 0 || (command === 'robot' && code === 251) ? 'success' : 'failed',
                    output: versionOutput,
                    exitCode: code
                });
            });
        });

        if (versionResult.status === 'failed') {
            report.error = versionResult.error;
            report.steps = [
                { step: `Check ${command} availability`, status: 'failed', message: versionResult.error }
            ];
            throw new Error(versionResult.error);
        }

        // Create a temporary directory for the test
        const testDir = path.join(__dirname, 'temp_test_' + Date.now());
        await fs.mkdir(testDir, { recursive: true });
        const tempTestPath = path.join(testDir, path.basename(testFilePath));

        // Copy the test file to the temp directory
        await fs.copyFile(testFilePath, tempTestPath);
        logger.info(`Running test from temp directory: ${tempTestPath}`);

        // Execute the test file
        const result = await new Promise((resolve) => {
            const testProcess = spawn(command, args, { cwd: testDir });
            let stdout = '';
            let stderr = '';

            testProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                logger.info(`${command} stdout: ${output}`);
            });

            testProcess.stderr.on('data', (data) => {
                const error = data.toString();
                stderr += error;
                logger.error(`${command} stderr: ${error}`);
            });

            testProcess.on('error', (err) => {
                logger.error(`Failed to start ${command} process: ${err.message}`);
                resolve({
                    status: 'failed',
                    error: `Failed to start ${command} process: ${err.message}`,
                    output: stdout,
                    screenshots: {}
                });
            });

            testProcess.on('close', (code) => {
                logger.info(`${command} process exited with code ${code}`);

                // Check for screenshots in the temp directory
                const screenshots = {};
                const screenshotFiles = [
                    'before_login.png', 'after_login.png', 'error.png',
                    'divisions_page.png', 'edit_page.png', 'after_update.png',
                    'after_go_back.png', 'users_page.png', 'after_logout.png',
                    'after_first_pagination.png', 'after_second_pagination.png'
                ];

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

                    resolve({
                        status: code === 0 ? 'passed' : 'failed',
                        error: stderr || (code !== 0 ? `Process exited with code ${code}` : null),
                        output: stdout,
                        screenshots
                    });
                });
            });
        });

        // Update the report with the test results
        report.status = result.status;
        report.output = result.output;
        report.screenshots = result.screenshots;

        if (result.status === 'passed') {
            report.steps = [
                { step: `Execute ${testCase.framework} test file`, status: 'passed' },
                { step: 'Test completed successfully', status: 'passed' }
            ];
        } else {
            report.error = result.error || 'Unknown error during test execution';
            report.steps = [
                { step: `Execute ${testCase.framework} test file`, status: 'failed' },
                { step: 'Error details', status: 'failed', message: report.error }
            ];
        }

        logger.info(`Test execution completed with status: ${result.status}`);
    } catch (error) {
        report.error = error.message || 'Unexpected error during test execution';
        report.status = 'failed';
        report.steps = report.steps.length > 0 ? report.steps : [
            { step: `Execute ${testCase.framework} test file`, status: 'failed' },
            { step: 'Error details', status: 'failed', message: report.error }
        ];
        logger.error(`Test case failed: ${report.error}`);
        logger.error(`Stack trace: ${error.stack}`);
    }

    return report;
}

module.exports = { runTestCase };