@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Zflix - cai dat moi truong dev
color 0B
cd /d "%~dp0"

echo ============================================
echo      ZFLIX - CAI DAT MOI TRUONG DEV
echo ============================================
echo.
echo  Script nay se:
echo    1. Tim MySQL tren may ban
echo    2. Tao database + nap schema (35 bang)
echo    3. Sinh file .env voi secret ngau nhien
echo    4. Cai dependency + Prisma
echo    5. Dat mat khau dev cho tai khoan demo
echo.
echo  LUU Y: neu database movie_streaming_db da ton tai,
echo         script GIU NGUYEN du lieu va bo qua buoc nap schema.
echo         Muon xoa va lam lai tu dau: them --force (MAT DU LIEU).
echo.

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo LOI: Khong tim thay Node.js trong PATH.
    echo      Cai tai https://nodejs.org ^(ban LTS^) roi chay lai.
    pause
    exit /b 1
)

node "%~dp0tools\zflix-setup.mjs" %*
set "EXIT_CODE=!errorlevel!"

echo.
if not "!EXIT_CODE!"=="0" (
    color 0C
    echo ============================================
    echo   CAI DAT THAT BAI ^(exit !EXIT_CODE!^)
    echo ============================================
    echo.
    echo  Loi thuong gap:
    echo    - MySQL chua chay   -^> bat MySQL trong XAMPP Control Panel
    echo    - Sai mat khau root -^> chay: setup-zflix.bat --db-password MATKHAU
    echo    - Khong co mysql    -^> cai XAMPP: https://www.apachefriends.org
    echo.
    pause
    exit /b !EXIT_CODE!
)

echo ============================================
echo   CAI DAT XONG^!
echo ============================================
echo.
echo   Buoc tiep theo: chay start-zflix.bat
echo.
pause
exit /b 0
