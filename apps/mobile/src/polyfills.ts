// React Native polyfills for crypto and web APIs
// This file must be imported first in index.js

// 1. Random number generation
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

// Note: WalletConnect polyfills are loaded by @walletconnect/modal-react-native
// when the modal is actually initialized, so we don't need to import them here
