import React, { createContext, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';

/**
 * Wallet Context - Simplified for Mobile
 * 
 * WalletConnect has been removed to avoid polyfill conflicts.
 * The app uses SIWE (Sign-In With Ethereum) authentication through the backend API.
 * Users can still authenticate with their wallet address without WalletConnect modal.
 */

type WalletContextType = {
    isConnected: boolean;
    address: string | undefined;
    provider: any;
    open: () => void;
    close: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
    // Simplified wallet provider without WalletConnect
    // Authentication happens through backend API using wallet address input
    const walletData: WalletContextType = {
        isConnected: false,
        address: undefined,
        provider: undefined,
        open: () => {
            Alert.alert(
                'Wallet Connection',
                'Use the Sign In screen to authenticate with your wallet address.',
                [{ text: 'OK' }]
            );
        },
        close: () => { },
    };

    return (
        <WalletContext.Provider value={walletData}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within WalletProvider');
    }
    return context;
}
