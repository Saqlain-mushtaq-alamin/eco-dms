# 🔧 React Native Polyfill Fix

## Problem

The error `react-native-compat: Application module is not available` and `TypeError: Cannot read property 'S' of undefined` occurs when WalletConnect dependencies are not properly polyfilled in React Native.

## Root Cause

WalletConnect v2 requires web APIs (Buffer, crypto, process) that don't exist in React Native. These polyfills **must be loaded before** any other code, including React Native itself.

## Solution Applied

### 1. ✅ Created Centralized Polyfill File

Created [src/polyfills.ts](src/polyfills.ts) that includes:
- `react-native-get-random-values` - Crypto random number generation
- `buffer` - Node.js Buffer API
- `process` - Node.js process global
- `@walletconnect/react-native-compat` - WalletConnect polyfills
- `expo-crypto` - Expo's crypto implementation

### 2. ✅ Updated Entry Point

Modified [index.js](index.js) to import polyfills **first**:
```javascript
// IMPORTANT: Polyfills must be imported FIRST
import './src/polyfills';

import { registerRootComponent } from 'expo';
import App from './src/app';

registerRootComponent(App);
```

### 3. ✅ Removed Duplicate Imports

Removed polyfill imports from [src/app.tsx](src/app.tsx) to avoid double-loading.

### 4. ✅ Installed Required Dependencies

Added to package.json:
- `buffer@^6.0.3`
- `process@^0.11.10`

### 5. ✅ Fixed React Native Version Mismatch

Aligned React Native version to `0.81.5` to match monorepo pnpm override.

## Testing the Fix

### Step 1: Clean Install
```bash
cd D:\canvas\eco-dms\eco-dms\apps\mobile
pnpm install
```

### Step 2: Clear Metro Cache
```bash
# Clear all caches
pnpm start --clear

# Or manually clear
rm -rf node_modules/.cache
rm -rf .expo
```

### Step 3: Start Metro Bundler
```bash
pnpm start
```

### Step 4: Test on Device/Emulator

**For Android:**
```bash
pnpm android
```

**For iOS:**
```bash
pnpm ios
```

**Or scan QR code** with Expo Go app

## Verification Checklist

- [ ] No "Application module is not available" error
- [ ] No "Cannot read property 'S' of undefined" error
- [ ] App loads without blank screen
- [ ] Console shows no red errors
- [ ] WalletConnect modal can be opened (if configured)

## Common Issues After Fix

### Issue 1: Still seeing blank screen

**Solution:** Clear Metro cache completely
```bash
# Stop Metro bundler (Ctrl+C)
# Clear cache
pnpm start --clear

# Or use watchman
watchman watch-del-all
```

### Issue 2: "Invariant Violation" errors

**Solution:** Ensure polyfills are loaded first
- Check that `import './src/polyfills';` is the **first line** in index.js
- No other imports should come before it

### Issue 3: "crypto.getRandomValues is not a function"

**Solution:** Ensure expo-crypto is installed and polyfills are loaded
```bash
pnpm add expo-crypto
```

### Issue 4: Metro bundler not finding modules

**Solution:** Reinstall dependencies
```bash
rm -rf node_modules
pnpm install
pnpm start --clear
```

## Files Changed

| File | Change |
|------|--------|
| [index.js](index.js) | Import polyfills first |
| [src/polyfills.ts](src/polyfills.ts) | Created centralized polyfills |
| [src/polyfills.d.ts](src/polyfills.d.ts) | TypeScript type declarations |
| [src/app.tsx](src/app.tsx) | Removed duplicate polyfills |
| [package.json](package.json) | Added buffer, process; fixed React Native version |

## Technical Details

### Load Order is Critical

```javascript
// ✅ CORRECT
import './src/polyfills';  // FIRST!
import { registerRootComponent } from 'expo';
import App from './src/app';

// ❌ INCORRECT
import { registerRootComponent } from 'expo';
import './src/polyfills';  // Too late!
import App from './src/app';
```

### What Each Polyfill Does

1. **react-native-get-random-values**
   - Provides `crypto.getRandomValues()` for React Native
   - Required by WalletConnect for secure random number generation

2. **buffer**
   - Provides Node.js Buffer API in React Native
   - Used extensively by crypto libraries

3. **process**
   - Provides Node.js `process` global
   - Required by many Node.js-style packages

4. **@walletconnect/react-native-compat**
   - WalletConnect's official React Native compatibility layer
   - Must be loaded after Buffer and process

5. **expo-crypto**
   - Expo's native crypto implementation
   - Fallback for crypto.getRandomValues

## Next Steps

1. ✅ Test the app on physical device and emulator
2. ⏭️ Configure WalletConnect Project ID in `src/context/WalletContext.tsx`
3. ⏭️ Test WalletConnect integration
4. ⏭️ Add error boundaries for better error handling

## Need Help?

If you're still experiencing issues:

1. Check the Metro bundler terminal for error messages
2. Look in the device console (Chrome DevTools for Android, Safari DevTools for iOS)
3. Try running with `--reset-cache` flag
4. Ensure all dependencies are up to date

## References

- [WalletConnect React Native Setup](https://github.com/WalletConnect/walletconnect-monorepo/tree/v2.0/packages/react-native-compat)
- [Expo Crypto Documentation](https://docs.expo.dev/versions/latest/sdk/crypto/)
- [React Native Polyfills Guide](https://reactnative.dev/docs/javascript-environment)
