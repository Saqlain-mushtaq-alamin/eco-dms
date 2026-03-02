import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Alert,
    Platform,
} from 'react-native';
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

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>✅ You're Signed In</Text>
                    <Text style={styles.cardText}>
                        Connected with Sign-In with Ethereum (SIWE)
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Wallet Address</Text>
                    <Text style={styles.addressText}>
                        {(address || userAddress).slice(0, 10)}...
                        {(address || userAddress).slice(-8)}
                    </Text>
                    <Text style={styles.fullAddressText}>
                        {address || userAddress}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Authentication Method</Text>
                    <Text style={styles.cardText}>
                        • Decentralized (SIWE){'\n'}
                        • No passwords{'\n'}
                        • Self-custodial{'\n'}
                        • Backend: FastAPI + Redis
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Features Available</Text>
                    <Text style={styles.cardText}>
                        ✅ WalletConnect Integration{'\n'}
                        ✅ SIWE Authentication{'\n'}
                        ✅ JWT Token Storage{'\n'}
                        ✅ Backend API Connection{'\n'}
                        ✅ Graph Protocol Ready
                    </Text>
                </View>

                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handleSignOut}
                >
                    <Text style={styles.buttonText}>Sign Out</Text>
                </Pressable>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Platform: {Platform.OS}{'\n'}
                        SDK: 54.0.0{'\n'}
                        WalletConnect: ✅{'\n'}
                        SIWE: ✅
                    </Text>
                </View>
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
        marginBottom: 30,
    },
    card: {
        backgroundColor: 'rgba(241, 241, 241, 0.7)',
        padding: 20,
        borderRadius: 16,
        width: '100%',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
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
    button: {
        backgroundColor: '#abca2f',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
    },
    buttonPressed: {
        backgroundColor: '#9bb829',
        opacity: 0.8,
    },
    buttonText: {
        color: '#010203',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 30,
        padding: 16,
        backgroundColor: 'rgba(241, 241, 241, 0.7)',
        borderRadius: 12,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    footerText: {
        fontSize: 14,
        color: '#1d1e1f',
        textAlign: 'center',
        lineHeight: 20,
    },
});
