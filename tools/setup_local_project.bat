@echo off
chcp 65001 >nul
set "TARGET=E:\NewProject\maoshugame"
set "REPO=https://github.com/fbi02042026/maoshugame.git"

echo ========================================
echo  仓鼠大作战 - 本地项目初始化
echo  目标目录: %TARGET%
echo ========================================
echo.

if not exist "E:\NewProject" mkdir "E:\NewProject"
if not exist "%TARGET%" mkdir "%TARGET%"

cd /d "%TARGET%"

if exist ".git" (
    echo [信息] 已是 Git 仓库，正在拉取最新代码...
    git pull origin main
) else (
    echo [信息] 正在克隆 GitHub 仓库...
    git clone %REPO% .
)

if not exist "assets\incoming" mkdir "assets\incoming"

echo.
echo [完成] 项目目录: %TARGET%
echo [完成] 新资源请放入: %TARGET%\assets\incoming\
echo [完成] 用浏览器打开: %TARGET%\index.html
echo.
echo 详见仓库根目录 备忘录.md
pause
