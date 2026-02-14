import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface AvatarProps {
    uri?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    style?: ViewStyle;
    testID?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    uri,
    name,
    size = 'md',
    style,
    testID,
}) => {
    const theme = useTheme();

    const sizeMap = {
        sm: 32,
        md: 48,
        lg: 64,
        xl: 96,
    };

    const avatarSize = sizeMap[size];
    const fontSize = avatarSize / 2.5;

    const avatarStyles: ViewStyle = {
        width: avatarSize,
        height: avatarSize,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    };

    const getInitials = (name: string): string => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <View style={[avatarStyles, style]} testID={testID}>
            {uri ? (
                <Image source={{ uri }} style={styles.image} />
            ) : (
                <Text style={[styles.initials, { fontSize, color: '#ffffff' }]}>
                    {name ? getInitials(name) : '?'}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    image: {
        width: '100%',
        height: '100%',
    },
    initials: {
        fontWeight: '600',
    },
});
