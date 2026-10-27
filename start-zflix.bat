@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Zflix - khoi dong server
color 0A
cd /d "%~dp0"

echo ============================================
echo        ZFLIX - KHOI DONG SERVER
echo ============================================
echo.

REM ---------- 0. Kiem tra moi truong + dependency ----------
echo [0/5] Kiem tra moi truong...

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo       LOI: Khong tim thay Node.js trong PATH.
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)

if not exist "backend-node\.env" (
    color 0C
    echo       LOI: Thieu backend-node\.env
    echo       Copy backend-node\.env.example thanh backend-node\.env
    echo       roi dien DATABASE_URL / JWT_ACCESS_SECRET truoc khi chay.
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)

set "NEED_BACKEND_INSTALL=0"
if not exist "backend-node\node_modules" set "NEED_BACKEND_INSTALL=1"
if not exist "backend-node\node_modules\@prisma\client" set "NEED_BACKEND_INSTALL=1"
if not exist "backend-node\node_modules\@aws-sdk\client-s3" set "NEED_BACKEND_INSTALL=1"
if "!NEED_BACKEND_INSTALL!"=="1" (
    echo       Cai dependency backend ^(npm install^)...
    pushd backend-node
    call npm install --no-audit --no-fund
    set "NPM_ERR=!errorlevel!"
    popd
    if not "!NPM_ERR!"=="0" (
        color 0C
        echo       LOI: npm install backend that bai^!
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
) else (
    echo       Dependency backend: OK
)

set "NEED_FRONTEND_INSTALL=0"
if not exist "frontend\node_modules" set "NEED_FRONTEND_INSTALL=1"
if not exist "frontend\node_modules\@ant-design\pro-components" set "NEED_FRONTEND_INSTALL=1"
if not exist "frontend\node_modules\@ant-design\v5-patch-for-react-19" set "NEED_FRONTEND_INSTALL=1"
if "!NEED_FRONTEND_INSTALL!"=="1" (
    echo       Cai dependency frontend ^(npm install^)...
    pushd frontend
    call npm install --no-audit --no-fund
    set "NPM_ERR=!errorlevel!"
    popd
    if not "!NPM_ERR!"=="0" (
        color 0C
        echo       LOI: npm install frontend that bai^!
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
) else (
    echo       Dependency frontend: OK
)

echo       Tao Prisma client...
pushd backend-node
call npx prisma generate > prisma.log 2>&1
set "PRISMA_ERR=!errorlevel!"
popd
if not "!PRISMA_ERR!"=="0" (
    color 0C
    echo       LOI: prisma generate that bai^! Xem backend-node\prisma.log
    if not defined ZFLIX_NO_PAUSE pause
    exit /b 1
)
echo       Prisma client: OK
echo.

REM ---------- 1. MariaDB ----------
echo [1/5] Kiem tra MariaDB (port 3306)...
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo       MariaDB dang chay - BO QUA
) else (
    echo       Dang khoi dong MariaDB...
    if not exist "C:\xampp\mysql\bin\mysqld.exe" (
        color 0C
        echo       LOI: Khong tim thay C:\xampp\mysql\bin\mysqld.exe
        echo       Hay bat MySQL/MariaDB thu cong roi chay lai script.
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    start "MariaDB" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini"
    ping -n 9 127.0.0.1 >nul
    netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
    if errorlevel 1 (
        color 0C
        echo       LOI: MariaDB khong khoi dong duoc^!
        echo       Kiem tra C:\xampp\mysql\data co bi loi khong
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    echo       MariaDB: OK
)
echo.

REM ---------- 2. Backend ----------
echo [2/5] Kiem tra Backend API (port 3000)...
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo       Backend dang chay - BO QUA
) else (
    echo       Dang khoi dong Backend ^(Node + CLIP se load lan dau ~2s^)...
    cd /d "%~dp0backend-node"
    start "Zflix Backend" /min cmd /c "npm start > backend.log 2> backend.err"
    cd /d "%~dp0"
    ping -n 9 127.0.0.1 >nul
    netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
    if errorlevel 1 (
        color 0C
        echo       LOI: Backend khong khoi dong^! Xem backend-node\backend.err
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    echo       Backend: OK
)
echo.

REM ---------- 3. Video Processor (tuy chon) ----------
echo [3/5] Kiem tra Video Processor (port 8001)...
netstat -ano | findstr ":8001 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo       Video Processor dang chay - BO QUA
) else (
    set "PYCMD="
    where python >nul 2>&1
    if not errorlevel 1 set "PYCMD=python"
    if not defined PYCMD (
        where py >nul 2>&1
        if not errorlevel 1 set "PYCMD=py"
    )

    if not defined PYCMD (
        echo       CANH BAO: Khong co Python - bo qua video processor.
        echo       ^(Upload video/HLS se khong hoat dong.^)
    ) else (
        !PYCMD! -c "import fastapi, uvicorn, boto3, requests, dotenv" >nul 2>&1
        if errorlevel 1 (
            echo       Cai Python deps...
            !PYCMD! -m pip install --disable-pip-version-check -q -r "backend-python\video-processor\requirements.txt" > "backend-python\video-processor\pip.log" 2>&1
        )
        !PYCMD! -c "import fastapi, uvicorn, boto3, requests, dotenv" >nul 2>&1
        if errorlevel 1 (
            echo       CANH BAO: Thieu Python deps - bo qua video processor.
            echo       Xem backend-python\video-processor\pip.log
        ) else (
            pushd "backend-python\video-processor"
            start "Zflix Video" /min cmd /c "!PYCMD! -m uvicorn main:app --app-dir src --host 127.0.0.1 --port 8001 > video.log 2> video.err"
            popd
            ping -n 6 127.0.0.1 >nul
            netstat -ano | findstr ":8001 " | findstr "LISTENING" >nul
            if errorlevel 1 (
                echo       CANH BAO: Video Processor khong khoi dong - xem video.err
            ) else (
                echo       Video Processor: OK
            )
            where ffmpeg >nul 2>&1
            if errorlevel 1 echo       CANH BAO: Khong co ffmpeg - xu ly video upload se loi.
        )
    )
)
echo.

REM ---------- 4. Frontend ----------
echo [4/5] Kiem tra Frontend (port 5173)...
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo       Frontend dang chay - BO QUA
) else (
    echo       Dang khoi dong Frontend ^(Vite^)...
    cd /d "%~dp0frontend"
    start "Zflix Frontend" /min cmd /c "npm run dev > frontend.log 2> frontend.err"
    cd /d "%~dp0"
    ping -n 11 127.0.0.1 >nul
    netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
    if errorlevel 1 (
        color 0C
        echo       LOI: Frontend khong khoi dong^! Xem frontend\frontend.err
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    echo       Frontend: OK
)
echo.

REM ---------- 5. Kiem tra cau hinh R2/webhook ----------
echo [5/5] Kiem tra cau hinh upload video...
findstr /b /c:"R2_ACCOUNT_ID=" "backend-node\.env" >nul
if errorlevel 1 echo       CANH BAO: backend-node\.env thieu R2_* - upload video se loi.
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"VIDEO_WEBHOOK_SECRET=" "backend-node\.env"') do if "%%B"=="" echo       CANH BAO: VIDEO_WEBHOOK_SECRET dang trong - webhook HLS se bi tu choi.
echo.

echo ============================================
echo   TAT CA SERVER DA SAN SANG^!
echo.
echo   Web       : http://localhost:5173
echo   API       : http://localhost:3000
echo   Quet do   : http://localhost:5173/watch/1128
echo   Admin     : http://localhost:5173/admin-login
echo   Kho phim  : http://localhost:5173/admin/content
echo.
echo   TK admin  : admin@moviehub.com / Zflix@2026  ^(dang nhap tai /admin-login^)
echo   TK user   : john.doe@email.com / Zflix@2026
echo.
echo   Cua so server dang chay o taskbar (toi uu).
echo   De TAT: chay stop-zflix.bat
echo ============================================
echo.
start http://localhost:5173
if not defined ZFLIX_NO_PAUSE pause
