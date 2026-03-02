import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletConnectModal, useWalletConnectModal } from '@walletconnect/modal-react-native';
import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletContextType } from '../types';
import { WALLETCONNECT_PROJECT_ID } from '../config/walletConnect';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    const { open, isConnected, address, provider } = useWalletConnectModal();
    const [isLoading, setIsLoading] = useState(false);

    // Connect wallet
    const connectWallet = async () => {
        try {
            setIsLoading(true);
            await open();
            // WalletConnect modal opens
            // User selects wallet (MetaMask, Trust, etc.)
            // Wallet app opens automatically
            // User approves connection
            // isConnected becomes true
            // address is populated
        } catch (error) {
            console.error('Connect wallet error:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Disconnect wallet
    const disconnectWallet = async () => {
        try {
            if (provider?.disconnect) {
                await provider.disconnect();
            }
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('wallet_address');
        } catch (error) {
            console.error('Disconnect error:', error);
            throw error;
        }
    };

    // Sign message with wallet
    const signMessage = async (message: string): Promise<string> => {
        if (!provider || !address) {
            throw new Error('Wallet not connected');
        }

        try {
            // Request signature from wallet
            // This will open the wallet app again
            // User signs the message
            // Signature is returned
            const signature = await provider.request({
                method: 'personal_sign',
                params: [message, address],
            }) as any;

            return signature;
        } catch (error) {
            console.error('Sign message error:', error);
            throw error;
        }
    };

    // Save address when connected
    useEffect(() => {
        if (isConnected && address) {
            AsyncStorage.setItem('wallet_address', address);
        }
    }, [isConnected, address]);

    const value: WalletContextType = {
        address: address ?? null,
        isConnected,
        isLoading,
        connectWallet,
        disconnectWallet,
        signMessage,
        provider,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
            <WalletConnectModal
                projectId={WALLETCONNECT_PROJECT_ID}
                providerMetadata={{
                    name: 'Eco-DMS',
                    description: 'Decentralized Document Management System with ML Verification',
                    url: 'https://eco-dms.com',
                    icons: ['https://eco-dms.com/icon.png'],
                    redirect: {
                        native: 'ecodms://',
                        universal: 'https://eco-dms.com',
                    },
                }}
                sessionParams={{
                    namespaces: {
                        eip155: {
                            methods: [
                                'eth_sendTransaction',
                                'eth_signTransaction',
                                'eth_sign',
                                'personal_sign',
                                'eth_signTypedData',
                            ],
                            chains: ['eip155:1', 'eip155:31337'], // Ethereum mainnet + Hardhat local
                            events: ['chainChanged', 'accountsChanged'],
                            rpcMap: {},
                        },
                    },
                }}
            />
        </WalletContext.Provider>
    );
}

export function useWallet(): WalletContextType {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within WalletProvider');
    }
    return context;
}
