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
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#2e7d32',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 24,
        color: '#666',
        marginBottom: 30,
    },
    card: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        width: '100%',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    cardText: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
    },
    addressText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2e7d32',
        marginBottom: 8,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fullAddressText: {
        fontSize: 12,
        color: '#999',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    button: {
        backgroundColor: '#d32f2f',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
    },
    buttonPressed: {
        backgroundColor: '#b71c1c',
        opacity: 0.8,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 30,
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 8,
        width: '100%',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
});
