*** Settings ***
Library    SeleniumLibrary
Test Teardown    Handle Test Failure

*** Test Cases ***
Valid Division Edit
    Open Browser    http://logistics.pearlarc.com/    ${BROWSER}
    Maximize Browser Window
    Capture Page Screenshot    before_login.png
    Wait Until Element Is Visible    name=UserName    timeout=20s
    Input Text    name=UserName    Monica
    Wait Until Element Is Visible    name=Password    timeout=20s
    Input Text    name=Password    Monica@123
    Wait Until Element Is Visible    xpath=/html/body/div[1]/div[3]/div[2]/div[1]/div[1]/form[1]/div[4]/div[2]/button[1]    timeout=20s
    Click Button    xpath=/html/body/div[1]/div[3]/div[2]/div[1]/div[1]/form[1]/div[4]/div[2]/button[1]
    Sleep    2s
    Capture Page Screenshot    after_login.png
    Wait Until Element Is Visible    xpath=/html/body/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/ul[1]/li[1]/a[1]    timeout=20s
    Click Element    xpath=/html/body/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/ul[1]/li[1]/a[1]
    Sleep    2s
    Wait Until Element Is Visible    xpath=/html/body/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/ul[1]/li[1]/ul[1]/li[3]/a[1]    timeout=20s
    Click Element    xpath=/html/body/div[1]/div[1]/div[1]/div[1]/div[2]/div[1]/ul[1]/li[1]/ul[1]/li[3]/a[1]
    Sleep    2s
    Capture Page Screenshot    divisions_page.png
    Wait Until Element Is Visible    xpath=//*[@id='editClient']/i[1]    timeout=20s
    Click Element    xpath=//*[@id='editClient']/i[1]
    Sleep    2s
    Capture Page Screenshot    edit_page.png
    Wait Until Element Is Visible    name=DivisionName    timeout=20s
    Clear Element Text    name=DivisionName
    Input Text    name=DivisionName    Monica
    Wait Until Element Is Visible    xpath=//*[@id='form1']/div[3]/div[1]/div[1]/div[1]/button[2]    timeout=20s
    Click Button    xpath=//*[@id='form1']/div[3]/div[1]/div[1]/div[1]/button[2]
    Sleep    2s
    Capture Page Screenshot    after_update.png
    Close Browser

*** Keywords ***
Handle Test Failure
    Run Keyword If Test Failed    Capture Page Screenshot    error.png