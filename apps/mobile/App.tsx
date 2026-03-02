import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletProvider } from './src/context/WalletContext';
import { SignInScreen } from './src/screens/SignInScreen';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Check auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('wallet_address');
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#abca2f" />
      </View>
    );
  }

  return (
    <WalletProvider>
      {isAuthenticated ? (
        <HomeScreen onSignOut={handleSignOut} />
      ) : (
        <SignInScreen onSignInSuccess={handleSignInSuccess} />
      )}
      <StatusBar style="auto" />
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
