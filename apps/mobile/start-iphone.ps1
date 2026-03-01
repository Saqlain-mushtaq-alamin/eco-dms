# Start Expo App for iPhone (QR Code)

param(
    [switch]$tunnel
)

# Set Expo environment variables
$env:EXPO_NO_TELEMETRY = "1"

Write-Host "=== Starting Eco-DMS Mobile App for iPhone ===" -ForegroundColor Green
Write-Host ""

if ($tunnel) {
    Write-Host "[Starting with tunnel mode (works across different networks)]" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "[Starting on local network]" -ForegroundColor Cyan
    Write-Host "[NOTE] Your iPhone and PC must be on the same WiFi network" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "  1. Install 'Expo Go' app from the App Store on your iPhone"
Write-Host "  2. Wait for the QR code to appear below"
Write-Host "  3. Open Camera app on iPhone and scan the QR code"
Write-Host "  4. Tap the notification to open in Expo Go"
Write-Host ""

# Change to mobile directory
Set-Location $PSScriptRoot

# Start Expo
if ($tunnel) {
    npm start -- --tunnel
}
else {
    npm start
}

Write-Host ""
Write-Host "[DONE] Expo server started!" -ForegroundColor Green
