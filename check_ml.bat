@echo off
REM Quick ML Verifier Test
REM Run this to verify your ML setup

echo ===============================================
echo ML Verifier Quick Check
echo ===============================================
echo.

REM Check if in correct directory
if not exist "backend\ml\models" (
    echo ERROR: Run this from the eco-dms project root
    exit /b 1
)

REM Check YOLOv8 model
echo [1/4] Checking YOLOv8 model...
if exist "backend\ml\models\yolov8_eco.pt" (
    echo   [OK] yolov8_eco.pt found
) else (
    echo   [FAIL] yolov8_eco.pt NOT FOUND
    echo   Place your model at: backend\ml\models\yolov8_eco.pt
)

REM Check Redis
echo.
echo [2/4] Checking Redis...
docker ps | findstr eco-redis >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Redis container running
) else (
    echo   [FAIL] Redis not running
    echo   Run: docker run -d --name eco-redis -p 6379:6379 redis:7
)

REM Check Celery Worker
echo.
echo [3/4] Checking Celery Worker...
tasklist | findstr celery >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Celery worker process found
) else (
    echo   [FAIL] Celery worker not running
    echo   Now starting with 'make dev'
)

REM Check Backend API
echo.
echo [4/4] Checking Backend API...
curl -s http://localhost:8000/api/verify/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Backend API responding
) else (
    echo   [FAIL] Backend not running
    echo   Run: make dev
)

echo.
echo ===============================================
echo For full verification, run: python verify_ml_system.py
echo To start all services: make dev
echo ===============================================
