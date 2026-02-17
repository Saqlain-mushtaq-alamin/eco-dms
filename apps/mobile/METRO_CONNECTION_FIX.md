# 📱 React Native Metro Bundler - Connection Fix

## Quick Fix Steps

### 1️⃣ Configure Windows Firewall (Run as Administrator)

Open PowerShell as Administrator and run:
```powershell
cd apps/mobile
.\setup-firewall.ps1
```

Or manually add the firewall rule:
```powershell
New-NetFirewallRule -DisplayName "React Native Metro Bundler" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private,Public
```

### 2️⃣ Ensure Phone and PC are on Same WiFi Network

- Your PC IP: `192.168.0.109` (Ethernet)
- Your Phone: Must be on the same `192.168.0.x` network
- Check your phone's WiFi settings to verify

### 3️⃣ Start Metro Bundler with LAN Mode

```bash
cd apps/mobile
pnpm start
```

The updated script now uses `expo start --host lan` which binds to all network interfaces.

### 4️⃣ Alternative: Use Tunnel Mode (If LAN Doesn't Work)

If you're having persistent connection issues:
```bash
cd apps/mobile
pnpm start:tunnel
```

This uses ngrok to create a tunnel (no network configuration needed).

## Troubleshooting

### Error: "Could not connect to development server"

**Check 1: Metro bundler is running**
```bash
# In apps/mobile directory
pnpm start
```

Look for output showing:
```
Metro waiting on http://192.168.0.109:8081
```

**Check 2: Phone can reach PC**
- Open browser on your phone
- Navigate to `http://192.168.0.109:8081`
- You should see Metro bundler page

**Check 3: Firewall is allowing connections**
```powershell
# Check if firewall rule exists
Get-NetFirewallRule -DisplayName "React Native Metro Bundler"
```

**Check 4: Both devices on same network**
```powershell
# On PC, check your IP
ipconfig | Select-String "IPv4"

# On phone, check WiFi settings
# IP should be 192.168.0.x
```

### Clear Cache and Restart

If still having issues:
```bash
cd apps/mobile

# Clear Metro cache
pnpm start --clear

# Or clear React Native cache
npx react-native start --reset-cache
```

### Using Different Network Interface

If you have multiple network adapters (WiFi, Ethernet, WSL):
```powershell
# Check all network interfaces
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }

# Use the one your phone can reach (usually WiFi or Ethernet)
```

## Configuration Changes Made

### ✅ metro.config.js
- Added server configuration for network accessibility

### ✅ package.json
- Updated start script to use `--host lan`
- Added `start:tunnel` for tunnel mode

### ✅ Firewall Rules
- Port 8081 (Metro bundler)
- Ports 19000-19001 (Expo CLI)

## Testing the Connection

1. **Start the server:**
   ```bash
   cd apps/mobile
   pnpm start
   ```

2. **Scan QR code with Expo Go app** on your phone

3. **Or manually enter URL** in Expo Go:
   ```
   exp://192.168.0.109:8081
   ```

## Common Issues

| Issue | Solution |
|-------|----------|
| Connection refused | Check firewall, ensure both on same WiFi |
| Wrong IP address | Use `ipconfig` to find correct IP |
| Slow loading | Clear cache with `pnpm start --clear` |
| Can't scan QR | Use tunnel mode with `pnpm start:tunnel` |

## Need Help?

If none of the above works, try:
1. Restart your PC and phone
2. Temporarily disable Windows Firewall for testing
3. Use tunnel mode as a temporary solution
4. Check if antivirus is blocking connections
