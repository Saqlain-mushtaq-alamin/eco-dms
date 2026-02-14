import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export interface WalletConnectButtonProps {
    onPress: () => void;
    connected?: boolean;
    address?: string;
    loading?: boolean;
    testID?: string;
}

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
    onPress,
    connected = false,
    address,
    loading = false,
    testID,
}) => {
    const theme = useTheme();

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                {
                    backgroundColor: connected ? theme.colors.success : theme.colors.primary,
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                },
            ]}
            onPress={onPress}
            disabled={loading}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={connected ? 'Disconnect wallet' : 'Connect wallet'}
        >
            <Text style={[styles.text, { color: '#ffffff' }]}>
                {loading ? 'Connecting...' : connected && address ? formatAddress(address) : 'Connect Wallet'}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
});
