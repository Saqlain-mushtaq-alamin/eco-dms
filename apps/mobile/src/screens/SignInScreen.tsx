import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
    Pressable,
} from 'react-native';
import { useWallet } from '../context/WalletContext';
import api, { API_BASE_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NonceResponse, PrepareMessageResponse, AuthResponse } from '../types';

interface SignInScreenProps {
    onSignInSuccess: () => void;
}

export function SignInScreen({ onSignInSuccess }: SignInScreenProps) {
    const { connectWallet, signMessage, address, isConnected } = useWallet();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<string>('');

    const handleSignIn = async () => {
        setLoading(true);
        try {
            // Step 1: Connect wallet if not connected
            let walletAddress = address;

            if (!isConnected || !walletAddress) {
                setStep('Connecting wallet...');
                // connectWallet now returns the address when connection completes
                walletAddress = await connectWallet();
                console.log('Wallet connected:', walletAddress);
            }

            if (!walletAddress) {
                throw new Error('No wallet address found after connection');
            }

            // Step 2: Get nonce from backend
            setStep('Getting nonce...');
            const { data: nonceData } = await api.get<NonceResponse>('/api/siwe/nonce');
            console.log('Nonce received:', nonceData.nonce);

            // Step 3: Prepare SIWE message
            setStep('Preparing message...');
            const { data: prepareData } = await api.post<PrepareMessageResponse>('/api/siwe/prepare', {
                address: walletAddress.toLowerCase(),
                nonce: nonceData.nonce,
            });
            console.log('Message prepared:', prepareData.message);

            // Step 4: Sign message with wallet
            setStep('Waiting for signature...');
            // Wallet app opens again
            // User sees SIWE message
            // User clicks "Sign"
            // Signature returned
            const signature = await signMessage(prepareData.message);
            console.log('Message signed');

            // Step 5: Verify signature with backend
            setStep('Verifying signature...');
            const { data: authData } = await api.post<AuthResponse>('/api/siwe/verify', {
                message: prepareData.message,
                signature: signature,
                address: walletAddress.toLowerCase(),
                nonce: nonceData.nonce,
            });

            // Step 6: Save auth token and address
            await AsyncStorage.setItem('auth_token', authData.token);
            await AsyncStorage.setItem('wallet_address', authData.address);

            console.log('✅ Authentication successful!');
            Alert.alert('Success', 'Signed in successfully!', [
                { text: 'OK', onPress: onSignInSuccess },
            ]);
        } catch (error: any) {
            console.error('Sign in error:', error);
            let errorMessage = 'Failed to sign in';

            if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
            } else if (error.response?.status === 404) {
                errorMessage = `Endpoint not found (404). API base: ${API_BASE_URL}`;
            } else if (error.message) {
                errorMessage = error.message;
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
            setStep('');
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.title}>🌱 Eco-DMS</Text>
                <Text style={styles.subtitle}>Sign In with Ethereum</Text>

                <View style={styles.card}>
                    <Text style={styles.infoTitle}>Decentralized Authentication</Text>
                    <Text style={styles.infoText}>
                        • No passwords needed{'\n'}
                        • Sign in with your wallet{'\n'}
                        • Secure & private{'\n'}
                        • Works with MetaMask, Trust Wallet, and more
                    </Text>
                </View>

                {loading && step && (
                    <View style={styles.stepContainer}>
                        <View style={styles.stepRow}>
                            <ActivityIndicator size="small" color="#abca2f" />
                            <Text style={styles.stepText}>{step}</Text>
                        </View>
                        {step === 'Connecting wallet...' && (
                            <View style={[styles.card, styles.instructionsBox]}>
                                <Text style={styles.instructionsTitle}>📱 Next Steps:</Text>
                                <Text style={styles.instructionsText}>
                                    1. Select MetaMask from the wallet list{'\n'}
                                    2. MetaMask app will open automatically{'\n'}
                                    3. Tap "Connect" to approve{'\n'}
                                    4. Return to this app{'\n\n'}
                                    ⏳ Waiting for approval...
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <Pressable
                    onPress={handleSignIn}
                    disabled={loading}
                    style={({ pressed }) => [
                        styles.button,
                        loading && styles.buttonDisabled,
                        pressed && !loading && styles.buttonPressed,
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.buttonText}>{isConnected ? 'Sign In' : 'Connect Wallet'}</Text>
                    )}
                </Pressable>

                {isConnected && address && (
                    <View style={styles.card}>
                        <Text style={styles.addressLabel}>Connected:</Text>
                        <Text style={styles.addressText}>
                            {address.slice(0, 6)}...{address.slice(-4)}
                        </Text>
                    </View>
                )}

                <View style={[styles.card, styles.howItWorks]}>
                    <Text style={styles.howItWorksTitle}>How it works:</Text>
                    <Text style={styles.howItWorksText}>
                        1. Connect your wallet{'\n'}
                        2. Sign a message to prove ownership{'\n'}
                        3. You're in! No passwords needed
                    </Text>
                </View>

                <Text style={styles.platformText}>
                    Platform: {Platform.OS}
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 20,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#abca2f',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 20,
        color: '#1d1e1f',
        marginBottom: 10,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#010203',
    },
    card: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ececec',
    },
    infoText: {
        fontSize: 16,
        color: '#1d1e1f',
        lineHeight: 24,
    },
    stepContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(171, 202, 47, 0.1)',
        padding: 12,
        borderRadius: 12,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(171, 202, 47, 0.2)',
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    stepText: {
        marginLeft: 12,
        fontSize: 16,
        color: '#abca2f',
        fontWeight: 'bold',
    },
    instructionsBox: {
        marginTop: 12,
        width: '100%',
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#010203',
        marginBottom: 8,
    },
    instructionsText: {
        fontSize: 14,
        color: '#1d1e1f',
        lineHeight: 20,
    },
    button: {
        width: '100%',
        backgroundColor: '#abca2f',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    addressLabel: {
        fontSize: 14,
        color: '#1d1e1f',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#abca2f',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    howItWorks: {
        marginTop: 10,
        width: '100%',
    },
    howItWorksTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#010203',
    },
    howItWorksText: {
        fontSize: 14,
        color: '#1d1e1f',
        lineHeight: 20,
    },
    platformText: {
        fontSize: 12,
        color: '#1d1e1f',
    },
});
