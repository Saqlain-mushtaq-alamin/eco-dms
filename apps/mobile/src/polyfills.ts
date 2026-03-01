// React Native polyfills for crypto and web APIs
// This file must be imported first in index.js
// CRITICAL: Order matters! Load these before anything else.

// 1. Random number generation (MUST BE FIRST)
import 'react-native-get-random-values';

// 2. Buffer polyfill
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// 3. Process polyfill
import process from 'process';
global.process = process;

// 4. Expo crypto for getRandomValues
import * as Crypto from 'expo-crypto';

// 5. Crypto polyfill
if (typeof global.crypto === 'undefined') {
    global.crypto = {
        getRandomValues: (buffer: any) => {
            const randomBytes = Crypto.getRandomBytes(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = randomBytes[i];
            }
            return buffer;
        },
    } as any;
}

// 6. WalletConnect React Native Compat (MUST be loaded before WalletConnect)
// This sets up all the required polyfills for WalletConnect to work in React Native
import '@walletconnect/react-native-compat';
