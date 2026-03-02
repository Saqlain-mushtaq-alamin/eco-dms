import React from 'react';
import { useTheme } from '../theme';

export interface AvatarProps {
    uri?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    style?: React.CSSProperties;
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

    const avatarStyles: React.CSSProperties = {
        width: avatarSize,
        height: avatarSize,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.primary,
        display: 'flex',
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
        <div style={{ ...avatarStyles, ...style }} data-testid={testID}>
            {uri ? (
                <img src={uri} style={{ width: '100%', height: '100%' }} alt="avatar" />
            ) : (
                <span style={{ fontSize, color: '#ffffff', fontWeight: '600' }}>
                    {name ? getInitials(name) : '?'}
                </span>
            )}
        </div>
    );
};
