# React Native Metro Bundler Firewall Setup
# Run this script as Administrator

Write-Host "Setting up Windows Firewall for React Native Metro Bundler..." -ForegroundColor Green

# Add firewall rule for Metro bundler (port 8081)
$ruleName = "React Native Metro Bundler"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "Firewall rule '$ruleName' already exists." -ForegroundColor Yellow
}
else {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8081 `
        -Action Allow `
        -Profile Private, Public `
        -Description "Allow React Native Metro bundler incoming connections"
    
    Write-Host "✅ Firewall rule added successfully!" -ForegroundColor Green
}

# Also add rule for Expo CLI (port 19000-19001)
$expoRuleName = "Expo Development Server"
$existingExpoRule = Get-NetFirewallRule -DisplayName $expoRuleName -ErrorAction SilentlyContinue

if ($existingExpoRule) {
    Write-Host "Firewall rule '$expoRuleName' already exists." -ForegroundColor Yellow
}
else {
    New-NetFirewallRule -DisplayName $expoRuleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 19000-19001 `
        -Action Allow `
        -Profile Private, Public `
        -Description "Allow Expo development server incoming connections"
    
    Write-Host "✅ Expo firewall rule added successfully!" -ForegroundColor Green
}

Write-Host "`n✅ Firewall setup complete!" -ForegroundColor Green
Write-Host "You can now connect your phone to the Metro bundler." -ForegroundColor Cyan
