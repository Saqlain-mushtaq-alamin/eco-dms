import React, { useEffect, useState } from 'react'

type Post = {
    cid?: string
    type: 'post'
    version: number
    author_wallet: string
    content: string
    media_cids: string[]
    tags: string[]
    created_at: string
    likes_count?: number
    comments_count?: number
    liked_by_user?: boolean
}

type Comment = {
    cid: string
    type: 'comment'
    post_cid: string
    author_wallet: string
    content: string
    created_at: string
}

async function createPost(apiBase: string, token: string, authorWallet: string, content: string) {
    const res = await fetch(`${apiBase}/api/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            author_wallet: authorWallet,
            content,
            media_cids: [],
            tags: [],
        }),
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to create post: ${res.status}`)
    }
    return res.json() as Promise<{ success: boolean; cid: string }>
}

async function fetchPosts(apiBase: string, token: string, walletAddress: string) {
    const res = await fetch(`${apiBase}/api/posts/${walletAddress}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to load posts: ${res.status}`)
    }
    return res.json() as Promise<{ author_wallet: string; count: number; posts: Post[] }>
}

async function toggleLike(apiBase: string, token: string, postCid: string, isLiked: boolean) {
    const method = isLiked ? 'DELETE' : 'POST'
    const res = await fetch(`${apiBase}/api/posts/${postCid}/like`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to ${isLiked ? 'unlike' : 'like'} post`)
    }
    return res.json()
}

async function fetchComments(apiBase: string, token: string, postCid: string) {
    const res = await fetch(`${apiBase}/api/posts/${postCid}/comments`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to load comments`)
    }
    return res.json() as Promise<{ post_cid: string; comments: Comment[]; count: number }>
}

async function addComment(apiBase: string, token: string, postCid: string, authorWallet: string, content: string) {
    const res = await fetch(`${apiBase}/api/posts/${postCid}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            post_cid: postCid,
            author_wallet: authorWallet,
            content,
        }),
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to add comment`)
    }
    return res.json()
}

