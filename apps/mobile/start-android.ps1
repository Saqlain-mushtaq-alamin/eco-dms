param(
    [string]$Emulator = ""
)

Write-Host "=== Eco-DMS Mobile (Android) ===" -ForegroundColor Green
Write-Host ""

Set-Location $PSScriptRoot
$env:EXPO_NO_TELEMETRY = "1"

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$emulatorCommand = Get-Command emulator -ErrorAction SilentlyContinue

if (-not $adbCommand) {
    Write-Host "[ERROR] adb is not in PATH. Install Android SDK Platform-Tools and add it to PATH." -ForegroundColor Red
    exit 1
}

if (-not $emulatorCommand) {
    Write-Host "[ERROR] emulator is not in PATH. Install Android SDK Emulator and add it to PATH." -ForegroundColor Red
    exit 1
}

$running = (& adb devices) | Select-String "emulator-"
if (-not $running) {
    if ([string]::IsNullOrWhiteSpace($Emulator)) {
        $availableAvds = & emulator -list-avds
        if (-not $availableAvds -or $availableAvds.Count -eq 0) {
            Write-Host "[ERROR] No Android Virtual Devices found. Create one in Android Studio > Device Manager." -ForegroundColor Red
            exit 1
        }
        $Emulator = $availableAvds[0]
    }

    Write-Host "[Starting Android emulator: $Emulator]" -ForegroundColor Cyan
    Start-Process -FilePath $emulatorCommand.Source -ArgumentList "-avd", $Emulator | Out-Null

    Write-Host "[Waiting for emulator to connect...]" -ForegroundColor Yellow
    & adb wait-for-device | Out-Null

    $bootCompleted = $false
    for ($i = 0; $i -lt 60; $i++) {
        $boot = (& adb shell getprop sys.boot_completed 2>$null).Trim()
        if ($boot -eq "1") {
            $bootCompleted = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if (-not $bootCompleted) {
        Write-Host "[WARNING] Emulator did not report full boot yet; continuing anyway..." -ForegroundColor Yellow
    }
    else {
        Write-Host "[OK] Emulator boot completed" -ForegroundColor Green
    }
}
else {
    Write-Host "[OK] Android emulator already running" -ForegroundColor Green
}

Write-Host "[Configuring ADB reverse ports...]" -ForegroundColor Cyan
& adb reverse tcp:8081 tcp:8081 | Out-Null
& adb reverse tcp:19000 tcp:19000 | Out-Null
& adb reverse tcp:19001 tcp:19001 | Out-Null
Write-Host "[OK] ADB reverse configured" -ForegroundColor Green

Write-Host ""
Write-Host "[Starting Expo for Android emulator...]" -ForegroundColor Green
Write-Host ""
npx expo start --android --host localhost --clear
