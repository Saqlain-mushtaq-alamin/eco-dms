import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'glass' | 'glassDark';
    testID?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    padding = 'md',
    variant = 'default',
    testID,
}) => {
    const theme = useTheme();

    const getBackgroundColor = () => {
        switch (variant) {
            case 'glass':
                return 'rgba(241, 241, 241, 0.7)';
            case 'glassDark':
                return 'rgba(29, 30, 31, 0.7)';
            default:
                return theme.colors.surface;
        }
    };

    const cardStyles: ViewStyle = {
        ...styles.card,
        backgroundColor: getBackgroundColor(),
        borderRadius: theme.borderRadius.lg,
        padding:
            padding === 'sm'
                ? theme.spacing.sm
                : padding === 'md'
                    ? theme.spacing.md
                    : theme.spacing.lg,
        borderWidth: 1,
        borderColor: variant.includes('glass')
            ? theme.colors.glass.border
            : theme.colors.border,
    };

    return (
        <View style={[cardStyles, style]} testID={testID}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
});
