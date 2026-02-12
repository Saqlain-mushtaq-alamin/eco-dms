import React from 'react';
import { useEcoFeed, usePostContent } from '../hooks/useFeed';
import { fetchFromIPFS } from '../config/apollo';

/**
 * EXAMPLE: New Feed Component using The Graph
 * 
 * OLD FLOW (Backend API):
 * Frontend → GET /api/posts/feed/timeline → Backend DB → Response
 * 
 * NEW FLOW (The Graph + IPFS):
 * Frontend → GraphQL → The Graph → Blockchain events
 * Frontend → Fetch IPFS → Get content
 * 
 * Benefits:
 * - Faster (cached by The Graph)
 * - Scalable (no backend database load)
 * - Trustless (data from blockchain)
 */

interface PostWithContent {
    id: string;
    contentCID: string;
    author: {
        id: string;
        handle?: string;
    };
    timestamp: string;
    isEcoVerified: boolean;
    ecoConfidence?: string;
    totalLikes: string;
    totalComments: string;
    content?: {
        text?: string;
        image?: string;
        type?: string;
    };
}

export function FeedExample() {
    // Step 1: Query The Graph for post metadata
    const { posts, loading, loadMore, hasMore } = useEcoFeed(20);

    // Step 2: Fetch content from IPFS for each post
    const [postsWithContent, setPostsWithContent] = React.useState<PostWithContent[]>([]);
    const [loadingContent, setLoadingContent] = React.useState(true);

    React.useEffect(() => {
        if (!posts.length) {
            setPostsWithContent([]);
            setLoadingContent(false);
            return;
        }

        const fetchAllContent = async () => {
            setLoadingContent(true);

            const withContent = await Promise.all(
                posts.map(async (post: any) => {
                    try {
                        // Fetch content from IPFS
                        const content = await fetchFromIPFS(post.contentCID);
                        return { ...post, content };
                    } catch (error) {
                        console.error(`Failed to fetch IPFS for ${post.contentCID}:`, error);
                        return {
                            ...post,
                            content: { text: 'Content unavailable', type: 'error' },
                        };
                    }
                })
            );

            setPostsWithContent(withContent);
            setLoadingContent(false);
        };

        fetchAllContent();
    }, [posts]);

    if (loading) {
        return <div className="text-center py-8">Loading feed from The Graph...</div>;
    }

    if (loadingContent) {
        return <div className="text-center py-8">Fetching content from IPFS...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">🌱 Eco Feed</h1>
            <p className="text-sm text-gray-600 mb-4">
                Data from: The Graph (metadata) + IPFS (content)
            </p>

            <div className="space-y-6">
                {postsWithContent.map((post) => (
                    <div
                        key={post.id}
                        className="bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition"
                    >
                        {/* Author */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-semibold">
                                    {post.author.handle?.[0]?.toUpperCase() || '?'}
                                </span>
                            </div>
                            <div>
                                <p className="font-semibold">
                                    {post.author.handle || `${post.author.id.slice(0, 6)}...`}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {new Date(parseInt(post.timestamp) * 1000).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Content from IPFS */}
                        <div className="mb-4">
                            <p className="text-gray-800">{post.content?.text || 'No text content'}</p>
                            {post.content?.image && (
                                <img
                                    src={post.content.image}
                                    alt="Post"
                                    className="mt-3 rounded-lg max-w-full"
                                />
                            )}
                        </div>

                        {/* Eco Verification Badge */}
                        {post.isEcoVerified && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm mb-3">
                                <span>✓ Eco-Verified</span>
                                {post.ecoConfidence && (
                                    <span className="text-xs">({post.ecoConfidence}% confidence)</span>
                                )}
                            </div>
                        )}

                        {/* Stats */}
                        <div className="flex gap-6 text-sm text-gray-600">
                            <span>❤️ {post.totalLikes} likes</span>
                            <span>💬 {post.totalComments} comments</span>
                        </div>

                        {/* Data source indicator */}
                        <div className="mt-3 pt-3 border-t text-xs text-gray-400">
                            <span>Metadata: The Graph</span>
                            <span className="mx-2">•</span>
                            <span>Content: IPFS ({post.contentCID.slice(0, 8)}...)</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Load More */}
            {hasMore && (
                <button
                    onClick={loadMore}
                    className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                    Load More Posts
                </button>
            )}
        </div>
    );
}
