import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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

    // Use refs to track latest values for the polling function
    const isConnectedRef = useRef(isConnected);
    const addressRef = useRef(address);
    const providerRef = useRef(provider);

    useEffect(() => {
        isConnectedRef.current = isConnected;
        addressRef.current = address;
        providerRef.current = provider;
        console.log('📡 Connection state updated:', { isConnected, address: address?.substring(0, 10) + '...' || 'none', hasProvider: !!provider });
    }, [isConnected, address, provider]);

    // Connect wallet
    const connectWallet = async (): Promise<string> => {
        try {
            setIsLoading(true);

            // If already connected, return address
            if (isConnectedRef.current && addressRef.current) {
                console.log('✅ Already connected:', addressRef.current);
                setIsLoading(false);
                return addressRef.current;
            }

            // Open WalletConnect modal
            console.log('🔵 Opening WalletConnect modal...');
            const result = await open();
            console.log('🔵 Modal result:', result);

            // Give extra time for the hook to update
            console.log('⏳ Waiting for connection state to update...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check if we got connected
            if (isConnectedRef.current && addressRef.current) {
                setIsLoading(false);
                console.log('✅ Connected immediately! Address:', addressRef.current);
                return addressRef.current;
            }

            // If not connected yet, check the provider directly
            console.log('Checking provider for connection info...');
            const currentProvider = providerRef.current;
            if (currentProvider) {
                console.log('Provider exists:', Object.keys(currentProvider));

                // Try to get accounts from provider
                try {
                    const accounts = await currentProvider.request({ method: 'eth_accounts' }) as string[];
                    console.log('Accounts from provider:', accounts);
                    if (accounts && accounts.length > 0) {
                        const addr = accounts[0];
                        setIsLoading(false);
                        console.log('✅ Got address from provider:', addr);
                        return addr;
                    }
                } catch (providerError) {
                    console.error('Error getting accounts from provider:', providerError);
                }
            } else {
                console.log('❌ No provider available yet');
            }

            // Last resort: poll for connection
            console.log('Starting polling for connection...');
            return await new Promise<string>((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 30; // 30 seconds

                const checkConnection = setInterval(() => {
                    attempts++;

                    const connected = isConnectedRef.current;
                    const addr = addressRef.current;

                    console.log(`⏳ [${attempts}/${maxAttempts}] isConnected: ${connected}, hasAddress: ${!!addr}`);

                    if (connected && addr) {
                        clearInterval(checkConnection);
                        setIsLoading(false);
                        console.log('✅ Connection successful! Address:', addr);
                        resolve(addr);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkConnection);
                        setIsLoading(false);
                        console.error('❌ Connection not detected');
                        reject(new Error('Could not detect wallet connection. Please try connecting again.'));
                    }
                }, 1000);
            });
        } catch (error) {
            setIsLoading(false);
            console.error('❌ Connect wallet error:', error);
            throw error;
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
