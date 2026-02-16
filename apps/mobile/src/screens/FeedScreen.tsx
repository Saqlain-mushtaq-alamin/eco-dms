import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Post } from '../types';
import { getMe, fetchPosts, logout } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

export default function FeedScreen({ navigation }: Props) {
    const [address, setAddress] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
        
        // Auth check - redirect if not authenticated
        const unsubscribe = navigation.addListener('focus', () => {
            checkAuth();
        });

        return unsubscribe;
    }, [navigation]);

    const checkAuth = async () => {
        try {
            const profile = await getMe();
            if (!profile) {
                navigation.replace('SignIn');
            } else if (!profile.username) {
                navigation.replace('CreateProfile');
            } else {
                setAddress(profile.wallet_address);
            }
        } catch (err) {
            navigation.replace('SignIn');
        }
    };

    const loadData = async () => {
        try {
            const profile = await getMe();
            if (profile?.wallet_address) {
                setAddress(profile.wallet_address);
                const data = await fetchPosts(profile.wallet_address);
                setPosts(data.posts || []);
            }
        } catch (err) {
            console.error('Failed to load feed:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
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
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                <Text style={styles.title}>Feed</Text>
                
                {loading ? (
                    <Text style={styles.loadingText}>Loading...</Text>
                ) : posts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No posts yet</Text>
                        <Text style={styles.emptySubtext}>
                            Create your first eco-friendly post!
                        </Text>
                    </View>
                ) : (
                    posts.map((post, index) => (
                        <View key={post.cid || index} style={styles.postCard}>
                            <Text style={styles.postAuthor}>
                                {post.author_wallet.slice(0, 6)}...{post.author_wallet.slice(-4)}
                            </Text>
                            <Text style={styles.postContent}>{post.content}</Text>
                            {post.verified && (
                                <View style={styles.verifiedBadge}>
                                    <Text style={styles.verifiedText}>
                                        ✅ Eco-Verified ({post.eco_score}%)
                                    </Text>
                                </View>
                            )}
                            <View style={styles.postStats}>
                                <Text style={styles.statText}>
                                    ❤️ {post.likes_count || 0}
                                </Text>
                                <Text style={styles.statText}>
                                    💬 {post.comments_count || 0}
                                </Text>
                            </View>
                        </View>
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
    content: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#111',
    },
    loadingText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 24,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 48,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
    },
    postCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    postAuthor: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10b981',
        marginBottom: 8,
    },
    postContent: {
        fontSize: 16,
        color: '#111',
        marginBottom: 12,
    },
    verifiedBadge: {
        backgroundColor: '#d1fae5',
        padding: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    verifiedText: {
        fontSize: 12,
        color: '#065f46',
        fontWeight: '600',
    },
    postStats: {
        flexDirection: 'row',
        gap: 16,
    },
    statText: {
        fontSize: 14,
        color: '#6b7280',
    },
});
