import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'VisitProfile'>;

export default function VisitProfileScreen({ route }: Props) {
    const { address } = route.params;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>?</Text>
                </View>
                <Text style={styles.address}>
                    {address.slice(0, 6)}...{address.slice(-4)}
                </Text>
                <Text style={styles.note}>
                    Full profile viewing coming soon
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    profileHeader: {
        backgroundColor: '#fff',
        padding: 24,
        alignItems: 'center',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#6b7280',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    address: {
        fontSize: 16,
        color: '#6b7280',
        fontFamily: 'monospace',
        marginBottom: 12,
    },
    note: {
        fontSize: 14,
        color: '#9ca3af',
        fontStyle: 'italic',
    },
});
