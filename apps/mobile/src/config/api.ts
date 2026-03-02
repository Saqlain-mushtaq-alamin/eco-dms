import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * API Configuration for Mobile App
 * 
 * Android Emulator: Use 10.0.2.2 to access host machine
 * iOS Simulator: Use 127.0.0.1
 * Real Device: Use your computer's local IP (e.g., 192.168.0.102)
 */

// For testing, update this to your computer's local IP if using real device
const API_BASE_URL = Platform.select({
    android: 'http://10.0.2.2:8000', // Android Emulator
    ios: 'http://127.0.0.1:8000',     // iOS Simulator
    default: 'http://localhost:8000',
});

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle response errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('wallet_address');
        }
        return Promise.reject(error);
    }
);

export default api;
export { API_BASE_URL };
