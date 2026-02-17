// Type declarations for polyfills
declare global {
    var Buffer: typeof import('buffer').Buffer;
    var process: typeof import('process');

    interface Crypto {
        getRandomValues: <T extends ArrayBufferView | null>(array: T) => T;
    }

    var crypto: Crypto;
}

export { };
