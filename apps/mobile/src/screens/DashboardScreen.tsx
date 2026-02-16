import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getMe } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const profileData = await getMe();
            setProfile(profileData);
        } catch (err) {
            console.error('Failed to load dashboard:', err);
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
            <Text style={styles.title}>🌱 Eco Dashboard</Text>
            
            {loading ? (
                <Text style={styles.loadingText}>Loading...</Text>
            ) : (
                <>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Your Stats</Text>
                        <View style={styles.stat}>
                            <Text style={styles.statLabel}>Total Posts:</Text>
                            <Text style={styles.statValue}>0</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statLabel}>Verified Posts:</Text>
                            <Text style={styles.statValue}>0</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statLabel}>Total Rewards:</Text>
                            <Text style={styles.statValue}>0 ECO</Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Recent Activity</Text>
                        <Text style={styles.emptyText}>No recent activity</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Leaderboard</Text>
                        <Text style={styles.emptyText}>Coming soon</Text>
                    </View>

                    <Text style={styles.note}>
                        Full dashboard features are available on the web version at localhost:5173
                    </Text>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
        padding: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 24,
    },
    loadingText: {
        textAlign: 'center',
        color: '#6b7280',
        marginTop: 24,
    },
    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 16,
    },
    stat: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    statLabel: {
        fontSize: 16,
        color: '#6b7280',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#10b981',
    },
    emptyText: {
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 14,
        paddingVertical: 16,
    },
    note: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 24,
        fontStyle: 'italic',
    },
});
