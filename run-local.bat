@echo off
chcp 65001 >nul
title Zflix Local Runner
echo ========================================================
echo               KHOI DONG HE THONG ZFLIX
echo ========================================================

echo 1. Dang mo Backend Node.js (Port 3000)...
start "Zflix - Backend Node.js" cmd /k "cd backend-node && npm install && npm run dev"

echo 2. Dang mo Frontend React Vite (Port 5173)...
start "Zflix - Frontend React" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo ========================================================
echo Da mo 2 cua so rieng biet de chay Backend va Frontend!
echo Khi chay xong, hay mo trinh duyet truy cap:
echo -> http://localhost:5173
echo ========================================================
pause
