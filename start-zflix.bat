@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Zflix - khoi dong server (Docker)
color 0A
cd /d "%~dp0"

echo ============================================
echo      ZFLIX - KHOI DONG SERVER (DOCKER)
echo ============================================
echo.

REM ---------- 0. Docker ----------
echo [0/6] Kiem tra Docker...
set "DOCKER="
where docker >nul 2>&1
if errorlevel 1 if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;!PATH!"
)
where docker >nul 2>&1 && set "DOCKER=docker"
if not defined DOCKER (
    color 0C
    echo       LOI: Khong tim thay Docker Desktop.
    echo       Tai tai: https://www.docker.com/products/docker-desktop/
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)

"%DOCKER%" info >nul 2>&1
if errorlevel 1 (
    echo       Docker chua chay - dang mo Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else (
        color 0C
        echo       LOI: Khong mo duoc Docker Desktop.
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    call :wait_docker 90
    if errorlevel 1 (
        color 0C
        echo       LOI: Docker khong san sang sau 180 giay.
        echo       Mo Docker Desktop bang tay roi chay lai script.
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
)
echo       Docker: OK
echo.

REM ---------- 1. .env ----------
echo [1/6] Kiem tra .env...
if not exist ".env" (
    echo       Chua co .env - tao tu .env.example...
    copy /y ".env.example" ".env" >nul
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Resolve-Path '.env').Path; $c=Get-Content -Raw -Encoding UTF8 $p; $changed=$false; function Rnd([int]$n){ $b=New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) }; if ($c -match '(?m)^JWT_ACCESS_SECRET=(replace-with.*)?\s*$') { $s=(Rnd 48).Replace('+','-').Replace('/','_').TrimEnd('='); $c=$c -replace '(?m)^JWT_ACCESS_SECRET=.*$', ('JWT_ACCESS_SECRET=' + $s); $changed=$true }; if ($c -match '(?m)^MFA_ENCRYPTION_KEY=\s*$') { $c=$c -replace '(?m)^MFA_ENCRYPTION_KEY=.*$', ('MFA_ENCRYPTION_KEY=' + (Rnd 32)); $changed=$true }; if ($c -match '(?m)^R2_PUBLIC_DOMAIN=\s*$') { $sql=Get-Content -Raw -Encoding UTF8 'database\init.sql'; if ($sql -match 'https://[a-z0-9-]+\.r2\.dev') { $c=$c -replace '(?m)^R2_PUBLIC_DOMAIN=.*$', ('R2_PUBLIC_DOMAIN=' + $Matches[0]); $changed=$true } }; if ($changed) { [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false))); Write-Output 'updated' } else { Write-Output 'ok' }" | findstr /b /c:"updated" >nul && echo       Da tao secret moi trong .env
REM Docker can cung cau hinh AI/R2 nhu ban local (backend-node\.env) de Lensy va upload
REM hoat dong giong het che do chay truc tiep.
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path 'backend-node\.env') { $l=@{}; Get-Content -Encoding UTF8 'backend-node\.env' | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $l[$Matches[1]]=$Matches[2] } }; $p=(Resolve-Path '.env').Path; $c=Get-Content -Raw -Encoding UTF8 $p; $changed=$false; foreach ($k in @('R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_PUBLIC_DOMAIN','VIDEO_WEBHOOK_SECRET','DEEPSEEK_API_KEY','DEEPSEEK_MODEL','DEEPSEEK_BASE_URL','GEMINI_API_KEY','GEMINI_MODEL','SERPAPI_KEY','PUBLIC_BASE_URL')) { $v=$l[$k]; if ($v -and $v -ne 'dev-placeholder' -and $c -match ('(?m)^'+$k+'=\s*(dev-placeholder)?\s*$')) { $c=$c -replace ('(?m)^'+$k+'=.*$'), ($k+'='+$v); $changed=$true } }; if ($l['VISION_PROVIDER'] -and $l['VISION_PROVIDER'] -ne 'none' -and $c -match '(?m)^VISION_PROVIDER=(none)?\s*$') { $c=$c -replace '(?m)^VISION_PROVIDER=.*$', ('VISION_PROVIDER='+$l['VISION_PROVIDER']); $changed=$true }; if ($changed) { [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false))); Write-Output 'synced' } }" | findstr /b /c:"synced" >nul && echo       Da dong bo cau hinh AI/R2 tu backend-node\.env
echo       .env: OK
echo.

