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

class DivisionReloadTest(unittest.TestCase):

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

    def test_division_reload(self):
        try:
            driver = self.driver
            print("Starting Division reload test")
            
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
            
            # Click on pagination button
            print("Clicking on pagination button...")
            pagination_button = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "//*[@id='grdDivision']/div[4]/a[5]/span[1]"))
            )
            pagination_button.click()
            print("Clicked on pagination button")
            time.sleep(2)
            
            # Take screenshot after first pagination
            screenshot_path = os.path.join(current_dir, 'after_first_pagination.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot after first pagination at: {screenshot_path}")
            
            # Click on pagination button again
            print("Clicking on pagination button again...")
            pagination_button = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.XPATH, "//*[@id='grdDivision']/div[4]/a[5]/span[1]"))
            )
            pagination_button.click()
            print("Clicked on pagination button again")
            time.sleep(2)
            
            # Take screenshot after second pagination
            screenshot_path = os.path.join(current_dir, 'after_second_pagination.png')
            driver.save_screenshot(screenshot_path)
            print(f"Saved screenshot after second pagination at: {screenshot_path}")
            
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
    unittest.main()