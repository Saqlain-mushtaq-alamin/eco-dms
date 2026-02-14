import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: 'sm' | 'md' | 'lg';
    testID?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    padding = 'md',
    testID,
}) => {
    const theme = useTheme();

    const cardStyles: ViewStyle = {
        ...styles.card,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        padding:
            padding === 'sm'
                ? theme.spacing.sm
                : padding === 'md'
                    ? theme.spacing.md
                    : theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
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
