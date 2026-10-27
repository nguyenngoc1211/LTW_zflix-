@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Zflix - tat server
color 0C

echo ============================================
echo        ZFLIX - TAT SERVER
echo ============================================
echo.

echo [1/4] Dang tat Frontend (Vite)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo       Done.

echo [2/4] Dang tat Backend (Node API)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo       Done.

echo [3/4] Dang tat Video Processor (Python)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo       Done.

echo [4/4] Dang tat MariaDB...
REM mysqld tu tat an toan khi nhan tin hinh - chi kill neu con treo
taskkill /F /IM mysqld.exe >nul 2>&1
echo       Done.

echo.
echo ============================================
echo   DA TAT TOAN BO SERVER ZFLIX
echo ============================================
echo.
pause
