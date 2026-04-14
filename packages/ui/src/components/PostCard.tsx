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
    imageUris?: string[];
    timestamp: number;
    likes: number;
    comments: number;
    isLiked?: boolean;
    isOptimistic?: boolean;
    onLike?: () => void;
    onComment?: () => void;
    onImagePress?: (index: number) => void;
    onAuthorPress?: () => void;
    headerRight?: React.ReactNode;
    style?: ViewStyle;
    testID?: string;
    /** ML confidence score 0-1 (used to show eco badge) */
    ecoScore?: number;
    /** Whether ML + community have verified this post as eco-friendly */
    verified?: boolean;
    /** Slot for the VotePanel component — rendered after actions */
    votePanel?: React.ReactNode;
}

export const PostCard: React.FC<PostCardProps> = ({
    author,
    content,
    imageUri,
    imageUris,
    timestamp,
    likes,
    comments,
    isLiked = false,
    isOptimistic = false,
    onLike,
    onComment,
    onImagePress,
    onAuthorPress,
    headerRight,
    style,
    testID,
    ecoScore,
    verified,
    votePanel,
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

    const normalizedImages = React.useMemo(() => {
        if (imageUris && imageUris.length > 0) return imageUris;
        return imageUri ? [imageUri] : [];
    }, [imageUri, imageUris]);

    const visibleImages = normalizedImages.slice(0, 4);
    const overflowCount = Math.max(0, normalizedImages.length - 4);

    const getImageTileStyle = (index: number, total: number): ViewStyle => {
        if (total === 1) {
            return styles.singleImageTile;
        }

        if (total === 3 && index === 0) {
            return styles.threeUpHeroTile;
        }

        return styles.gridImageTile;
    };

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
                {/* Eco badge — shown when verified */}
                {verified && (
                    <RNView style={styles.ecoBadge}>
                        <RNText style={styles.ecoBadgeText}>🌿 Eco</RNText>
                        {ecoScore !== undefined && (
                            <RNText style={styles.ecoScore}>{Math.round(ecoScore * 100)}%</RNText>
                        )}
                    </RNView>
                )}
                {/* ML analysed but community pending */}
                {!verified && ecoScore !== undefined && ecoScore > 0 && (
                    <RNView style={styles.mlBadge}>
                        <RNText style={styles.mlBadgeText}>🔍 {Math.round(ecoScore * 100)}%</RNText>
                    </RNView>
                )}
            </RNView>

            {/* Content */}
            <RNText style={[styles.content, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
                {content}
            </RNText>

            {/* Images */}
            {visibleImages.length > 0 && (
                <RNView
                    style={[
                        styles.imageGrid,
                        { marginTop: theme.spacing.md, borderRadius: theme.borderRadius.md },
                    ]}
                >
                    {visibleImages.map((uri, index) => {
                        const isOverflowTile = overflowCount > 0 && index === visibleImages.length - 1;
                        return (
                            <RNTouchableOpacity
                                key={`${uri}-${index}`}
                                style={[
                                    styles.imageTile,
                                    getImageTileStyle(index, visibleImages.length),
                                    onImagePress ? styles.imageTileClickable : undefined,
                                ]}
                                onPress={onImagePress ? () => onImagePress(index) : undefined}
                                disabled={!onImagePress}
                                activeOpacity={0.92}
                            >
                                <RNImage
                                    source={{ uri }}
                                    style={styles.image}
                                    resizeMode="cover"
                                />
                                {isOverflowTile ? (
                                    <RNView style={styles.overflowOverlay}>
                                        <RNText style={styles.overflowText}>+{overflowCount}</RNText>
                                    </RNView>
                                ) : null}
                            </RNTouchableOpacity>
                        );
                    })}
                </RNView>
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

            {/* Community vote panel — injected from parent, hidden by default */}
            {votePanel ? votePanel : null}
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
        height: '100%',
    },
    imageGrid: {
        width: '100%',
        minHeight: 200,
        maxHeight: 420,
        flexDirection: 'row',
        flexWrap: 'wrap',
        overflow: 'hidden',
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
    },
    imageTile: {
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    imageTileClickable: {
        cursor: 'pointer',
    },
    singleImageTile: {
        width: '100%',
        height: 300,
    },
    threeUpHeroTile: {
        width: '100%',
        height: 220,
    },
    gridImageTile: {
        width: '50%',
        height: 180,
    },
    overflowOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.56)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overflowText: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: '800',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ecoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d1fae5',
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 3,
        marginLeft: 6,
        gap: 4,
    },
    ecoBadgeText: {
        color: '#065f46',
        fontSize: 11,
        fontWeight: '700',
    },
    ecoScore: {
        color: '#065f46',
        fontSize: 10,
        fontWeight: '600',
    },
    mlBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(254,243,199,0.85)',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginLeft: 6,
    },
    mlBadgeText: {
        color: '#92400e',
        fontSize: 11,
        fontWeight: '600',
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
