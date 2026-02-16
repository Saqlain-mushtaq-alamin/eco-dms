import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getNonce, prepareMessage, verifySignature, getMe } from '../config/api';
import { useWallet } from '../context/WalletContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
    const [loading, setLoading] = useState(false);
    const { isConnected, address, provider, open } = useWallet();

    useEffect(() => {
        // Check if already authenticated
        checkAuth();
    }, []);

    useEffect(() => {
        // When wallet connects, perform SIWE authentication
        if (isConnected && address && provider) {
            handleSIWEAuth();
        }
    }, [isConnected, address]);

    const checkAuth = async () => {
        try {
            const profile = await getMe();
            if (profile?.username) {
                navigation.replace('Feed');
            } else {
                navigation.replace('CreateProfile');
            }
        } catch (err) {
            // Not authenticated, stay on sign in
        }
    };

    const handleConnect = async () => {
        setLoading(true);
        try {
            await open();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to open wallet modal');
            setLoading(false);
        }
    };

    const handleSIWEAuth = async () => {
        if (!address || !provider) return;

        try {
            // Get nonce from backend
            const { nonce } = await getNonce();

            // Prepare SIWE message
            const { message } = await prepareMessage(address, 1, nonce);

            // Request signature from wallet
            const signature = await provider.request({
                method: 'personal_sign',
                params: [message, address],
            });

            // Verify signature on backend
            await verifySignature(message, signature);

            // Check if profile exists
            const profile = await getMe();
            if (profile?.username && profile.username.trim()) {
                navigation.replace('Feed');
            } else {
                navigation.replace('CreateProfile');
            }
        } catch (err: any) {
            console.error('SIWE auth error:', err);
            Alert.alert('Authentication Failed', err.message || 'Please try again');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to Eco DMS</Text>
            <Text style={styles.subtitle}>
                Connect your wallet to verify eco-friendly content and earn rewards
            </Text>

            <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleConnect}
                disabled={loading || isConnected}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Connecting...' : isConnected ? 'Connected' : 'Connect Wallet'}
                </Text>
            </TouchableOpacity>

            {isConnected && address && (
                <View style={styles.connectedInfo}>
                    <Text style={styles.connectedLabel}>Connected:</Text>
                    <Text style={styles.connectedAddress}>
                        {address.slice(0, 6)}...{address.slice(-4)}
                    </Text>
                </View>
            )}

            <Text style={styles.note}>
                Supports MetaMask, Trust Wallet, Rainbow, and 300+ wallets via WalletConnect
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        color: '#10b981',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 32,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    connectedInfo: {
        backgroundColor: '#d1fae5',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    connectedLabel: {
        fontSize: 12,
        color: '#065f46',
        marginBottom: 4,
    },
    connectedAddress: {
        fontSize: 16,
        fontWeight: '600',
        color: '#065f46',
        fontFamily: 'monospace',
    },
    note: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 24,
    },
});
