import { useState, useCallback, useEffect } from 'react';

export interface WalletState {
    address: string | null;
    chainId: number | null;
    connected: boolean;
    loading: boolean;
    error: WalletError | null;
}

export interface WalletError {
    code: number;
    message: string;
}

/**
 * Shared wallet hook - platform-specific implementations should be injected
 * via context or props. This provides the common interface.
 */
export const useWallet = (provider?: any) => {
    const [state, setState] = useState<WalletState>({
        address: null,
        chainId: null,
        connected: false,
        loading: false,
        error: null,
    });

    const connect = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            if (!provider) {
                throw new Error('No wallet provider configured');
            }
            // Platform-specific connection logic should be implemented
            // in the consuming app using this hook as a base
            setState((prev) => ({ ...prev, loading: false }));
        } catch (error: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: { code: error.code || -1, message: error.message },
            }));
        }
    }, [provider]);

    const disconnect = useCallback(async () => {
        setState({
            address: null,
            chainId: null,
            connected: false,
            loading: false,
            error: null,
        });
    }, []);

    const switchChain = useCallback(async (chainId: number) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            // Platform-specific chain switching logic
            setState((prev) => ({ ...prev, chainId, loading: false }));
        } catch (error: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: { code: error.code || -1, message: error.message },
            }));
        }
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        switchChain,
    };
};
