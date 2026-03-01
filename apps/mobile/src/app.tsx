import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './navigation/Navigation';
import { WalletProvider } from './context/WalletContext';

// Note: Apollo Client removed - caused crypto errors in React Native
// Using REST API instead

export default function App() {
    return (
        <SafeAreaProvider>
            <WalletProvider>
                <Navigation />
                <StatusBar style="light" />
            </WalletProvider>
        </SafeAreaProvider>
    );
}
