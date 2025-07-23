from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time
import unittest
import os
import sys

class LoginTest(unittest.TestCase):

    def setUp(self):
        try:
            # Setup Chrome options
            options = Options()
            options.add_argument('--start-maximized')  # Start maximized
            # Run in visible mode for debugging
            # options.add_argument('--headless')  # Run in headless mode
            options.add_argument('--disable-gpu')  # Disable GPU hardware acceleration
            options.add_argument('--no-sandbox')  # Bypass OS security model
            options.add_argument('--disable-dev-shm-usage')  # Overcome limited resource problems
            
            # Initialize the Chrome driver with ChromeDriverManager
            print("Setting up Chrome driver...")
            self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            print(f"Chrome driver initialized: {self.driver}")
            
            # Navigate to the login page
            print("Navigating to login page...")
            self.driver.get("http://logistics.pearlarc.com/")
            print(f"Current URL: {self.driver.current_url}")
        except Exception as e:
            print(f"Error in setUp: {str(e)}")
            raise

    def test_valid_login(self):
        try:
            driver = self.driver
            print("Starting login test")
            print(f"Current URL before login: {driver.current_url}")
            
            # Save current directory
            current_dir = os.getcwd()
            print(f"Current directory: {current_dir}")
            
            # Take screenshot before login
            screenshot_path = os.path.join(current_dir, 'before_login.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot before login at: {screenshot_path}")
            
            # Find and enter username
            print("Finding username field...")
            username_field = driver.find_element(By.NAME, "UserName")
            username_field.send_keys("Monica")
            print("Entered username: Monica")
            
            # Find and enter password
            print("Finding password field...")
            password_field = driver.find_element(By.NAME, "Password")
            password_field.send_keys("Monica@123")
            print("Entered password: Monica@123")
            
            # Find and click login button
            print("Finding login button...")
            login_button = driver.find_element(By.XPATH, "/html/body/div[1]/div[3]/div[2]/div[1]/div[1]/form[1]/div[4]/div[2]/button[1]")
            login_button.click()
            print("Clicked login button")
            
            # Wait for redirect
            print("Waiting for redirect...")
            time.sleep(5)  # Increased wait time
            
            # Take screenshot after login
            screenshot_path = os.path.join(current_dir, 'after_login.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot after login at: {screenshot_path}")
            
            print(f"Current URL after login: {driver.current_url}")
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
    unittest.main()