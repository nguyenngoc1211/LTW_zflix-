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
    echo.
    echo       Chay lan dau? Dung script cai dat:
    echo           setup-zflix.bat
    echo.
    echo       Hoac tu lam:
    echo           copy backend-node\.env.example backend-node\.env
    echo           roi dien DATABASE_URL / JWT_ACCESS_SECRET truoc khi chay.
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
echo [1/5] Kiem tra database...

REM Doc port tu DATABASE_URL trong .env (mac dinh 3306)
set "DB_PORT=3306"
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"DATABASE_URL=" "%~dp0backend-node\.env" 2^>nul') do (
    for /f "tokens=4 delims=:/" %%P in ("%%B") do set "DB_PORT=%%P"
)
if "!DB_PORT!"=="" set "DB_PORT=3306"

REM Che do B (portable): setup-zflix.bat tao .localdb/, DB chay port rieng
set "LOCALDB="
if exist "%~dp0.localdb\my.ini" (
    for /d %%D in ("%~dp0.localdb\mariadb-*") do if exist "%%D\bin\mysqld.exe" set "LOCALDB=%%D"
)

if defined LOCALDB (
    echo       Chong: MariaDB portable ^(.localdb/^)
    netstat -ano | findstr ":!DB_PORT! " | findstr "LISTENING" >nul
    if not errorlevel 1 (
        echo       MariaDB portable dang chay ^(port !DB_PORT!^) - BO QUA
    ) else (
        echo       Dang khoi dong MariaDB portable ^(port !DB_PORT!^)...
        start "MariaDB portable" /min "!LOCALDB!\bin\mysqld.exe" --defaults-file="%~dp0.localdb\my.ini"
        ping -n 10 127.0.0.1 >nul
        netstat -ano | findstr ":!DB_PORT! " | findstr "LISTENING" >nul
        if errorlevel 1 (
            color 0C
            echo       LOI: MariaDB portable khong khoi dong duoc^!
            echo       Xem loi trong %~dp0.localdb\data\*.err
            echo       Thu xoa thu muc .localdb roi chay lai setup-zflix.bat
            if not defined ZFLIX_NO_PAUSE pause
            exit /b 1
        )
        echo       MariaDB portable: OK
    )
    goto :db_ready
)

REM Che do A: MySQL cai san tren may (port 3306)
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo       MariaDB dang chay - BO QUA
) else (
    echo       Dang khoi dong MariaDB...

    REM Tim mysqld.exe: XAMPP mac dinh, Laragon, MySQL Server, hoac trong PATH
    set "MYSQLD_EXE="
    set "MYSQL_INI="
    if exist "C:\xampp\mysql\bin\mysqld.exe" (
        set "MYSQLD_EXE=C:\xampp\mysql\bin\mysqld.exe"
        set "MYSQL_INI=C:\xampp\mysql\bin\my.ini"
    )
    if not defined MYSQLD_EXE if exist "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqld.exe" (
        set "MYSQLD_EXE=C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqld.exe"
        set "MYSQL_INI=C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\my.ini"
    )
    if not defined MYSQLD_EXE if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" (
        set "MYSQLD_EXE=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
        set "MYSQL_INI=C:\Program Files\MySQL\MySQL Server 8.0\my.ini"
    )
    if not defined MYSQLD_EXE if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" (
        set "MYSQLD_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
        set "MYSQL_INI=C:\Program Files\MySQL\MySQL Server 8.4\my.ini"
    )
    if not defined MYSQLD_EXE (
        for /f "delims=" %%P in ('where mysqld 2^>nul') do if not defined MYSQLD_EXE set "MYSQLD_EXE=%%P"
    )

    if not defined MYSQLD_EXE (
        color 0C
        echo       LOI: Khong tim thay mysqld.exe
        echo       Da tim: XAMPP, Laragon, MySQL Server 8.0/8.4, PATH.
        echo       Hay bat MySQL/MariaDB thu cong ^(XAMPP Control Panel^) roi chay lai script.
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    echo       Dung: !MYSQLD_EXE!

    if defined MYSQL_INI (
        if exist "!MYSQL_INI!" (
            start "MariaDB" /min "!MYSQLD_EXE!" --defaults-file="!MYSQL_INI!"
        ) else (
            start "MariaDB" /min "!MYSQLD_EXE!"
        )
    ) else (
        start "MariaDB" /min "!MYSQLD_EXE!"
    )
    ping -n 9 127.0.0.1 >nul
    netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul
    if errorlevel 1 (
        color 0C
        echo       LOI: MariaDB khong khoi dong duoc^!
        echo       Kiem tra thu muc data cua MySQL co bi loi khong.
        if not defined ZFLIX_NO_PAUSE pause
        exit /b 1
    )
    echo       MariaDB: OK
)

:db_ready
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
            if errorlevel 1 (
                echo       CANH BAO: Khong co ffmpeg trong PATH - cat video HLS se loi.
                echo       Cai: winget install Gyan.FFmpeg   ^(hoac tai ffmpeg.org, giai nen, them bin vao PATH^)
            )
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

REM ---------- 5. Kiem tra cau hinh upload video ----------
echo [5/5] Kiem tra cau hinh upload video...
set "R2_MISSING=0"
findstr /b /c:"R2_ACCOUNT_ID=" "backend-node\.env" >nul 2>&1 || set "R2_MISSING=1"
findstr /b /c:"R2_ACCESS_KEY_ID=" "backend-node\.env" >nul 2>&1 || set "R2_MISSING=1"
findstr /b /c:"R2_SECRET_ACCESS_KEY=" "backend-node\.env" >nul 2>&1 || set "R2_MISSING=1"
if "!R2_MISSING!"=="1" echo       CANH BAO: backend-node\.env thieu R2_* - upload video se loi.

set "R2_EMPTY=0"
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"R2_ACCOUNT_ID=" "backend-node\.env" 2^>nul') do if "%%B"=="" set "R2_EMPTY=1"
if "!R2_EMPTY!"=="1" echo       CANH BAO: R2_ACCOUNT_ID dang trong - upload video se loi.
if "!R2_MISSING!"=="0" if "!R2_EMPTY!"=="0" echo       R2: OK

set "WH_EMPTY=0"
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"VIDEO_WEBHOOK_SECRET=" "backend-node\.env" 2^>nul') do if "%%B"=="" set "WH_EMPTY=1"
if "!WH_EMPTY!"=="1" echo       CANH BAO: VIDEO_WEBHOOK_SECRET dang trong - webhook HLS se bi tu choi.
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
echo   TK admin  : admin@moviehub.com
echo   TK user   : john.doe@email.com
echo   Mat khau  : Zflix@2026  ^(chi khi da chay setup-zflix.bat^)
echo.
echo   Chua dang nhap duoc? Chay: cd backend-node ^&^& npm run db:password
echo.
echo   Cua so server dang chay o taskbar (toi uu).
echo   De TAT: chay stop-zflix.bat
echo ============================================
echo.
start http://localhost:5173
if not defined ZFLIX_NO_PAUSE pause
