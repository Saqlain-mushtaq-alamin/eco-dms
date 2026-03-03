import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../theme';

export interface WalletConnectHeroProps {
    title: string;
    subtitle: string;
    style?: ViewStyle;
}

export const WalletConnectHero: React.FC<WalletConnectHeroProps> = ({
    title,
    subtitle,
    style,
}) => {
    const theme = useTheme();
    const ViewComponent = View as unknown as React.ComponentType<any>;
    const TextComponent = Text as unknown as React.ComponentType<any>;

    const titleStyle: TextStyle = {
        ...styles.heroTitle,
        color: theme.colors.text,
    };

    const subtitleStyle: TextStyle = {
        ...styles.heroSubtitle,
        color: theme.colors.textSecondary,
    };

    return (
        <ViewComponent style={[styles.heroContainer, style]}>
            <TextComponent style={titleStyle}>{title}</TextComponent>
            <TextComponent style={subtitleStyle}>{subtitle}</TextComponent>
        </ViewComponent>
    );
};

export interface WalletConnectActionsPanelProps {
    title: string;
    subtitle: string;
    error?: string;
    loading?: boolean;
    onMetaMask: () => void;
    onWalletConnect: () => void;
    style?: ViewStyle;
}

export const WalletConnectActionsPanel: React.FC<WalletConnectActionsPanelProps> = ({
    title,
    subtitle,
    error,
    loading = false,
    onMetaMask,
    onWalletConnect,
    style,
}) => {
    const theme = useTheme();
    const ViewComponent = View as unknown as React.ComponentType<any>;
    const TextComponent = Text as unknown as React.ComponentType<any>;

    const cardTitleStyle: TextStyle = {
        ...styles.panelTitle,
        color: theme.colors.text,
    };

    const cardSubtitleStyle: TextStyle = {
        ...styles.panelSubtitle,
        color: theme.colors.textSecondary,
    };

    return (
        <ViewComponent style={[styles.panelContainer, style]}>
            <ViewComponent style={styles.panelHeader}>
                <TextComponent style={cardTitleStyle}>{title}</TextComponent>
                <TextComponent style={cardSubtitleStyle}>{subtitle}</TextComponent>
            </ViewComponent>

            {!!error && (
                <ViewComponent style={[styles.errorBox, { borderColor: theme.colors.error }]}>
                    <TextComponent style={[styles.errorText, { color: theme.colors.error }]}>{error}</TextComponent>
                </ViewComponent>
            )}

            <ViewComponent style={styles.buttonsStack}>
                <ViewComponent style={styles.buttonWrap}>
                    <Button
                        title={loading ? 'Connecting...' : 'Connect with MetaMask'}
                        onPress={onMetaMask}
                        variant="primary"
                        disabled={loading}
                        style={styles.button}
                    />
                </ViewComponent>

                <ViewComponent style={styles.buttonWrap}>
                    <Button
                        title={loading ? 'Connecting...' : 'Connect with WalletConnect'}
                        onPress={onWalletConnect}
                        variant="secondary"
                        disabled={loading}
                        style={styles.button}
                    />
                </ViewComponent>
            </ViewComponent>
        </ViewComponent>
    );
};

const styles = StyleSheet.create({
    heroContainer: {
        justifyContent: 'center',
        gap: 14,
    },
    heroTitle: {
        fontSize: 56,
        lineHeight: 62,
        fontWeight: '700',
        letterSpacing: -0.8,
    },
    heroSubtitle: {
        fontSize: 22,
        lineHeight: 30,
        fontWeight: '500',
    },
    panelContainer: {
        width: '100%',
        gap: 20,
    },
    panelHeader: {
        gap: 8,
        alignItems: 'flex-start',
    },
    panelTitle: {
        fontSize: 42,
        lineHeight: 48,
        fontWeight: '700',
        letterSpacing: -0.6,
    },
    panelSubtitle: {
        fontSize: 18,
        lineHeight: 26,
        fontWeight: '500',
    },
    errorBox: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    errorText: {
        fontSize: 14,
        fontWeight: '500',
    },
    buttonsStack: {
        gap: 14,
        width: '100%',
    },
    buttonWrap: {
        width: '100%',
        padding: 2,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.62)',
    },
    button: {
        width: '100%',
        height: 56,
        borderRadius: 14,
        borderWidth: 0,
        borderColor: 'transparent',
        shadowColor: '#010203',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 2,
    },
});
