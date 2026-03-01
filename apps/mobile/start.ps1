#!/usr/bin/env pwsh
# Start Eco-DMS Mobile App

Write-Host "🌱 Eco-DMS Mobile App Launcher" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""
Write-Host "Select how you want to run the app:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Android Emulator" -ForegroundColor Yellow
Write-Host "2. iPhone (via Tunnel QR - recommended)" -ForegroundColor Yellow
Write-Host "3. iPhone (via LAN QR - same WiFi)" -ForegroundColor Yellow
Write-Host "4. Web Browser" -ForegroundColor Yellow
Write-Host "5. Show all options (interactive menu)" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "Enter your choice (1-5)"

Set-Location $PSScriptRoot

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🤖 Launching on Android Emulator..." -ForegroundColor Green
        .\start-android.ps1
    }
    "2" {
        Write-Host ""
        Write-Host "🍎 Launching for iPhone (Tunnel Mode)..." -ForegroundColor Green
        .\start-iphone.ps1
    }
    "3" {
        Write-Host ""
        Write-Host "🍎 Launching for iPhone (LAN Mode)..." -ForegroundColor Green
        .\start-iphone.ps1 -Lan
    }
    "4" {
        Write-Host ""
        Write-Host "🌐 Launching in Web Browser..." -ForegroundColor Green
        npx expo start --web
    }
    "5" {
        Write-Host ""
        Write-Host "📋 Starting interactive menu..." -ForegroundColor Green
        npx expo start
    }
    default {
        Write-Host ""
        Write-Host "❌ Invalid choice. Starting interactive menu..." -ForegroundColor Red
        npx expo start
    }
}
