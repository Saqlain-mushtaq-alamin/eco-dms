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

    const RNView = View as unknown as React.ComponentType<any>;
    const RNActivityIndicator = ActivityIndicator as unknown as React.ComponentType<any>;

    return (
        <RNView style={[styles.container, style]} testID={testID}>
            <RNActivityIndicator size={size} color={color || theme.colors.primary} />
        </RNView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
