import { useQuery } from '@apollo/client';
import { useMemo, useState, useEffect } from 'react';
import { GET_ECO_FEED, GET_USER_TIMELINE, GET_RECENT_POSTS } from '../graphql/queries';
import { fetchFromIPFS } from '../config/apollo';

/**
 * FEED HOOKS - Replace backend /api/posts/feed/timeline
 * 
 * NEW FLOW:
 * 1. Query The Graph for post metadata (CID, author, stats)
 * 2. Fetch content from IPFS using CID
 * 3. Merge data and display
 */

export interface Post {
    id: string;
    contentCID: string;
    author: {
        id: string;
        handle?: string;
    };
    timestamp: string;
    totalLikes: string;
    totalComments: string;
    totalShares: string;
    isEcoVerified: boolean;
    ecoConfidence?: string;
    // Content from IPFS
    content?: {
        text?: string;
        image?: string;
        type?: string;
    };
}

/**
 * useEcoFeed - Get eco-verified posts feed
 * Replaces: GET /api/posts/feed/timeline?eco=true
 */
export function useEcoFeed(limit = 20) {
    const { data, loading, error, fetchMore, refetch } = useQuery(GET_ECO_FEED, {
        variables: { first: limit, skip: 0 },
    });

    const posts = useMemo(() => {
        return data?.posts || [];
    }, [data]);

    const loadMore = () => {
        fetchMore({
            variables: { skip: posts.length },
        });
    };

    return {
        posts,
        loading,
        error,
        loadMore,
        hasMore: posts.length % limit === 0,
        refetch,
    };
}

/**
 * useUserTimeline - Get user's posts
 * Replaces: GET /api/posts/{wallet_address}
 */
export function useUserTimeline(walletAddress: string | null, limit = 20) {
    const userId = walletAddress?.toLowerCase();

    const { data, loading, error, fetchMore } = useQuery(GET_USER_TIMELINE, {
        variables: { userId, first: limit, skip: 0 },
        skip: !userId,
    });

    const posts = useMemo(() => {
        return data?.user?.posts || [];
    }, [data]);

    const loadMore = () => {
        fetchMore({
            variables: { skip: posts.length },
        });
    };

    return {
        posts,
        user: data?.user,
        loading,
        error,
        loadMore,
        hasMore: posts.length % limit === 0,
    };
}

/**
 * useRecentPosts - Get all recent posts (eco + non-eco)
 * Replaces: GET /api/posts/feed/timeline
 */
export function useRecentPosts(limit = 20) {
    const { data, loading, error, fetchMore } = useQuery(GET_RECENT_POSTS, {
        variables: { first: limit, skip: 0 },
    });

    const posts = useMemo(() => {
        return data?.posts || [];
    }, [data]);

    const loadMore = () => {
        fetchMore({
            variables: { skip: posts.length },
        });
    };

    return {
        posts,
        loading,
        error,
        loadMore,
        hasMore: posts.length % limit === 0,
    };
}

/**
 * usePostContent - Fetch content from IPFS
 * Call this for each post to get the actual content
 */
export function usePostContent(posts: Post[]) {
    const [postsWithContent, setPostsWithContent] = useState<Post[]>([]);
    const [loadingContent, setLoadingContent] = useState(true);

    useEffect(() => {
        if (!posts.length) {
            setPostsWithContent([]);
            setLoadingContent(false);
            return;
        }

        const fetchContent = async () => {
            setLoadingContent(true);

            const withContent = await Promise.all(
                posts.map(async (post) => {
                    try {
                        const content = await fetchFromIPFS(post.contentCID);
                        return { ...post, content };
                    } catch (error) {
                        console.error(`Failed to fetch IPFS content for ${post.contentCID}:`, error);
                        return { ...post, content: { text: 'Content unavailable', type: 'error' } };
                    }
                })
            );

            setPostsWithContent(withContent);
            setLoadingContent(false);
        };

        fetchContent();
    }, [posts]);

    return { postsWithContent, loadingContent };
}
