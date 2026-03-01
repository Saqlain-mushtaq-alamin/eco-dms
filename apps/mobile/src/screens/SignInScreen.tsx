import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getMe } from '../config/api';

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

    const handleSkipAuth = () => {
        Alert.alert(
            'Demo Mode',
            'Skip authentication and browse the eco feed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Browse Feed',
                    onPress: () => navigation.replace('Feed')
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🌱 Welcome to Eco DMS</Text>
            <Text style={styles.subtitle}>
                Decentralized eco-friendly content verification platform
            </Text>

            <TouchableOpacity
                style={styles.button}
                onPress={handleSkipAuth}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    📱 Browse Eco Feed (Demo)
                </Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>🔧 Authentication Temporarily Disabled</Text>
                <Text style={styles.infoText}>
                    WalletConnect has been removed to fix polyfill issues.
                </Text>
                <Text style={styles.infoText}>
                    • You can browse the eco-verified feed
                </Text>
                <Text style={styles.infoText}>
                    • Graph Node integration working
                </Text>
                <Text style={styles.infoText}>
                    • Authentication will be re-enabled soon
                </Text>
            </View>

            <Text style={styles.note}>
                Backend running at: 192.168.0.102:8000
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
        marginBottom: 24,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    infoBox: {
        backgroundColor: '#f0fdf4',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d1fae5',
        marginBottom: 24,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065f46',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 12,
        color: '#166534',
        marginBottom: 4,
    },
    note: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 16,
        fontFamily: 'monospace',
    },
});
