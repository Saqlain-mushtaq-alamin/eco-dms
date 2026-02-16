import React, { createContext, useContext, ReactNode } from 'react';
import { WalletConnectModal, useWalletConnectModal } from '@walletconnect/modal-react-native';

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const PROJECT_ID = 'YOUR_PROJECT_ID_HERE';

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
    open: () => Promise<void>;
    close: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
    const { isConnected, address, provider, open, close } = useWalletConnectModal();

    return (
        <WalletContext.Provider value={{ isConnected, address, provider, open, close }}>
            {children}
            <WalletConnectModal
                projectId={PROJECT_ID}
                providerMetadata={providerMetadata}
            />
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
