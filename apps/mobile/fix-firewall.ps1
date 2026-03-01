#!/usr/bin/env pwsh
# Fix Windows Firewall for Expo Metro Bundler

Write-Host "🔧 Configuring Windows Firewall for Expo..." -ForegroundColor Cyan
Write-Host ""

# Allow Node.js through firewall
Write-Host "Adding firewall rules for Node.js and Metro Bundler..." -ForegroundColor Yellow

# Find Node.js executable
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodePath) {
    Write-Host "Node.js found at: $nodePath" -ForegroundColor Green
    
    # Remove existing rules
    Remove-NetFirewallRule -DisplayName "Node.js Metro Bundler" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Expo Metro Bundler TCP" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Expo Metro Bundler UDP" -ErrorAction SilentlyContinue
    
    # Add new rules for TCP ports (8081, 19000, 19001, 19002)
    New-NetFirewallRule -DisplayName "Node.js Metro Bundler" `
        -Direction Inbound `
        -Program $nodePath `
        -Action Allow `
        -Profile Private,Domain `
        -Protocol TCP `
        -LocalPort 8081,19000,19001,19002 `
        -ErrorAction SilentlyContinue | Out-Null
    
    New-NetFirewallRule -DisplayName "Expo Metro Bundler TCP" `
        -Direction Inbound `
        -Action Allow `
        -Profile Private,Domain `
        -Protocol TCP `
        -LocalPort 8081,19000,19001,19002 `
        -ErrorAction SilentlyContinue | Out-Null
    
    New-NetFirewallRule -DisplayName "Expo Metro Bundler UDP" `
        -Direction Inbound `
        -Action Allow `
        -Profile Private,Domain `
        -Protocol UDP `
        -LocalPort 19000,19001 `
        -ErrorAction SilentlyContinue | Out-Null
    
    Write-Host "✅ Firewall rules added successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Node.js not found in PATH" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Configuring network discovery..." -ForegroundColor Yellow

# Enable network discovery
Set-NetFirewallProfile -Profile Private -NetworkDiscovery Enabled -ErrorAction SilentlyContinue
Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue

Write-Host "✅ Network discovery enabled" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Firewall configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run the app with:" -ForegroundColor Cyan
Write-Host "  .\start-android.ps1  (for Android)" -ForegroundColor Yellow
Write-Host "  .\start-iphone.ps1   (for iPhone)" -ForegroundColor Yellow
