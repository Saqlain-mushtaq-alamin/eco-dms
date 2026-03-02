import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
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

    const Touchable = TouchableOpacity as unknown as React.ComponentType<any>;
    const RNText = Text as unknown as React.ComponentType<any>;

    return (
        <Touchable
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
            <RNText style={[styles.text, { color: '#ffffff' }]}>
                {loading ? 'Connecting...' : connected && address ? formatAddress(address) : 'Connect Wallet'}
            </RNText>
        </Touchable>
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
