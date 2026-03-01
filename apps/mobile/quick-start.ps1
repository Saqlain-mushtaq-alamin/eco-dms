# Quick Start Script for Eco-DMS Mobile App

Write-Host "=== Eco-DMS Mobile App - Quick Start ===" -ForegroundColor Green
Write-Host ""
Write-Host "This script will help you test the mobile app on both Android and iPhone." -ForegroundColor Cyan
Write-Host ""

# Set location
Set-Location $PSScriptRoot

# Check prerequisites
Write-Host "[Checking prerequisites...]" -ForegroundColor Yellow
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check npm
$npmVersion = npm --version 2>$null
if ($npmVersion) {
    Write-Host "[OK] npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] npm not found" -ForegroundColor Red
    exit 1
}

# Check Android tools
$adbVersion = adb version 2>$null
if ($adbVersion) {
    Write-Host "[OK] Android ADB installed" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Android ADB not found (optional for Android testing)" -ForegroundColor Yellow
}

# Check dependencies
if (Test-Path "node_modules\expo") {
    Write-Host "[OK] Expo dependencies installed" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Dependencies missing. Installing..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
}

Write-Host ""
Write-Host "Select your test platform:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Test on Android Emulator (Windows)" -ForegroundColor Yellow
Write-Host "2. Test on iPhone via QR Code (same WiFi)" -ForegroundColor Yellow
Write-Host "3. Test on iPhone via Tunnel (any network)" -ForegroundColor Yellow
Write-Host "4. Show all options / Interactive mode" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

Write-Host ""

switch ($choice) {
    "1" {
        Write-Host "[Starting Android Emulator Test...]" -ForegroundColor Green
        Write-Host ""
        Write-Host "Instructions:" -ForegroundColor Cyan
        Write-Host "1. The Android emulator will start (wait ~30 seconds)" -ForegroundColor White
        Write-Host "2. Expo Go will be installed automatically" -ForegroundColor White
        Write-Host "3. The app will open in Expo Go" -ForegroundColor White
        Write-Host "4. Tap 'Run Tests' button in the app" -ForegroundColor White
        Write-Host "5. Verify all 5 tests pass" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        .\start-android.ps1
    }
    "2" {
        Write-Host "[Starting iPhone Test (QR Code)...]" -ForegroundColor Green
        Write-Host ""
        Write-Host "Instructions:" -ForegroundColor Cyan
        Write-Host "1. Install 'Expo Go' from App Store on your iPhone" -ForegroundColor White
        Write-Host "2. Connect your iPhone to the SAME WiFi as this PC" -ForegroundColor White
        Write-Host "3. A QR code will appear below" -ForegroundColor White
        Write-Host "4. Open Camera app on iPhone and scan the QR code" -ForegroundColor White
        Write-Host "5. Tap the notification to open in Expo Go" -ForegroundColor White
        Write-Host "6. Tap 'Run Tests' button in the app" -ForegroundColor White
        Write-Host "7. Verify all 5 tests pass" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        .\start-iphone.ps1
    }
    "3" {
        Write-Host "[Starting iPhone Test (Tunnel Mode)...]" -ForegroundColor Green
        Write-Host ""
        Write-Host "Instructions:" -ForegroundColor Cyan
        Write-Host "1. Install 'Expo Go' from App Store on your iPhone" -ForegroundColor White
        Write-Host "2. A QR code will appear (works on ANY network)" -ForegroundColor White
        Write-Host "3. Open Camera app on iPhone and scan the QR code" -ForegroundColor White
        Write-Host "4. Tap the notification to open in Expo Go" -ForegroundColor White
        Write-Host "5. Wait a bit longer for tunnel to connect" -ForegroundColor White
        Write-Host "6. Tap 'Run Tests' button in the app" -ForegroundColor White
        Write-Host "7. Verify all 5 tests pass" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        .\start-iphone.ps1 -tunnel
    }
    "4" {
        Write-Host "[Starting Interactive Mode...]" -ForegroundColor Green
        Write-Host ""
        Write-Host "You will see an interactive menu with all options." -ForegroundColor White
        Write-Host "- Press 'a' for Android" -ForegroundColor White
        Write-Host "- Press 'w' for Web browser" -ForegroundColor White
        Write-Host "- Scan QR code for iPhone" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        $env:EXPO_NO_TELEMETRY = "1"
        npm start
    }
    default {
        Write-Host "[ERROR] Invalid choice. Please run the script again." -ForegroundColor Red
        exit 1
    }
}
