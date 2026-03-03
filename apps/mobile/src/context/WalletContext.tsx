import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import '@walletconnect/react-native-compat';
import { WalletConnectModal, useWalletConnectModal } from '@walletconnect/modal-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletContextType } from '../types';
import { WALLETCONNECT_PROJECT_ID, SUPPORTED_CHAINS } from '../config/walletConnect';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    const { open, isConnected, address, provider } = useWalletConnectModal();
    const [isLoading, setIsLoading] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

    // Use refs to track latest values for the polling function
    const isConnectedRef = useRef(isConnected);
    const addressRef = useRef(address);

    useEffect(() => {
        isConnectedRef.current = isConnected;
        addressRef.current = address;
        console.log('📡 Connection state updated:', { isConnected, address: address?.substring(0, 10) + '...' || 'none', hasProvider: !!provider });
        if (address) {
            setResolvedAddress(address);
        }
    }, [isConnected, address, provider]);

    const getAddressFromSession = (walletProvider: any): string | null => {
        try {
            const accounts: string[] | undefined = walletProvider?.session?.namespaces?.eip155?.accounts;
            if (!accounts || accounts.length === 0) {
                return null;
            }
            const first = accounts[0];
            const parts = first.split(':');
            const extracted = parts[parts.length - 1];
            return extracted || null;
        } catch {
            return null;
        }
    };

    // Connect wallet
    const connectWallet = async (): Promise<string> => {
        try {
            setIsLoading(true);

            // If already connected, return address
            if (isConnectedRef.current && addressRef.current) {
                console.log('✅ Already connected:', addressRef.current);
                setResolvedAddress(addressRef.current);
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
                setResolvedAddress(addressRef.current);
                return addressRef.current;
            }

            const sessionAddress = getAddressFromSession(provider);
            if (sessionAddress) {
                console.log('✅ Resolved address from WalletConnect session:', sessionAddress);
                setResolvedAddress(sessionAddress);
                await AsyncStorage.setItem('wallet_address', sessionAddress);
                setIsLoading(false);
                return sessionAddress;
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
                        setResolvedAddress(addr);
                        resolve(addr);
                        return;
                    }

                    const fallbackAddress = getAddressFromSession(provider);
                    if (fallbackAddress) {
                        clearInterval(checkConnection);
                        setIsLoading(false);
                        console.log('✅ Connection detected from session fallback! Address:', fallbackAddress);
                        setResolvedAddress(fallbackAddress);
                        resolve(fallbackAddress);
                        return;
                    }

                    if (attempts >= maxAttempts) {
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
            setResolvedAddress(null);
        } catch (error) {
            console.error('Disconnect error:', error);
            throw error;
        }
    };

    // Sign message with wallet
    const signMessage = async (message: string): Promise<string> => {
        const signingAddress = address || resolvedAddress;
        if (!provider || !signingAddress) {
            throw new Error('Wallet not connected');
        }

        try {
            // Request signature from wallet
            // This will open the wallet app again
            // User signs the message
            // Signature is returned
            const signature = await provider.request({
                method: 'personal_sign',
                params: [message, signingAddress],
            }) as any;

            return signature;
        } catch (error) {
            console.error('Sign message error:', error);
            throw error;
        }
    };

    // Save address when connected
    useEffect(() => {
        if (address) {
            AsyncStorage.setItem('wallet_address', address);
        }
    }, [address]);

    const value: WalletContextType = {
        address: address ?? resolvedAddress,
        isConnected: isConnected || !!resolvedAddress,
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
                                'personal_sign',
                                'eth_signTypedData',
                            ],
                            chains: SUPPORTED_CHAINS,
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