export function Feed({ address }: { address: string }) {
    const [posts, setPosts] = useState<Post[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
    const [comments, setComments] = useState<Record<string, Comment[]>>({})
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

    // Configure your API base URL
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

    const load = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        console.log('Feed load - token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN')
        if (!token) {
            setError('Not authenticated')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchPosts(apiBase, token, address)
            console.log('Feed load - full response:', data)
            console.log('Feed load - posts array:', data.posts)
            console.log('Feed load - posts count:', data.posts?.length)
            setPosts(data.posts || [])
        } catch (e: any) {
            console.error('Feed load error:', e)
            setError(e.message || 'Failed to load posts')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) return
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setError('Not authenticated')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const result = await createPost(apiBase, token, address, content.trim())
            console.log('Post created successfully:', result)
            setContent('')
            await load()
        } catch (e: any) {
            console.error('Create post error:', e)
            setError(e.message || 'Failed to create post')
        } finally {
            setLoading(false)
        }
    }

    const handleLike = async (postCid: string, isLiked: boolean) => {
        const token = localStorage.getItem('auth_token') ?? ''
        if (!token) return

        try {
            const result = await toggleLike(apiBase, token, postCid, isLiked)
            setPosts(posts.map(p =>
                p.cid === postCid
                    ? { ...p, liked_by_user: !isLiked, likes_count: result.likes_count }
                    : p
            ))
        } catch (e: any) {
            console.error('Like error:', e)
        }
    }

    const handleToggleComments = async (postCid: string) => {
        const token = localStorage.getItem('auth_token') ?? ''
        if (!token) return

        const isExpanded = expandedComments.has(postCid)

        if (isExpanded) {
            const newExpanded = new Set(expandedComments)
            newExpanded.delete(postCid)
            setExpandedComments(newExpanded)
        } else {
            try {
                const data = await fetchComments(apiBase, token, postCid)
                setComments({ ...comments, [postCid]: data.comments })
                const newExpanded = new Set(expandedComments)
                newExpanded.add(postCid)
                setExpandedComments(newExpanded)
            } catch (e: any) {
                console.error('Fetch comments error:', e)
            }
        }
    }

    const handleAddComment = async (postCid: string) => {
        const token = localStorage.getItem('auth_token') ?? ''
        if (!token) return

        const commentText = commentInputs[postCid]?.trim()
        if (!commentText) return

        try {
            const result = await addComment(apiBase, token, postCid, address, commentText)
            console.log('Comment added:', result)

            setCommentInputs({ ...commentInputs, [postCid]: '' })

            const data = await fetchComments(apiBase, token, postCid)
            setComments({ ...comments, [postCid]: data.comments })

            setPosts(posts.map(p =>
                p.cid === postCid
                    ? { ...p, comments_count: result.comments_count }
                    : p
            ))
        } catch (e: any) {
            console.error('Add comment error:', e)
        }
    }

    return (
        <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Feed</h2>
            <p>Signed in as {address}</p>

            <form onSubmit={onSubmit} className="space-y-2">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write a post..."
                    className="w-full border rounded p-2"
                    rows={3}
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? 'Posting...' : 'Post'}
                </button>
            </form>

            {error && <div className="text-red-600">{error}</div>}
            {loading && !error && <div>Loading...</div>}

            <div className="space-y-4">
                {posts.length === 0 && !loading && <p>No posts yet.</p>}
                {posts.map((p) => (
                    <div key={p.cid ?? p.created_at} className="border rounded-lg p-4 bg-white shadow-sm">
                        {/* Post Header */}
                        <div className="text-sm text-gray-500 mb-2">
                            <span className="font-medium text-gray-700">
                                {p.author_wallet.substring(0, 6)}...{p.author_wallet.substring(38)}
                            </span>
                            {' · '}
                            {new Date(p.created_at).toLocaleString()}
                        </div>

                        {/* Post Content */}
                        <div className="mt-2 text-gray-900">{p.content}</div>

                        {/* Tags */}
                        {p.tags?.length ? (
                            <div className="mt-2 flex gap-2">
                                {p.tags.map((tag, i) => (
                                    <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {/* Action Buttons */}
                        <div className="mt-3 flex items-center gap-4 border-t pt-3">
                            {/* Like Button */}
                            <button
                                onClick={() => handleLike(p.cid!, p.liked_by_user ?? false)}
                                className={`flex items-center gap-1 px-3 py-1 rounded transition ${p.liked_by_user
                                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                disabled={!p.cid}
                            >
                                <span>{p.liked_by_user ? '❤️' : '🤍'}</span>
                                <span className="text-sm font-medium">{p.likes_count || 0}</span>
                            </button>

                            {/* Comments Button */}
                            <button
                                onClick={() => handleToggleComments(p.cid!)}
                                className="flex items-center gap-1 px-3 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                                disabled={!p.cid}
                            >
                                <span>💬</span>
                                <span className="text-sm font-medium">{p.comments_count || 0}</span>
                            </button>

                            {/* CID Info */}
                            <div className="ml-auto text-xs text-gray-400">
                                CID: {p.cid?.substring(0, 8)}...
                            </div>
                        </div>

                        {/* Comments Section */}
                        {expandedComments.has(p.cid!) && (
                            <div className="mt-4 border-t pt-4 space-y-3">
                                {/* Add Comment Input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={commentInputs[p.cid!] || ''}
                                        onChange={(e) => setCommentInputs({ ...commentInputs, [p.cid!]: e.target.value })}
                                        placeholder="Write a comment..."
                                        className="flex-1 border rounded px-3 py-2 text-sm"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleAddComment(p.cid!)
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => handleAddComment(p.cid!)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                    >
                                        Post
                                    </button>
                                </div>

                                {/* Comments List */}
                                <div className="space-y-2">
                                    {comments[p.cid!]?.length === 0 && (
                                        <p className="text-sm text-gray-500 italic">No comments yet</p>
                                    )}
                                    {comments[p.cid!]?.map((comment) => (
                                        <div key={comment.cid} className="bg-gray-50 rounded p-3">
                                            <div className="text-xs text-gray-500 mb-1">
                                                <span className="font-medium text-gray-700">
                                                    {comment.author_wallet.substring(0, 6)}...{comment.author_wallet.substring(38)}
                                                </span>
                                                {' · '}
                                                {new Date(comment.created_at).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-gray-900">{comment.content}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
