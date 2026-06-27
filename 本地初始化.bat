@echo off
chcp 65001 >nul
title 仓鼠大作战 - 本地项目初始化
set "TARGET=E:\NewProject\maoshugame"
set "REPO=https://github.com/fbi02042026/maoshugame.git"

echo.
echo  ========================================
echo   仓鼠大作战 - 本地项目初始化
echo   目标: %TARGET%
echo  ========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Git。请先安装:
    echo   https://git-scm.com/download/win
    echo  安装时勾选 "Add Git to PATH"，装完关掉本窗口再重新运行。
    echo.
    pause
    exit /b 1
)

if not exist "E:\NewProject" mkdir "E:\NewProject"
if not exist "%TARGET%" mkdir "%TARGET%"
cd /d "%TARGET%"

if exist ".git" (
    echo [1/2] 目录已有项目，正在更新...
    git pull origin main
    if errorlevel 1 (
        echo [错误] git pull 失败，请检查网络或手动执行: git pull origin main
        pause
        exit /b 1
    )
) else (
    echo [1/2] 正在从 GitHub 下载项目（首次较慢，请稍候）...
    git clone %REPO% .
    if errorlevel 1 (
        echo [错误] git clone 失败。请检查网络，或改用手动命令见 备忘录.md
        pause
        exit /b 1
    )
)

if not exist "assets\incoming" mkdir "assets\incoming"

echo.
echo [2/2] 完成！
echo.
echo   项目文件夹:  %TARGET%
echo   新资源放这里: %TARGET%\assets\incoming\
echo   玩游戏打开:   %TARGET%\index.html
echo.
echo   下一步: 用资源管理器打开上面文件夹，双击 index.html 试玩。
echo   以后有新图: 放进 assets\incoming\ 再在 Cursor 里说「整理一下」。
echo.

choice /C YN /M "是否现在打开项目文件夹"
if errorlevel 2 goto end
if errorlevel 1 explorer "%TARGET%"

:end
pause
