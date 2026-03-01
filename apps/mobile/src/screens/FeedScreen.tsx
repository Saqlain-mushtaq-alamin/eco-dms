import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
} from 'react-native';
// React Navigation removed
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { RootStackParamList } from '../types';
type Props = any;
import { getMe, logout } from '../config/api';

export default function FeedScreen({ navigation }: Props) {
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);

    useEffect(() => {
        checkAuth();
        loadDemoFeed();

        const unsubscribe = navigation.addListener('focus', () => {
            checkAuth();
        });

        return unsubscribe;
    }, [navigation]);

    const checkAuth = async () => {
        try {
            const profile = await getMe();
            if (!profile) {
                // Demo mode - skip auth
                setAddress('Demo User');
            } else if (!profile.username) {
                navigation.replace('CreateProfile');
            } else {
                setAddress(profile.wallet_address);
            }
        } catch (err) {
            console.log('Auth check skipped (demo mode)');
            setAddress('Demo User');
        }
    };

    const loadDemoFeed = () => {
        setLoading(true);
        // Demo data for testing
        setPosts([
            {
                id: '1',
                content: 'Welcome to Eco DMS! This is a demo post. GraphQL/Apollo has been removed due to React Native compatibility issues.',
                author: { username: 'Demo User' },
                createdAt: new Date().toISOString(),
                ecoScore: 95,
            },
            {
                id: '2',
                content: 'The mobile app now works without crypto errors! You can enable backend REST API integration for real data.',
                author: { username: 'System' },
                createdAt: new Date().toISOString(),
                ecoScore: 88,
            },
        ]);
        setLoading(false);
    };

    const handleRefresh = () => {
        loadDemoFeed();
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        navigation.replace('SignIn');
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigation.navigate('Dashboard')}
                >
                    <Text style={styles.navButtonText}>🌱 Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.navButton}
                    onPress={() => navigation.navigate('Profile')}
                >
                    <Text style={styles.navButtonText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.navButton, styles.logoutButton]}
                    onPress={handleLogout}
                >
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
                }
            >
                <Text style={styles.title}>🌱 Eco-Verified Feed (Demo)</Text>
                <Text style={styles.subtitle}>
                    Apollo/GraphQL removed - Using demo data
                </Text>

                {loading && posts.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#10b981" />
                        <Text style={styles.loadingText}>Loading eco posts...</Text>
                    </View>
                ) : posts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🌍</Text>
                        <Text style={styles.emptyText}>No eco-verified posts yet</Text>
                        <Text style={styles.emptySubtext}>
                            Create the first eco-friendly post and get verified!
                        </Text>
                    </View>
                ) : (
                    posts.map((post: any) => (
                        <TouchableOpacity
                            key={post.id}
                            style={styles.postCard}
                            activeOpacity={0.7}
                        >
                            <View style={styles.postHeader}>
                                <Text style={styles.postAuthor}>
                                    {post.author.username}
                                </Text>
                                <View style={styles.verifiedBadge}>
                                    <Text style={styles.verifiedText}>🌱 {post.ecoScore}</Text>
                                </View>
                            </View>

                            <Text style={styles.postContent}>
                                {post.content}
                            </Text>

                            <View style={styles.postStats}>
                                <Text style={styles.timestamp}>
                                    {new Date(post.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        gap: 8,
    },
    navButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#10b981',
        borderRadius: 6,
    },
    navButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#ef4444',
        marginLeft: 'auto',
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    errorBanner: {
        backgroundColor: '#fef2f2',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#fecaca',
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    errorSubtext: {
        color: '#991b1b',
        fontSize: 12,
        marginBottom: 4,
    },
    errorDetails: {
        color: '#9ca3af',
        fontSize: 11,
        fontStyle: 'italic',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#111',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        marginTop: 48,
    },
    loadingText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 12,
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 48,
        paddingHorizontal: 24,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    },
    postCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    postAuthor: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
    },
    postContent: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        marginBottom: 12,
    },
    verifiedBadge: {
        backgroundColor: '#d1fae5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    verifiedText: {
        fontSize: 11,
        color: '#065f46',
        fontWeight: '600',
    },
    verdictContainer: {
        backgroundColor: '#f0fdf4',
        padding: 8,
        borderRadius: 6,
        marginBottom: 12,
    },
    verdictText: {
        fontSize: 12,
        color: '#166534',
        fontWeight: '500',
    },
    postStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statIcon: {
        fontSize: 14,
    },
    statText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    timestamp: {
        fontSize: 12,
        color: '#9ca3af',
        marginLeft: 'auto',
    },
});
