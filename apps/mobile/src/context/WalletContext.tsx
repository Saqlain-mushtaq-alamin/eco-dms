import React, { createContext, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const PROJECT_ID = '294df0b46b618142c74b235b57ba8b07';

// Temporarily disable WalletConnect to avoid polyfill issues
// Re-enable by setting this to true after ensuring all polyfills are loaded
const ENABLE_WALLETCONNECT = false; // PROJECT_ID && PROJECT_ID.length > 0;

// Conditionally import WalletConnect only if enabled
let WalletConnectModal: any;
let useWalletConnectModal: any;

if (ENABLE_WALLETCONNECT) {
    // Note: Polyfills are already loaded in polyfills.ts via index.js
    // No need to require them again here
    const walletConnect = require('@walletconnect/modal-react-native');
    WalletConnectModal = walletConnect.WalletConnectModal;
    useWalletConnectModal = walletConnect.useWalletConnectModal;
}

const providerMetadata = {
    name: 'Eco DMS',
    description: 'Decentralized eco-friendly content verification platform',
    url: 'https://eco-dms.app',
    icons: ['https://eco-dms.app/icon.png'],
    redirect: {
        native: 'ecodms://',
        universal: 'https://eco-dms.app',
    },
};

type WalletContextType = {
    isConnected: boolean;
    address: string | undefined;
    provider: any;
    open: () => void;
    close: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
    let modalData = {
        isConnected: false,
        address: undefined,
        provider: undefined,
        open: async () => {
            Alert.alert(
                'WalletConnect Not Available',
                'WalletConnect is not configured. Please add a valid PROJECT_ID in WalletContext.tsx'
            );
        },
        close: async () => { },
    };

    // Only use WalletConnect if enabled
    if (ENABLE_WALLETCONNECT && useWalletConnectModal) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        modalData = useWalletConnectModal();
    }

    const { isConnected, address, provider, open, close } = modalData;

    return (
        <WalletContext.Provider value={{ isConnected, address, provider, open, close }}>
            {children}
            {ENABLE_WALLETCONNECT && WalletConnectModal && (
                <WalletConnectModal
                    projectId={PROJECT_ID}
                    providerMetadata={providerMetadata}
                />
            )}
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
