*** Settings ***
Library    SeleniumLibrary
Test Teardown    Handle Test Failure

*** Test Cases ***
Division Reload
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
    Wait Until Element Is Visible    xpath=//*[@id='grdDivision']/div[4]/a[5]/span[1]    timeout=20s
    Click Element    xpath=//*[@id='grdDivision']/div[4]/a[5]/span[1]
    Sleep    2s
    Capture Page Screenshot    after_first_pagination.png
    Wait Until Element Is Visible    xpath=//*[@id='grdDivision']/div[4]/a[5]/span[1]    timeout=20s
    Click Element    xpath=//*[@id='grdDivision']/div[4]/a[5]/span[1]
    Sleep    2s
    Capture Page Screenshot    after_second_pagination.png
    Close Browser

*** Keywords ***
Handle Test Failure
    Run Keyword If Test Failed    Capture Page Screenshot    error.png