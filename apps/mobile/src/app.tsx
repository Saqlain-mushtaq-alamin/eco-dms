// filepath: d:\canvas\eco-dms\eco-dms\apps\mobile\src\App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { graphClient } from './config/apollo';
import { Navigation } from './navigation/Navigation';
import { WalletProvider } from './context/WalletContext';

// Note: Polyfills are loaded in index.js before this file is imported

export default function App() {
    return (
        <SafeAreaProvider>
            <ApolloProvider client={graphClient}>
                <WalletProvider>
                    <Navigation />
                    <StatusBar style="light" />
                </WalletProvider>
            </ApolloProvider>
        </SafeAreaProvider>
    );
}
