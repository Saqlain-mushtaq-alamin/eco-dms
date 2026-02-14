import { useState, useCallback, useEffect } from 'react';

export interface User {
    address: string;
    username?: string;
    bio?: string;
    avatarUri?: string;
    ecoScore?: number;
    verifiedActions?: number;
}

export interface AuthState {
    user: User | null;
    authenticated: boolean;
    loading: boolean;
    error: string | null;
}

/**
 * Shared authentication hook for SIWE (Sign-In with Ethereum)
 * Platform-specific implementations should extend this base
 */
export const useAuth = () => {
    const [state, setState] = useState<AuthState>({
        user: null,
        authenticated: false,
        loading: false,
        error: null,
    });

    const signIn = useCallback(async (address: string, signature: string, message: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            // Platform-specific SIWE verification logic
            // This should call your backend to verify the signature

            // Mock user data - replace with actual API call
            const user: User = {
                address,
                username: undefined,
                bio: undefined,
                avatarUri: undefined,
                ecoScore: 0,
                verifiedActions: 0,
            };

            setState({
                user,
                authenticated: true,
                loading: false,
                error: null,
            });
        } catch (error: any) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error.message || 'Authentication failed',
            }));
        }
    }, []);

    const signOut = useCallback(async () => {
        setState({
            user: null,
            authenticated: false,
            loading: false,
            error: null,
        });
    }, []);

    const updateProfile = useCallback(async (updates: Partial<User>) => {
        setState((prev) => {
            if (!prev.user) return prev;
            return {
                ...prev,
                user: { ...prev.user, ...updates },
            };
        });
    }, []);

    return {
        ...state,
        signIn,
        signOut,
        updateProfile,
    };
};
