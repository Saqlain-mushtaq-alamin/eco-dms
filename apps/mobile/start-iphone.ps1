param(
    [switch]$Lan
)

$env:EXPO_NO_TELEMETRY = "1"

Write-Host "=== Eco-DMS Mobile (iPhone QR) ===" -ForegroundColor Green
Write-Host ""

if ($Lan) {
    Write-Host "[Starting in LAN mode] iPhone and PC must be on the same Wi-Fi." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "[Starting in TUNNEL mode] Recommended to avoid timeout/network issues." -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "  1. Open Expo Go on your iPhone"
Write-Host "  2. Scan the QR code shown in this terminal"
Write-Host "  3. Keep this terminal running while testing"
Write-Host ""

Set-Location $PSScriptRoot

if ($Lan) {
    npx expo start --host lan --clear
} else {
    npx expo start --tunnel --clear
}
