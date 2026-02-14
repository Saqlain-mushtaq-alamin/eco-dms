import React from 'react';
import { ActivityIndicator, View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface LoadingSpinnerProps {
    size?: 'small' | 'large';
    color?: string;
    style?: ViewStyle;
    testID?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'large',
    color,
    style,
    testID,
}) => {
    const theme = useTheme();

    return (
        <View style={[styles.container, style]} testID={testID}>
            <ActivityIndicator size={size} color={color || theme.colors.primary} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
