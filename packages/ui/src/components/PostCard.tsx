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
    headerRight?: React.ReactNode;
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
    headerRight,
    style,
    testID,
}) => {
    const theme = useTheme();
    const [likeHovered, setLikeHovered] = React.useState(false);
    const [commentHovered, setCommentHovered] = React.useState(false);

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
            <RNView style={styles.headerRow}>
                <RNTouchableOpacity
                    style={[styles.header, { flex: 1 }]}
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
                {headerRight ? (
                    <RNView style={[styles.headerRight, { marginLeft: theme.spacing.sm }]}>{headerRight}</RNView>
                ) : null}
            </RNView>

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
                    style={[
                        styles.action,
                        styles.actionPill,
                        {
                            backgroundColor: isLiked
                                ? (likeHovered ? 'rgba(254, 226, 226, 1)' : 'rgba(254, 226, 226, 0.82)')
                                : (likeHovered ? 'rgba(243, 244, 246, 1)' : 'rgba(255,255,255,0.84)'),
                            borderColor: isLiked ? 'rgba(252,165,165,0.9)' : 'rgba(226,232,240,0.8)',
                            transform: [{ scale: likeHovered ? 1.03 : 1 }],
                        },
                    ]}
                    onPress={onLike}
                    disabled={!onLike}
                    onMouseEnter={() => setLikeHovered(true)}
                    onMouseLeave={() => setLikeHovered(false)}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
                >
                    <RNText style={{ fontSize: 18 }}>{isLiked ? '❤️' : '🤍'}</RNText>
                    <RNText style={[styles.actionText, { color: theme.colors.text, marginLeft: theme.spacing.xs }]}>
                        {likes}
                    </RNText>
                </RNTouchableOpacity>

                <RNTouchableOpacity
                    style={[
                        styles.action,
                        styles.actionPill,
                        {
                            marginLeft: theme.spacing.lg,
                            backgroundColor: commentHovered ? 'rgba(243,244,246,1)' : 'rgba(255,255,255,0.84)',
                            borderColor: 'rgba(226,232,240,0.8)',
                            transform: [{ scale: commentHovered ? 1.03 : 1 }],
                        },
                    ]}
                    onPress={onComment}
                    disabled={!onComment}
                    onMouseEnter={() => setCommentHovered(true)}
                    onMouseLeave={() => setCommentHovered(false)}
                    activeOpacity={0.9}
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
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
    actionPill: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
