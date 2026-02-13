import React from 'react';
import { useEcoFeed } from '../hooks/useFeed';
import { fetchFromIPFS } from '../config/apollo';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * Feed Component using The Graph + Backend API
 * 
 * WRITE OPERATIONS (Backend API):
 * Frontend → POST /api/posts → Backend → IPFS → OrbitDB
 * 
 * READ OPERATIONS (The Graph + IPFS):
 * Frontend → GraphQL → The Graph → Blockchain events
 * Frontend → Fetch IPFS → Get content
 * 
 * Benefits:
 * - Write: Fast, authenticated via backend
 * - Read: 5-10x faster (cached by The Graph), trustless
 */

interface PostWithContent {
    id: string;
    contentCID: string;
    author: {
        id: string;
        handle?: string;
        walletAddress: string;
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

export function Feed({ address, onVisitProfile }: { address: string; onVisitProfile: (walletAddress: string) => void }) {
    // Post creation state
    const [newPostText, setNewPostText] = React.useState('');
    const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Step 1: Query The Graph for post metadata
    const { posts, loading, loadMore, hasMore, refetch } = useEcoFeed(20);

    // Step 2: Fetch content from IPFS for each post
    const [postsWithContent, setPostsWithContent] = React.useState<PostWithContent[]>([]);
    const [loadingContent, setLoadingContent] = React.useState(true);

    // Handle image selection
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Submit new post
    const handleSubmitPost = async () => {
        if (!newPostText.trim() && !selectedImage) {
            alert('Please add some text or an image');
            return;
        }

        setIsSubmitting(true);
        try {
            let mediaCids: string[] = [];

            // Upload image if selected
            if (selectedImage) {
                const formData = new FormData();
                formData.append('file', selectedImage);

                const uploadRes = await fetch(`${BACKEND_URL}/api/posts/upload-image`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    },
                    body: formData,
                });

                if (!uploadRes.ok) {
                    throw new Error('Failed to upload image');
                }

                const { cid } = await uploadRes.json();
                mediaCids = [cid];
            }

            // Create post
            const postRes = await fetch(`${BACKEND_URL}/api/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
                body: JSON.stringify({
                    author_wallet: address,
                    content: newPostText,
                    media_cids: mediaCids,
                    tags: [],
                }),
            });

            if (!postRes.ok) {
                throw new Error('Failed to create post');
            }

            // Clear form
            setNewPostText('');
            setSelectedImage(null);
            setImagePreview(null);

            // Refresh feed after a short delay (wait for blockchain indexing)
            setTimeout(() => {
                refetch();
            }, 3000);

            alert('✅ Post created! It will appear in the feed shortly.');
        } catch (error: any) {
            console.error('Post creation error:', error);
            alert(`Failed to create post: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

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

    if (loading && postsWithContent.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p>Loading feed from The Graph...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-2">🌱 Eco Feed</h1>
            <p className="text-sm text-gray-600 mb-6">
                📊 The Graph • 📁 IPFS • ⛓️ Blockchain Verified
            </p>

            {/* Create Post Form */}
            <div className="bg-white border rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-lg font-semibold mb-4">Create Post</h2>

                {/* Text Area */}
                <textarea
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    placeholder="Share your eco-friendly activities... 🌍"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    rows={4}
                    disabled={isSubmitting}
                />

                {/* Image Preview */}
                {imagePreview && (
                    <div className="mt-3 relative">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="max-h-64 rounded-lg border"
                        />
                        <button
                            onClick={() => {
                                setSelectedImage(null);
                                setImagePreview(null);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                            disabled={isSubmitting}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                    {/* Upload Image Button */}
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">Upload Image</span>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            disabled={isSubmitting}
                        />
                    </label>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmitPost}
                        disabled={isSubmitting || (!newPostText.trim() && !selectedImage)}
                        className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                Posting...
                            </span>
                        ) : (
                            '📝 Post'
                        )}
                    </button>
                </div>

                <p className="text-xs text-gray-500 mt-3">
                    💡 Posts with eco-friendly images will be verified by our ML model
                </p>
            </div>

            <div className="space-y-6">
                {loadingContent && postsWithContent.length === 0 ? (
                    <div className="text-center py-4 text-gray-600">
                        Fetching content from IPFS...
                    </div>
                ) : postsWithContent.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-lg border">
                        <p className="text-gray-600">No eco-verified posts yet</p>
                        <p className="text-sm text-gray-500 mt-2">Create eco-friendly content to see it here!</p>
                    </div>
                ) : (
                    postsWithContent.map((post) => (
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
                                <div className="flex-1">
                                    <button
                                        onClick={() => onVisitProfile(post.author.walletAddress)}
                                        className="font-semibold hover:text-green-600 transition text-left"
                                    >
                                        {post.author.handle || `${post.author.id.slice(0, 6)}...${post.author.id.slice(-4)}`}
                                    </button>
                                    <p className="text-xs text-gray-500">
                                        {new Date(parseInt(post.timestamp) * 1000).toLocaleString()}
                                    </p>
                                </div>
                                {/* Eco Verification Badge */}
                                {post.isEcoVerified && (
                                    <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span>ECO</span>
                                        {post.ecoConfidence && (
                                            <span className="text-xs ml-1">({post.ecoConfidence}%)</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Content from IPFS */}
                            <div className="mb-4">
                                <p className="text-gray-800 whitespace-pre-wrap">{post.content?.text || 'No text content'}</p>
                                {post.content?.image && (
                                    <img
                                        src={post.content.image}
                                        alt="Post"
                                        className="mt-3 rounded-lg max-w-full border"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                )}
                            </div>

                            {/* Stats */}
                            <div className="flex gap-6 text-sm text-gray-600 pt-3 border-t">
                                <span>❤️ {post.totalLikes} likes</span>
                                <span>💬 {post.totalComments} comments</span>
                            </div>

                            {/* Data source indicator */}
                            <div className="mt-3 pt-3 border-t text-xs text-gray-400">
                                <span title="Data from The Graph">📊 Graph</span>
                                <span className="mx-2">•</span>
                                <span title={`IPFS CID: ${post.contentCID}`}>
                                    📁 IPFS ({post.contentCID.slice(0, 8)}...)
                                </span>
                                <span className="mx-2">•</span>
                                <span>⛓️ Verified</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Load More */}
            {hasMore && (
                <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            Loading...
                        </span>
                    ) : (
                        'Load More Posts'
                    )}
                </button>
            )}

            {/* Info Footer */}
            <div className="mt-8 text-center text-xs text-gray-500">
                <p>All data verified on-chain and cached by The Graph</p>
                <p className="mt-1">Content stored on IPFS for decentralization</p>
            </div>
        </div>
    );
}
