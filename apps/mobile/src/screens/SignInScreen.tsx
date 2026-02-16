import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getNonce, prepareMessage, verifySignature, getMe } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if already authenticated
        checkAuth();
    }, []);

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

    const handleMetaMaskConnect = async () => {
        setLoading(true);
        try {
            // For mobile, you'd use WalletConnect or similar
            // This is a placeholder - implement actual wallet connection
            Alert.alert(
                'Coming Soon',
                'Mobile wallet connection will require WalletConnect integration. For now, use the web version.'
            );
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Connection failed');
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
                onPress={handleMetaMaskConnect}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Connecting...' : 'Connect Wallet'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.note}>
                Note: For full wallet functionality, please use the web version at localhost:5173
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
    note: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 24,
    },
});
