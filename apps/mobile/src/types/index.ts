/**
 * Type definitions for Eco-DMS Mobile
 */

export interface NonceResponse {
    nonce: string;
    expires_at: number;
}

export interface PrepareMessageResponse {
    message: string;
}

export interface AuthResponse {
    address: string;
    profile_cid: string | null;
    token: string;
}

export interface User {
    address: string;
    profile_cid?: string | null;
}

export interface WalletContextType {
    address: string | null;
    isConnected: boolean;
    isLoading: boolean;
    connectWallet: () => Promise<string>;
    disconnectWallet: () => Promise<void>;
    signMessage: (message: string) => Promise<string>;
    provider: any;
}
