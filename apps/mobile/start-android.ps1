# Start Android Emulator and Expo App

param(
    [string]$emulator = "Pixel_9_Pro"
)

Write-Host "=== Starting Eco-DMS Mobile App ===" -ForegroundColor Green
Write-Host ""

# Set Android SDK path
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$emulatorPath = "$env:ANDROID_HOME\emulator\emulator.exe"

# Set Expo environment variables
$env:EXPO_NO_TELEMETRY = "1"

# Check if emulator exists
if (-not (Test-Path $emulatorPath)) {
    Write-Host "[ERROR] Android emulator not found at $emulatorPath" -ForegroundColor Red
    Write-Host "Please install Android Studio and Android SDK" -ForegroundColor Yellow
    exit 1
}

# Check if emulator is already running
$running = adb devices | Select-String "emulator"
if ($running) {
    Write-Host "[OK] Android emulator is already running" -ForegroundColor Green
}
else {
    Write-Host "[Starting Android emulator: $emulator]" -ForegroundColor Cyan
    Start-Process $emulatorPath -ArgumentList "-avd", $emulator -WindowStyle Normal
    
    Write-Host "[Waiting for emulator to boot (30 seconds)...]" -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    $devices = adb devices
    Write-Host "Connected devices:" -ForegroundColor Cyan
    Write-Host $devices
}

Write-Host ""
Write-Host "[Setting up ADB port forwarding...]" -ForegroundColor Cyan
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:19000 tcp:19000 | Out-Null
adb reverse tcp:19001 tcp:19001 | Out-Null
Write-Host "[OK] ADB ports configured" -ForegroundColor Green

Write-Host ""
Write-Host "[Starting Expo on Android...]" -ForegroundColor Green
Write-Host ""

# Change to mobile directory and start Expo
Set-Location $PSScriptRoot
npm start -- --android

Write-Host ""
Write-Host "[DONE] The app should open in the Android emulator." -ForegroundColor Green
