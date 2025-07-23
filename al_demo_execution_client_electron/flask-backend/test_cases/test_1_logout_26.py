from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import unittest
import os
import sys

class LogoutTest(unittest.TestCase):

    def setUp(self):
        try:
            # Setup Chrome options
            options = Options()
            options.add_argument('--start-maximized')  # Start maximized
            # options.add_argument('--headless')  # Run in headless mode (commented out to see browser)
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

    def test_logout(self):
        try:
            driver = self.driver
            print("Starting logout test")
            
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
            
            # Click on user menu
            print("Clicking on user menu...")
            user_menu = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "//*[@id='logoutForm']/ul[1]/li[1]/a[1]"))
            )
            user_menu.click()
            print("Clicked on user menu")
            time.sleep(2)
            
            # Click on logout
            print("Clicking on logout...")
            logout_link = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "//*[@id='logoutForm']/ul[1]/li[1]/ul[1]/li[2]/a[1]"))
            )
            logout_link.click()
            print("Clicked on logout")
            time.sleep(2)
            
            # Take screenshot after logout
            screenshot_path = os.path.join(current_dir, 'after_logout.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot after logout at: {screenshot_path}")
            
            print(f"Current URL after logout: {driver.current_url}")
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