import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../theme';

export interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: 'sm' | 'md' | 'lg';
    variant?: 'light' | 'dark';
    testID?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    style,
    padding = 'md',
    variant = 'light',
    testID,
}) => {
    const theme = useTheme();
    const ViewComponent = View as unknown as React.ComponentType<{
        style?: any;
        testID?: string;
        children?: React.ReactNode;
    }>;

    const cardStyles: ViewStyle = {
        ...styles.glass,
        backgroundColor:
            variant === 'light'
                ? theme.colors.glass.background
                : theme.colors.glass.backgroundDark,
        borderRadius: theme.borderRadius.lg,
        padding:
            padding === 'sm'
                ? theme.spacing.sm
                : padding === 'md'
                    ? theme.spacing.md
                    : theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
    };

    return (
        <ViewComponent style={[cardStyles, style]} testID={testID}>
            {children}
        </ViewComponent>
    );
};

const styles = StyleSheet.create({
    glass: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 5,
        // Note: backdrop-filter is not supported in React Native
        // For web, this would be handled in CSS
    },
});
