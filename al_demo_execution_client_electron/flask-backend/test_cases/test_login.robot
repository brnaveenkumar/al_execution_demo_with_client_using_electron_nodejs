*** Settings ***
Library    SeleniumLibrary

*** Test Cases ***
Valid Login
    Open Browser    http://logistics.pearlarc.com/    ${BROWSER}
    Input Text    name=UserName    Monica
    Input Text    name=Password    Monica@123
    Click Button    xpath=/html/body/div[1]/div[3]/div[2]/div[1]/div[1]/form[1]/div[4]/div[2]/button[1]
    Sleep    5s
    Capture Page Screenshot    after_login.png
    Close Browser