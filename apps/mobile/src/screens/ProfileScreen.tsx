import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Post } from '../types';
import { getMe, fetchPosts } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
    const [profile, setProfile] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const profileData = await getMe();
            setProfile(profileData);
            
            if (profileData?.wallet_address) {
                const postsData = await fetchPosts(profileData.wallet_address);
                setPosts(postsData.posts || []);
            }
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
        >
            {loading ? (
                <Text style={styles.loadingText}>Loading...</Text>
            ) : (
                <>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {profile?.username?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        </View>
                        <Text style={styles.username}>{profile?.username || 'Unknown'}</Text>
                        <Text style={styles.address}>
                            {profile?.wallet_address?.slice(0, 6)}...
                            {profile?.wallet_address?.slice(-4)}
                        </Text>
                        {profile?.bio && (
                            <Text style={styles.bio}>{profile.bio}</Text>
                        )}
                        
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => navigation.navigate('CreateProfile')}
                        >
                            <Text style={styles.editButtonText}>Edit Profile</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.postsSection}>
                        <Text style={styles.sectionTitle}>My Posts ({posts.length})</Text>
                        
                        {posts.length === 0 ? (
                            <Text style={styles.emptyText}>No posts yet</Text>
                        ) : (
                            posts.map((post, index) => (
                                <View key={post.cid || index} style={styles.postCard}>
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
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 24,
    },
    profileHeader: {
        backgroundColor: '#fff',
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    address: {
        fontSize: 14,
        color: '#6b7280',
        fontFamily: 'monospace',
        marginBottom: 12,
    },
    bio: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        marginBottom: 16,
    },
    editButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    editButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    postsSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 16,
    },
    emptyText: {
        textAlign: 'center',
        color: '#9ca3af',
        marginTop: 24,
    },
    postCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
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
