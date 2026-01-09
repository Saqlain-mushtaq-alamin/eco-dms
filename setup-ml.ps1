# Quick Setup Script for ML Verifier
# Run this to check if everything is ready

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ECO-DMS ML Verifier Setup Check" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Python
Write-Host "1. Checking Python..." -NoNewline
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.([0-9]+)") {
        if ([int]$matches[1] -ge 10) {
            Write-Host " ✓ $pythonVersion" -ForegroundColor Green
        } else {
            Write-Host " ✗ Python 3.10+ required (found $pythonVersion)" -ForegroundColor Red
            $allGood = $false
        }
    } else {
        Write-Host " ✗ Python not found" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " ✗ Python not found" -ForegroundColor Red
    $allGood = $false
}

# Check Redis
Write-Host "2. Checking Redis..." -NoNewline
$redisRunning = Get-Process redis-server -ErrorAction SilentlyContinue
if ($redisRunning) {
    Write-Host " ✓ Redis is running" -ForegroundColor Green
} else {
    Write-Host " ✗ Redis not running" -ForegroundColor Yellow
    Write-Host "   Start with: redis-server" -ForegroundColor Gray
    $allGood = $false
}

# Check YOLO model
Write-Host "3. Checking YOLOv8 model..." -NoNewline
$modelPath = ".\backend\ml\models\yolov8_eco.pt"
if (Test-Path $modelPath) {
    $modelSize = (Get-Item $modelPath).Length / 1MB
    Write-Host " ✓ Found ($([math]::Round($modelSize, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host " ✗ Model not found at $modelPath" -ForegroundColor Red
    Write-Host "   Place your trained YOLOv8 model there" -ForegroundColor Gray
    $allGood = $false
}

# Check ML dependencies
Write-Host "4. Checking ML dependencies..." -NoNewline
$missingPackages = @()

$packages = @(
    "torch",
    "torchvision",
    "ultralytics",
    "pillow",
    "celery",
    "redis",
    "web3",
    "httpx"
)

foreach ($pkg in $packages) {
    $installed = python -c "import $pkg" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $missingPackages += $pkg
    }
}

if ($missingPackages.Count -eq 0) {
    Write-Host " ✓ All packages installed" -ForegroundColor Green
} else {
    Write-Host " ✗ Missing: $($missingPackages -join ', ')" -ForegroundColor Red
    Write-Host "   Install with: pip install -r backend\ml\requirements-ml.txt" -ForegroundColor Gray
    $allGood = $false
}

# Check environment variables
Write-Host "5. Checking environment..." -NoNewline
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "REDIS_URL") {
        Write-Host " ✓ .env configured" -ForegroundColor Green
    } else {
        Write-Host " ⚠ Missing REDIS_URL in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host " ⚠ No .env file found" -ForegroundColor Yellow
    Write-Host "   Create .env with REDIS_URL, IPFS_GATEWAY_URL, etc." -ForegroundColor Gray
}

# Check verdict storage
Write-Host "6. Checking verdict storage..." -NoNewline
$verdictDir = ".\backend\ml_verdicts"
if (Test-Path $verdictDir) {
    Write-Host " ✓ Directory exists" -ForegroundColor Green
} else {
    Write-Host " ⚠ Creating directory..." -NoNewline
    New-Item -ItemType Directory -Path $verdictDir -Force | Out-Null
    Write-Host " Done" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "  ✓ Setup Complete! Ready to run." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start Redis: redis-server" -ForegroundColor White
    Write-Host "  2. Start Celery: celery -A backend.ml.worker worker --pool=solo --loglevel=info" -ForegroundColor White
    Write-Host "  3. Start Backend: cd backend && python -m app.main" -ForegroundColor White
    Write-Host "  4. Start Frontend: cd apps\web && npm run dev" -ForegroundColor White
} else {
    Write-Host "  ✗ Setup Incomplete. Fix issues above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Quick fix:" -ForegroundColor Cyan
    Write-Host "  pip install -r backend\ml\requirements-ml.txt" -ForegroundColor White
    Write-Host "  Place yolov8_eco.pt in backend\ml\models\" -ForegroundColor White
    Write-Host "  Start Redis server" -ForegroundColor White
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Offer to install dependencies
if ($missingPackages.Count -gt 0) {
    $install = Read-Host "Install missing Python packages now? (y/n)"
    if ($install -eq 'y') {
        Write-Host "Installing packages..." -ForegroundColor Cyan
        python -m pip install -r backend\ml\requirements-ml.txt
        Write-Host "Done!" -ForegroundColor Green
    }
}
