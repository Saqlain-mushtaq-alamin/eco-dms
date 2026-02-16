# WalletConnect Setup Guide

## Getting Your Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Sign in or create a free account
3. Click "Create New Project"
4. Enter project details:
   - **Name**: Eco DMS
   - **Homepage URL**: https://eco-dms.app (or your domain)
5. Copy your **Project ID**

## Configure the Mobile App

1. Open `apps/mobile/src/context/WalletContext.tsx`
2. Replace `YOUR_PROJECT_ID_HERE` with your actual Project ID:

```typescript
const PROJECT_ID = 'abc123def456...'; // Your actual project ID
```

## Test the Integration

1. ✅ Dependencies are already installed

2. Start the app:
```bash
pnpm start
```

3. On the Sign In screen, tap "Connect Wallet"
4. The WalletConnect modal will appear
5. Select your wallet app (MetaMask, Trust Wallet, Rainbow, etc.)
6. Approve the connection in your wallet
7. Sign the SIWE message to authenticate

## Supported Wallets

WalletConnect supports 300+ wallets including:
- MetaMask Mobile
- Trust Wallet
- Rainbow Wallet
- Coinbase Wallet
- Argent
- Zerion
- And many more!

## Troubleshooting

### "Invalid project ID" error
- Make sure you've replaced `YOUR_PROJECT_ID_HERE` with your actual ID
- Verify the ID is correct (no extra spaces or quotes)

### Wallet doesn't redirect back
- Make sure the deep linking scheme is configured in `app.json`
- Try force-closing and reopening both apps

### "Cannot connect" error
- Ensure both your phone and wallet app have internet connection
- Try a different wallet app
- Check WalletConnect Cloud dashboard for any issues

## Development Notes

- Deep linking scheme: `ecodms://`
- Works on both iOS and Android
- Requires physical device or emulator with wallet app installed
- For testing, install MetaMask Mobile app on your device