REM ---------- 1b. Origin LAN ----------
REM May khac trong mang mo http://<ip>:5173 va goi API http://<ip>:3000, nen backend
REM phai cho phep origin do (CORS, Socket.IO va kiem tra Origin cua auth).
set "LAN_IP="
where node >nul 2>&1 && for /f "delims=" %%I in ('node "%~dp0tools\zflix-network.mjs" --ip 2^>nul') do if not defined LAN_IP set "LAN_IP=%%I"
if defined LAN_IP (
    node "%~dp0tools\zflix-network.mjs" >nul 2>&1
    echo       Origin LAN: http://!LAN_IP!:5173
) else (
    echo       CANH BAO: khong xac dinh duoc IP LAN - can Node.js tren may nay
    echo                de tu dong cho phep may khac trong mang truy cap.
)
echo.

REM ---------- 2. Kiem tra image da build chua ----------
echo [2/6] Kiem tra image Docker...
set "NEED_BUILD=0"
for %%S in (frontend backend-node video-processor ai-chatbot) do (
    set "IMG="
    for /f %%I in ('docker compose images -q %%S 2^>nul') do set "IMG=%%I"
    if not defined IMG set "NEED_BUILD=1"
)
if "!NEED_BUILD!"=="1" (
    echo       Lan dau chay - build image ^(co the mat vai phut^)...
    "%DOCKER%" compose build
    if errorlevel 1 (
        color 0C
        echo       LOI: Build image that bai. Xem log phia tren.
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
) else (
    echo       Image: OK
)
echo.

REM ---------- 3. Khoi dong stack ----------
echo [3/6] Khoi dong container...
"%DOCKER%" compose up -d
if errorlevel 1 (
    color 0C
    echo       LOI: Khong khoi dong duoc stack.
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)
echo       Container: OK
echo.

REM ---------- 4. Doi Frontend ----------
echo [4/6] Doi Frontend (http://localhost:5173)...
call :wait_url 5173 / 60
if errorlevel 1 (
    color 0C
    echo       LOI: Frontend khong san sang sau 180 giay.
    "%DOCKER%" compose logs --tail=20 frontend
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)
echo       Frontend: OK
echo.

REM ---------- 5. Doi Backend ----------
echo [5/6] Doi Backend API (http://localhost:3000)...
call :wait_url 3000 /api/v1/filters 90
if errorlevel 1 (
    color 0C
    echo       LOI: Backend khong san sang sau 270 giay.
    "%DOCKER%" compose logs --tail=30 backend-node
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)
echo       Backend: OK
echo.

REM ---------- 6. Trang thai ----------
echo [6/6] Trang thai container:
"%DOCKER%" compose ps
echo.

echo ============================================
echo   TAT CA SERVER DA SAN SANG^!
echo.
echo   Web       : http://localhost:5173
echo   API       : http://localhost:3000
echo   Admin     : http://localhost:5173/admin-login
echo   Phim mau  : http://localhost:5173/movies/3
if defined LAN_IP (
    echo   Web LAN   : http://!LAN_IP!:5173  ^(may khac trong mang^)
    echo   API LAN   : http://!LAN_IP!:3000
)
echo.
echo   TK admin  : admin@moviehub.com
echo   Mat khau  : Zflix@2026
echo.
echo   Du lieu DB nam trong volume Docker, khong mat khi tat.
echo   De TAT: stop-zflix.bat
echo ============================================
echo.
start http://localhost:5173
if not defined ZFLIX_NO_PAUSE pause
exit /b 0

REM ============================================================
REM :wait_docker <so_lan>  - poll moi 2 giay cho engine san sang
REM ============================================================
:wait_docker
set /a _WD_COUNT=0
:wait_docker_loop
"%DOCKER%" info >nul 2>&1
if not errorlevel 1 exit /b 0
set /a _WD_COUNT+=1
if !_WD_COUNT! GEQ %~1 exit /b 1
timeout /t 2 /nobreak >nul
goto :wait_docker_loop

REM ============================================================
REM :wait_url <port> <path> <so_lan>  - poll moi 3 giay
REM ============================================================
:wait_url
set "_WU_PORT=%~1"
set "_WU_PATH=%~2"
set /a _WU_COUNT=0
:wait_url_loop
set "_WU_CODE=0"
for /f %%C in ('powershell -NoProfile -Command "try { [int](Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://localhost:!_WU_PORT!!_WU_PATH!').StatusCode } catch { 0 }"') do set "_WU_CODE=%%C"
if "!_WU_CODE!"=="200" exit /b 0
set /a _WU_COUNT+=1
if !_WU_COUNT! GEQ %~3 exit /b 1
timeout /t 3 /nobreak >nul
goto :wait_url_loop
