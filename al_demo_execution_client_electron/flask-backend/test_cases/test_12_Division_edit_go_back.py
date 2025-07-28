from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.edge.service import Service as EdgeService
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from webdriver_manager.microsoft import EdgeChromiumDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import unittest
import os
import sys

class DivisionEditGoBackTest(unittest.TestCase):

    def setUp(self):
        try:
            # Get browser from command-line argument, default to Chrome
            browser = getattr(self, 'browser', 'chrome').lower()
            print(f"Setting up {browser} driver...")

            # Setup browser options
            if browser == 'firefox':
                options = webdriver.FirefoxOptions()
                options.add_argument('--start-maximized')
                options.add_argument('--disable-gpu')
                options.add_argument('--no-sandbox')
                options.add_argument('--disable-dev-shm-usage')
                self.driver = webdriver.Firefox(options=options)
            elif browser == 'edge':
                options = webdriver.EdgeOptions()
                options.add_argument('--start-maximized')
                options.add_argument('--disable-gpu')
                options.add_argument('--no-sandbox')
                options.add_argument('--disable-dev-shm-usage')
                self.driver = webdriver.Edge(options=options)
            else:
                options = webdriver.ChromeOptions()
                options.add_argument('--start-maximized')
                options.add_argument('--disable-gpu')
                options.add_argument('--no-sandbox')
                options.add_argument('--disable-dev-shm-usage')
                self.driver = webdriver.Chrome(options=options)

            print(f"{browser.capitalize()} driver initialized: {self.driver}")
            # Navigate to the login page
            print("Navigating to login page...")
            self.driver.get("http://logistics.pearlarc.com/")
            print(f"Current URL: {self.driver.current_url}")
        except Exception as e:
            print(f"Error in setUp: {str(e)}")
            raise

    def test_division_edit_go_back(self):
        try:
            driver = self.driver
            print("Starting Division edit go back test")
            
            # Save current directory
            current_dir = os.getcwd()
            print(f"Current directory: {current_dir}")
            
            # Take screenshot before login
            screenshot_path = os.path.join(current_dir, 'before_login.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot before login at: {screenshot_path}")
            
            # Login first
            print("Finding username field...")
            username_field = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.NAME, "UserName"))
            )
            username_field.send_keys("Monica")
            print("Entered username: Monica")
            
            print("Finding password field...")
            password_field = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.NAME, "Password"))
            )
            password_field.send_keys("Monica@123")
            print("Entered password: Monica@123")
            
            print("Finding login button...")
            login_button = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "/html/body/div[1]/div[3]/div[2]/div[1]/div[1]/form[1]/div[4]/div[2]/button[1]"))
            )
            login_button.click()
            print("Clicked login button")
            time.sleep(2)
            
            # Take screenshot after login
            screenshot_path = os.path.join(current_dir, 'after_login.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot after login at: {screenshot_path}")
            
            # Click on CLIENTS menu
            print("Clicking on CLIENTS menu...")
            clients_menu = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "/html/body/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/ul[1]/li[1]/a[1]"))
            )
            clients_menu.click()
            print("Clicked on CLIENTS menu")
            time.sleep(2)
            
            # Click on Divisions submenu
            print("Clicking on Divisions submenu...")
            divisions_submenu = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "/html/body/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/ul[1]/li[1]/ul[1]/li[3]/a[1]"))
            )
            divisions_submenu.click()
            print("Clicked on Divisions submenu")
            time.sleep(2)
            
            # Take screenshot of Divisions page
            screenshot_path = os.path.join(current_dir, 'divisions_page.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot of Divisions page at: {screenshot_path}")
            
            # Click on edit icon
            print("Clicking on edit icon...")
            edit_icon = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "//*[@id='editClient']/i[1]"))
            )
            edit_icon.click()
            print("Clicked on edit icon")
            time.sleep(2)
            
            # Take screenshot of edit page
            screenshot_path = os.path.join(current_dir, 'edit_page.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot of edit page at: {screenshot_path}")
            
            # Go back to divisions page (browser back button)
            print("Going back to divisions page...")
            driver.back()
            print("Navigated back")
            time.sleep(2)
            
            # Take screenshot after going back
            screenshot_path = os.path.join(current_dir, 'after_go_back.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot after going back at: {screenshot_path}")
            
            print(f"Current URL after navigation: {driver.current_url}")
            print(f"Page title: {driver.title}")
            
        except Exception as e:
            print(f"Error during test: {str(e)}")
            # Take screenshot on error
            try:
                screenshot_path = os.path.join(os.getcwd(), 'error.png')
                driver.save_screenshot(screenshot_path)
                print(f"Saved error screenshot at: {screenshot_path}")
            except Exception as screenshot_error:
                print(f"Could not save error screenshot: {str(screenshot_error)}")
            raise

    def tearDown(self):
        if hasattr(self, 'driver'):
            print("Closing browser...")
            self.driver.quit()
            print("Browser closed")

if __name__ == '__main__':
    print(f"Python version: {sys.version}")
    print(f"Starting test execution from: {os.getcwd()}")

    # Extract browser argument if provided
    browser = sys.argv[1].lower() if len(sys.argv) > 1 else 'chrome'
    print(f"Running test with browser: {browser}")

    # Remove browser argument from sys.argv to prevent unittest from misinterpreting it
    if len(sys.argv) > 1:
        sys.argv.pop(1)

    # Create test suite and pass browser to test case
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()
    test_case = DivisionEditGoBackTest('test_division_edit_go_back')
    test_case.browser = browser  # Set browser attribute for the test case
    suite.addTest(test_case)

    # Run the test suite
    runner = unittest.TextTestRunner()
    runner.run(suite)