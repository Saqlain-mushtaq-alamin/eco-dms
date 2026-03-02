import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { useTheme } from '../theme';

const RNView = View as unknown as React.ComponentType<any>;
const RNText = Text as unknown as React.ComponentType<any>;
const RNImage = Image as unknown as React.ComponentType<any>;
const RNTouchableOpacity = TouchableOpacity as unknown as React.ComponentType<any>;

export interface PostCardProps {
    author: {
        address: string;
        username?: string;
        avatarUri?: string;
    };
    content: string;
    imageUri?: string;
    timestamp: number;
    likes: number;
    comments: number;
    isLiked?: boolean;
    isOptimistic?: boolean;
    onLike?: () => void;
    onComment?: () => void;
    onAuthorPress?: () => void;
    style?: ViewStyle;
    testID?: string;
}

export const PostCard: React.FC<PostCardProps> = ({
    author,
    content,
    imageUri,
    timestamp,
    likes,
    comments,
    isLiked = false,
    isOptimistic = false,
    onLike,
    onComment,
    onAuthorPress,
    style,
    testID,
}) => {
    const theme = useTheme();

    const formatTimestamp = (ts: number) => {
        const now = Date.now();
        const diff = now - ts;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const cardStyle: ViewStyle | ViewStyle[] | undefined = isOptimistic
        ? Array.isArray(style) ? [...style, { opacity: 0.7 }] : [style, { opacity: 0.7 } as ViewStyle]
        : style;

    return (
        <Card style={cardStyle as ViewStyle} padding="md" testID={testID}>
            {/* Author Header */}
            <RNTouchableOpacity
                style={styles.header}
                onPress={onAuthorPress}
                disabled={!onAuthorPress}
            >
                <Avatar
                    uri={author.avatarUri}
                    name={author.username || author.address}
                    size="sm"
                />
                <RNView style={[styles.authorInfo, { marginLeft: theme.spacing.sm }]}>
                    <RNText style={[styles.username, { color: theme.colors.text }]}>
                        {author.username || formatAddress(author.address)}
                    </RNText>
                    <RNText style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
                        {formatTimestamp(timestamp)}
                    </RNText>
                </RNView>
            </RNTouchableOpacity>

            {/* Content */}
            <RNText style={[styles.content, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
                {content}
            </RNText>

            {/* Image */}
            {imageUri && (
                <RNImage
                    source={{ uri: imageUri }}
                    style={[styles.image, { marginTop: theme.spacing.md, borderRadius: theme.borderRadius.md }]}
                    resizeMode="cover"
                />
            )}

            {/* Actions */}
            <RNView style={[styles.actions, { marginTop: theme.spacing.md }]}>
                <RNTouchableOpacity
                    style={styles.action}
                    onPress={onLike}
                    disabled={!onLike}
                    accessibilityRole="button"
                    accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
                >
                    <RNText style={{ fontSize: 18 }}>{isLiked ? '❤️' : '🤍'}</RNText>
                    <RNText style={[styles.actionText, { color: theme.colors.text, marginLeft: theme.spacing.xs }]}>
                        {likes}
                    </RNText>
                </RNTouchableOpacity>

                <RNTouchableOpacity
                    style={[styles.action, { marginLeft: theme.spacing.lg }]}
                    onPress={onComment}
                    disabled={!onComment}
                    accessibilityRole="button"
                    accessibilityLabel="Comment"
                >
                    <RNText style={{ fontSize: 18 }}>💬</RNText>
                    <RNText style={[styles.actionText, { color: theme.colors.text, marginLeft: theme.spacing.xs }]}>
                        {comments}
                    </RNText>
                </RNTouchableOpacity>
            </RNView>
        </Card>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
    },
    timestamp: {
        fontSize: 12,
        marginTop: 2,
    },
    content: {
        fontSize: 16,
        lineHeight: 24,
    },
    image: {
        width: '100%',
        height: 200,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
