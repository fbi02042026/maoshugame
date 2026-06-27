@echo off
setlocal EnableExtensions
set "TARGET=E:\NewProject\maoshugame"
set "REPO=https://github.com/fbi02042026/maoshugame.git"

echo.
echo ========================================
echo   Maoshu Game - Local Setup
echo   Target: %TARGET%
echo ========================================
echo.

where git >nul 2>&1
if errorlevel 1 goto NOGIT

if not exist "E:\NewProject" mkdir "E:\NewProject"
if not exist "%TARGET%" mkdir "%TARGET%"
cd /d "%TARGET%" || goto FAIL

if exist ".git" goto UPDATE
goto CLONE

:UPDATE
echo [1/2] Updating project...
git pull origin main
if errorlevel 1 goto FAIL
goto DONE

:CLONE
echo [1/2] Cloning from GitHub, please wait...
git clone "%REPO%" .
if errorlevel 1 goto FAIL
goto DONE

:DONE
if not exist "assets\incoming" mkdir "assets\incoming"
echo.
echo [2/2] SUCCESS
echo.
echo   Project: %TARGET%
echo   Assets:  %TARGET%\assets\incoming\
echo   Play:    %TARGET%\index.html
echo.
echo   Double-click index.html in that folder to play.
echo.
explorer "%TARGET%"
pause
exit /b 0

:NOGIT
echo.
echo ERROR: Git not found.
echo Install: https://git-scm.com/download/win
echo Check "Add Git to PATH" during install, then run this again.
echo.
pause
exit /b 1

:FAIL
echo.
echo ERROR: git command failed. Check network and try again.
echo Or run manually in cmd:
echo   mkdir E:\NewProject\maoshugame
echo   cd /d E:\NewProject\maoshugame
echo   git clone https://github.com/fbi02042026/maoshugame.git .
echo.
pause
exit /b 1
