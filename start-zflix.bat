@echo off
chcp 65001 >nul
title Zflix - khoi dong server
color 0A

echo ============================================
echo        ZFLIX - KHOI DONG SERVER
echo ============================================
echo.

REM ---------- 1. MariaDB ----------
echo [1/3] Kiem tra MariaDB (port 3306)...
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo       MariaDB dang chay - BO QUA
) else (
    echo       Dang khoi dong MariaDB...
    start "MariaDB" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini"
    timeout /t 8 /nobreak >nul
    netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
    if %errorlevel%==0 (
        echo       MariaDB: OK
    ) else (
        color 0C
        echo       LOI: MariaDB khong khoi dong duoc!
        echo       Kiem tra C:\xampp\mysql\data co bi loi khong
        pause
        exit /b 1
    )
)
echo.

REM ---------- 2. Backend ----------
echo [2/3] Kiem tra Backend API (port 3000)...
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo       Backend dang chay - BO QUA
) else (
    echo       Dang khoi dong Backend (Node + CLIP se load lan dau ~2s)...
    cd /d "%~dp0backend-node"
    start "Zflix Backend" /min cmd /c "npm start > backend.log 2> backend.err"
    cd /d "%~dp0"
    timeout /t 8 /nobreak >nul
    netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
    if %errorlevel%==0 (
        echo       Backend: OK
    ) else (
        color 0C
        echo       LOI: Backend khong khoi dong! Xem backend-node\backend.err
        pause
        exit /b 1
    )
)
echo.

REM ---------- 3. Frontend ----------
echo [3/3] Kiem tra Frontend (port 5173)...
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo       Frontend dang chay - BO QUA
) else (
    echo       Dang khoi dong Frontend (Vite)...
    cd /d "%~dp0frontend"
    start "Zflix Frontend" /min cmd /c "npm run dev > frontend.log 2> frontend.err"
    cd /d "%~dp0"
    timeout /t 10 /nobreak >nul
    netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
    if %errorlevel%==0 (
        echo       Frontend: OK
    ) else (
        color 0C
        echo       LOI: Frontend khong khoi dong! Xem frontend\frontend.err
        pause
        exit /b 1
    )
)
echo.

echo ============================================
echo   TAT CA SERVER DA SAN SANG!
echo.
echo   Web       : http://localhost:5173
echo   API       : http://localhost:3000
echo   Quet do   : http://localhost:5173/watch/1128
echo   Admin     : http://localhost:5173/admin-login
echo.
echo   TK admin  : admin@moviehub.com / Admin@12345
echo   TK khac   : ... / Zflix@2026
echo.
echo   Cua so server dang chay o taskbar (toi uu).
echo   De TAT: chay stop-zflix.bat
echo ============================================
echo.
start http://localhost:5173
pause
