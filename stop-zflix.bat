@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Zflix - tat server (Docker)
color 0C
cd /d "%~dp0"

echo ============================================
echo        ZFLIX - TAT SERVER (DOCKER)
echo ============================================
echo.

set "DOCKER="
where docker >nul 2>&1 && set "DOCKER=docker"
if not defined DOCKER if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;!PATH!"
    set "DOCKER=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
)

if not defined DOCKER (
    echo Khong tim thay Docker - co the stack da khong chay.
    pause
    exit /b 0
)

"%DOCKER%" info >nul 2>&1
if errorlevel 1 (
    echo Docker dang tat - stack cung da dung.
    pause
    exit /b 0
)

echo Dang tat cac container...
"%DOCKER%" compose down
if errorlevel 1 (
    echo.
    echo LOI: Khong tat duoc stack. Xem thong bao phia tren.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   DA TAT TOAN BO SERVER ZFLIX
echo   Du lieu DB van duoc giu trong volume Docker.
echo   Muon xoa ca du lieu: docker compose down -v
echo ============================================
echo.
pause
