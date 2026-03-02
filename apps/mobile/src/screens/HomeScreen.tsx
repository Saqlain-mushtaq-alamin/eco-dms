import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    Platform,
} from 'react-native';
import { GlassCard, GlassButton } from '@eco-dms/ui';
import { useWallet } from '../context/WalletContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface HomeScreenProps {
    onSignOut: () => void;
}

export function HomeScreen({ onSignOut }: HomeScreenProps) {
    const { address, disconnectWallet } = useWallet();
    const [userAddress, setUserAddress] = useState<string>('');

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        const savedAddress = await AsyncStorage.getItem('wallet_address');
        if (savedAddress) {
            setUserAddress(savedAddress);
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await disconnectWallet();
                        onSignOut();
                    },
                },
            ]
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.title}>🌱 Eco-DMS</Text>
                <Text style={styles.subtitle}>Welcome!</Text>

                <GlassCard variant="light" padding="lg">
                    <Text style={styles.cardTitle}>✅ You're Signed In</Text>
                    <Text style={styles.cardText}>
                        Connected with Sign-In with Ethereum (SIWE)
                    </Text>
                </GlassCard>

                <GlassCard variant="light" padding="lg">
                    <Text style={styles.cardTitle}>Wallet Address</Text>
                    <Text style={styles.addressText}>
                        {(address || userAddress).slice(0, 10)}...
                        {(address || userAddress).slice(-8)}
                    </Text>
                    <Text style={styles.fullAddressText}>
                        {address || userAddress}
                    </Text>
                </GlassCard>

                <GlassCard variant="light" padding="lg">
                    <Text style={styles.cardTitle}>Authentication Method</Text>
                    <Text style={styles.cardText}>
                        • Decentralized (SIWE){'\n'}
                        • No passwords{'\n'}
                        • Self-custodial{'\n'}
                        • Backend: FastAPI + Redis
                    </Text>
                </GlassCard>

                <GlassCard variant="light" padding="lg">
                    <Text style={styles.cardTitle}>Features Available</Text>
                    <Text style={styles.cardText}>
                        ✅ WalletConnect Integration{'\n'}
                        ✅ SIWE Authentication{'\n'}
                        ✅ JWT Token Storage{'\n'}
                        ✅ Backend API Connection{'\n'}
                        ✅ Graph Protocol Ready
                    </Text>
                </GlassCard>

                <GlassButton
                    title="Sign Out"
                    variant="primary"
                    onPress={handleSignOut}
                    style={styles.signOutButton}
                />

                <GlassCard variant="light" padding="md">
                    <Text style={styles.footerText}>
                        Platform: {Platform.OS}{'\n'}
                        SDK: 54.0.0{'\n'}
                        WalletConnect: ✅{'\n'}
                        SIWE: ✅
                    </Text>
                </GlassCard>
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
        gap: 16,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#abca2f',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 24,
        color: '#1d1e1f',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#010203',
    },
    cardText: {
        fontSize: 16,
        color: '#1d1e1f',
        lineHeight: 24,
    },
    addressText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#abca2f',
        marginBottom: 8,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fullAddressText: {
        fontSize: 12,
        color: '#1d1e1f',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    signOutButton: {
        width: '100%',
        marginTop: 20,
    },
    footerText: {
        fontSize: 14,
        color: '#1d1e1f',
        textAlign: 'center',
        lineHeight: 20,
    },
});
