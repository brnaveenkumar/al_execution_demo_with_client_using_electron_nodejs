const { Builder, By, until } = require('selenium-webdriver');
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
    new winston.transports.File({ filename: 'logs/runTests.log' }),
    new winston.transports.Console()
  ]
});

async function runTestCase(testCase) {
  logger.info(`Starting test case: ${testCase.name}`);
  let driver;
  let report = { name: testCase.name, status: 'failed', error: null };

  try {
    driver = await new Builder().forBrowser(testCase.browser).build();
    logger.info(`Browser ${testCase.browser} opened`);

    if (testCase.name === 'test_google_search') {
      await driver.get('https://www.google.com');
      logger.info('Navigated to Google');

      // Handle potential consent screen
      try {
        const consentButton = await driver.wait(
          until.elementLocated(By.css('button[id*="L2AGLb"], button[id*="W0wltc"], button:contains("Accept"), button:contains("I agree")')),
          5000
        );
        await driver.wait(until.elementIsVisible(consentButton), 5000);
        await driver.executeScript('arguments[0].click();', consentButton);
        logger.info('Clicked Google consent button');
        await driver.sleep(3000); // Wait for consent screen to disappear
      } catch (error) {
        logger.info('No consent screen found or already handled');
      }

      // Check for CAPTCHA or interstitial page
      try {
        const captcha = await driver.wait(
          until.elementLocated(By.css('#captcha, [id*="recaptcha"], [class*="captcha"]')),
          5000
        );
        if (await captcha.isDisplayed()) {
          const screenshotPath = path.join(__dirname, `logs/captcha_screenshot_${testCase.name}_${Date.now()}.png`);
          const screenshot = await driver.takeScreenshot();
          await fs.writeFile(screenshotPath, screenshot, 'base64');
          logger.error(`CAPTCHA detected, screenshot saved at: ${screenshotPath}`);
          throw new Error('CAPTCHA detected, cannot proceed automatically');
        }
      } catch (error) {
        if (error.message.includes('CAPTCHA')) {
          throw error;
        }
        logger.info('No CAPTCHA detected');
      }

      // Wait for the search input
      const searchInput = await driver.wait(
        until.elementLocated(By.name('q')),
        15000,
        'Search input not found'
      );
      await driver.wait(until.elementIsVisible(searchInput), 5000);
      await searchInput.sendKeys('Selenium WebDriver');
      logger.info('Entered search query');

      // Try multiple selectors for search button
      let searchButton;
      const selectors = [
        By.css('input[type="submit"][value*="Search"]'),
        By.css('input[name="btnK"]'),
        By.css('button[type="submit"]'),
        By.css('input[role="button"]'),
        By.css('button[aria-label*="Search"]')
      ];
      for (const selector of selectors) {
        try {
          searchButton = await driver.wait(until.elementLocated(selector), 5000);
          logger.info(`Found search button with selector: ${selector}`);
          break;
        } catch (error) {
          logger.warn(`Selector failed: ${selector}`);
        }
      }
      if (!searchButton) {
        throw new Error('No valid search button selector found');
      }

      // Log button state
      const buttonHtml = await driver.executeScript('return arguments[0].outerHTML;', searchButton);
      const isVisible = await searchButton.isDisplayed();
      const isEnabled = await searchButton.isEnabled();
      logger.info(`Search button HTML: ${buttonHtml}`);
      logger.info(`Search button state - Visible: ${isVisible}, Enabled: ${isEnabled}`);

      // Wait for button to be interactable
      await driver.wait(until.elementIsVisible(searchButton), 10000);
      await driver.wait(until.elementIsEnabled(searchButton), 10000);

      // Try Selenium click, fall back to JavaScript
      try {
        await searchButton.click();
        logger.info('Clicked search button via Selenium');
      } catch (error) {
        logger.warn('Selenium click failed, trying JavaScript click');
        await driver.executeScript('arguments[0].click();', searchButton);
        logger.info('Clicked search button via JavaScript');
      }

      // Wait for search results page (broad title check)
      try {
        await driver.wait(
          until.titleMatches(/Selenium|Google Search/i),
          30000,
          'Title does not contain "Selenium" or "Google Search"'
        );
        logger.info('Google search test passed (title matches "Selenium" or "Google Search")');
        report.status = 'passed';
      } catch (error) {
        logger.warn('Title check failed, trying content check');
        // Fallback: Check for search results in page content
        try {
          const results = await driver.wait(
            until.elementLocated(By.css('#search, .search-results, #rso, [role="list"]')),
            15000,
            'Search results not found'
          );
          if (await results.isDisplayed()) {
            logger.info('Google search test passed (search results found in content)');
            report.status = 'passed';
          } else {
            throw new Error('Neither title nor search results found');
          }
        } catch (contentError) {
          throw new Error(`Content check failed: ${contentError.message}`);
        }
      }

      // Log final page state
      const finalUrl = await driver.getCurrentUrl();
      const finalTitle = await driver.getTitle();
      logger.info(`Final URL: ${finalUrl}`);
      logger.info(`Final title: ${finalTitle}`);
    } else if (testCase.name === 'test_wikipedia') {
      await driver.get('https://www.wikipedia.org');
      logger.info('Navigated to Wikipedia');

      // Wait for the search input
      const searchInput = await driver.wait(
        until.elementLocated(By.id('searchInput')),
        15000,
        'Wikipedia search input not found'
      );
      await driver.wait(until.elementIsVisible(searchInput), 5000);
      await searchInput.sendKeys('Python');
      logger.info('Entered Wikipedia search query');

      // Try multiple selectors for search button
      let searchButton;
      const selectors = [
        By.css('.pure-button-primary-progressive'),
        By.css('.searchButton'),
        By.css('button[type="submit"]'),
        By.css('button[aria-label="Search"]')
      ];
      for (const selector of selectors) {
        try {
          searchButton = await driver.wait(until.elementLocated(selector), 5000);
          logger.info(`Found Wikipedia search button with selector: ${selector}`);
          break;
        } catch (error) {
          logger.warn(`Selector failed: ${selector}`);
        }
      }
      if (!searchButton) {
        throw new Error('No valid Wikipedia search button selector found');
      }

      // Log button state
      const buttonHtml = await driver.executeScript('return arguments[0].outerHTML;', searchButton);
      const isVisible = await searchButton.isDisplayed();
      const isEnabled = await searchButton.isEnabled();
      logger.info(`Wikipedia search button HTML: ${buttonHtml}`);
      logger.info(`Wikipedia search button state - Visible: ${isVisible}, Enabled: ${isEnabled}`);

      // Wait for button to be interactable
      await driver.wait(until.elementIsVisible(searchButton), 10000);
      await driver.wait(until.elementIsEnabled(searchButton), 10000);

      // Try Selenium click, fall back to JavaScript
      try {
        await searchButton.click();
        logger.info('Clicked Wikipedia search button via Selenium');
      } catch (error) {
        logger.warn('Selenium click failed, trying JavaScript click');
        await driver.executeScript('arguments[0].click();', searchButton);
        logger.info('Clicked Wikipedia search button via JavaScript');
      }

      // Wait for search results page
      await driver.wait(until.titleContains('Python'), 15000);
      logger.info('Wikipedia search test passed');
      report.status = 'passed';
    }
  } catch (error) {
    report.error = error.message;
    logger.error(`Test case failed: ${error.message}`);
    // Log page source and save screenshot
    if (driver) {
      const pageSource = await driver.getPageSource();
      logger.debug(`Page source on failure:\n${pageSource.substring(0, 1000)}...`);
      const screenshot = await driver.takeScreenshot();
      const screenshotPath = path.join(__dirname, `logs/screenshot_${testCase.name}_${Date.now()}.png`);
      await fs.writeFile(screenshotPath, screenshot, 'base64');
      logger.info(`Screenshot saved at: ${screenshotPath}`);
    }
  } finally {
    if (driver) {
      await driver.quit();
      logger.info(`Browser ${testCase.browser} closed`);
    }
  }

  return report;
}

module.exports = { runTestCase };