@echo off
REM script to launch Chrome with the bot's session data
REM This allows you to log in manually without Puppeteer's automation flags

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "SESSION_DIR=%~dp0session_data"

echo Launching Chrome...
echo Path: "%CHROME_PATH%"
echo Session: "%SESSION_DIR%"

"%CHROME_PATH%" --user-data-dir="%SESSION_DIR%" "https://app.tunnl.io/"

echo.
echo Chrome closed. You can now run the bot.
pause