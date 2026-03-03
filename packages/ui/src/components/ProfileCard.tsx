import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { useTheme } from '../theme';

export interface ProfileCardProps {
    address: string;
    username?: string;
    bio?: string;
    avatarUri?: string;
    ecoScore?: number;
    verifiedActions?: number;
    style?: ViewStyle;
    testID?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
    address,
    username,
    bio,
    avatarUri,
    ecoScore = 0,
    verifiedActions = 0,
    style,
    testID,
}) => {
    const theme = useTheme();
    const ViewComponent = View as unknown as React.ComponentType<any>;
    const TextComponent = Text as unknown as React.ComponentType<any>;

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <Card style={style} padding="lg" testID={testID}>
            <ViewComponent style={styles.container}>
                <Avatar uri={avatarUri} name={username || address} size="lg" />
                <ViewComponent style={[styles.info, { marginLeft: theme.spacing.md }]}>
                    <TextComponent style={[
                        styles.username,
                        {
                            color: theme.colors.text,
                            fontSize: theme.typography.h3.fontSize,
                            fontWeight: theme.typography.h3.fontWeight as any,
                        },
                    ]}>
                        {username || formatAddress(address)}
                    </TextComponent>
                    {bio && (
                        <TextComponent style={[styles.bio, { color: theme.colors.textSecondary, marginTop: theme.spacing.xs }]}>
                            {bio}
                        </TextComponent>
                    )}
                    <ViewComponent style={[styles.stats, { marginTop: theme.spacing.sm }]}>
                        <ViewComponent style={styles.stat}>
                            <TextComponent style={[styles.statValue, { color: theme.colors.primary }]}>{ecoScore}</TextComponent>
                            <TextComponent style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Eco Score</TextComponent>
                        </ViewComponent>
                        <ViewComponent style={[styles.stat, { marginLeft: theme.spacing.lg }]}>
                            <TextComponent style={[styles.statValue, { color: theme.colors.primary }]}>{verifiedActions}</TextComponent>
                            <TextComponent style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Verified</TextComponent>
                        </ViewComponent>
                    </ViewComponent>
                </ViewComponent>
            </ViewComponent>
        </Card>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    info: {
        flex: 1,
    },
    username: {
        fontWeight: '600',
    },
    bio: {
        fontSize: 14,
    },
    stats: {
        flexDirection: 'row',
    },
    stat: {
        alignItems: 'flex-start',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 2,
    },
});
