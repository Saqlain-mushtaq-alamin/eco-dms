import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getMe, createOrUpdateProfile } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateProfile'>;

export default function CreateProfileScreen({ navigation }: Props) {
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);
    const [address, setAddress] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const profile = await getMe();
            if (profile) {
                setAddress(profile.wallet_address || '');
                setUsername(profile.username || '');
                setBio(profile.bio || '');
            }
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
    };

    const handleSave = async () => {
        if (!username.trim()) {
            Alert.alert('Error', 'Username is required');
            return;
        }

        setLoading(true);
        try {
            await createOrUpdateProfile({
                username: username.trim(),
                bio: bio.trim(),
            });
            Alert.alert('Success', 'Profile saved!');
            navigation.replace('Feed');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Create Your Profile</Text>
                
                {address && (
                    <View style={styles.addressContainer}>
                        <Text style={styles.addressLabel}>Wallet Address:</Text>
                        <Text style={styles.address}>{address}</Text>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Username *</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter username"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about yourself..."
                        multiline
                        numberOfLines={4}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Saving...' : 'Save Profile'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    content: {
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#111',
    },
    addressContainer: {
        backgroundColor: '#f3f4f6',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
    },
    addressLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 4,
    },
    address: {
        fontSize: 14,
        color: '#111',
        fontFamily: 'monospace',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#374151',
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    button: {
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
