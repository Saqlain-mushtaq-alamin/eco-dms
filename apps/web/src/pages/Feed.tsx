import React, { useEffect, useRef, useState } from 'react'
import { Button, Input, LoadingSpinner } from '@eco-dms/ui'

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
    verified?: boolean
    eco_score?: number
    signed_verdict_cid?: string
    verifier_address?: string
    verified_at?: string
}

type VerificationDetails = {
    is_eco: boolean
    confidence: number
    breakdown: {
        yolo_score: number
        clip_score: number
        efficientnet_score: number
        text_score: number
    }
    detected_objects: string[]
    reasoning: string
    models_used: string[]
    verifier_address: string
    timestamp: string
    signature: string
}

type Comment = {
    cid: string
    type: 'comment'
    post_cid: string
    author_wallet: string
    content: string
    created_at: string
}

async function createPost(apiBase: string, token: string, authorWallet: string, content: string, mediaCids: string[] = []) {
    const res = await fetch(`${apiBase}/api/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            author_wallet: authorWallet,
            content,
            media_cids: mediaCids,
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

async function fetchFeedTimeline(apiBase: string, token: string) {
    const res = await fetch(`${apiBase}/api/posts/feed/timeline`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to load feed: ${res.status}`)
    }
    return res.json() as Promise<{ count: number; posts: Post[]; message?: string }>
}

async function fetchAllUsers(apiBase: string, token: string) {
    const res = await fetch(`${apiBase}/api/users/all`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to load users: ${res.status}`)
    }
    return res.json() as Promise<{ users: any[]; count: number }>
}

type User = {
    wallet_address: string
    username?: string
    bio?: string
    avatar_cid?: string
    name?: string
    about?: string
    followers_count: number
    following_count: number
}

function resolveIpfsUrl(value?: string): string | undefined {
    if (!value) return undefined
    if (value.startsWith('http://') || value.startsWith('https://')) return value
    if (value.startsWith('ipfs://')) {
        const cid = value.replace('ipfs://', '')
        return `https://ipfs.io/ipfs/${cid}`
    }
    const clean = value.replace('ipfs/', '').replace('/ipfs/', '')
    return `https://ipfs.io/ipfs/${clean}`
}

function getUserDisplayName(user: User): string {
    return user.username?.trim() || user.name?.trim() || 'Anonymous'
}

function getUserBio(user: User): string {
    return user.bio?.trim() || user.about?.trim() || ''
}

export function Feed({ address, onVisitProfile }: { address: string; onVisitProfile: (walletAddress: string) => void }) {
    const [posts, setPosts] = useState<Post[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
    const [comments, setComments] = useState<Record<string, Comment[]>>({})
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
    const [verificationModal, setVerificationModal] = useState<{ isOpen: boolean; details: VerificationDetails | null; loading: boolean }>({
        isOpen: false,
        details: null,
        loading: false
    })
    const [selectedImages, setSelectedImages] = useState<File[]>([])
    const [uploadingImages, setUploadingImages] = useState(false)
    const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
    const [showingFeed, setShowingFeed] = useState(true) // true = feed timeline, false = my posts
    const [showComposerModal, setShowComposerModal] = useState(false)
    const quickPhotoInputRef = useRef<HTMLInputElement>(null)

    // Configure your API base URL
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

    const loadFeed = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setError('Not authenticated')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchFeedTimeline(apiBase, token)
            console.log('Feed timeline loaded:', data)
            setPosts(data.posts || [])
            if (data.message) {
                setError(data.message)
            }
        } catch (e: any) {
            console.error('Feed load error:', e)
            setError(e.message || 'Failed to load feed')
        } finally {
            setLoading(false)
        }
    }

    const loadMyPosts = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setError('Not authenticated')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchPosts(apiBase, token, address)
            setPosts(data.posts || [])
        } catch (e: any) {
            console.error('My posts load error:', e)
            setError(e.message || 'Failed to load posts')
        } finally {
            setLoading(false)
        }
    }

    const loadUsers = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            console.log('No token for loading users')
            return
        }
        try {
            console.log('Fetching all users...')
            const data = await fetchAllUsers(apiBase, token)
            console.log('All users response:', data)
            // Filter out current user
            const filteredUsers = data.users.filter((u: User) => u.wallet_address.toLowerCase() !== address.toLowerCase())
            console.log('Filtered users (excluding self):', filteredUsers)
            setUsers(filteredUsers)
        } catch (e: any) {
            console.error('Users load error:', e)
            setError(`Failed to load users: ${e.message}`)
        }
    }

    const load = () => {
        if (showingFeed) {
            loadFeed()
        } else {
            loadMyPosts()
        }
    }

    useEffect(() => {
        load()
        loadUsers()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, showingFeed])

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        // Validate file types and sizes
        const validFiles = files.filter(file => {
            if (!file.type.startsWith('image/')) {
                setError('Only image files are allowed')
                return false
            }
            if (file.size > 10 * 1024 * 1024) {
                setError('Image size must be less than 10MB')
                return false
            }
            return true
        })

        setSelectedImages(prev => [...prev, ...validFiles])

        // Create preview URLs
        validFiles.forEach(file => {
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreviewUrls(prev => [...prev, reader.result as string])
            }
            reader.readAsDataURL(file)
        })
    }

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index))
        setImagePreviewUrls(prev => prev.filter((_, i) => i !== index))
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim() && selectedImages.length === 0) return false
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setError('Not authenticated')
            return false
        }
        setLoading(true)
        setError(null)
        try {
            let mediaCids: string[] = []

            // Upload images if any
            if (selectedImages.length > 0) {
                setUploadingImages(true)
                const uploadPromises = selectedImages.map(async (file) => {
                    const formData = new FormData()
                    formData.append('file', file)
                    const res = await fetch(`${apiBase}/api/posts/upload-image`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    })
                    if (!res.ok) throw new Error('Image upload failed')
                    const data = await res.json()
                    return data.cid
                })
                mediaCids = await Promise.all(uploadPromises)
                setUploadingImages(false)
            }

            const result = await createPost(apiBase, token, address, content.trim(), mediaCids)
            console.log('Post created successfully:', result)
            setContent('')
            setSelectedImages([])
            setImagePreviewUrls([])
            await load()
            return true
        } catch (e: any) {
            console.error('Create post error:', e)
            setError(e.message || 'Failed to create post')
            return false
        } finally {
            setLoading(false)
            setUploadingImages(false)
        }
    }

    const openComposer = () => {
        setShowComposerModal(true)
    }

    const handleQuickPhotoAction = () => {
        setShowComposerModal(true)
        setTimeout(() => {
            quickPhotoInputRef.current?.click()
        }, 0)
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
    const handleShowVerification = async (signedVerdictCid: string) => {
        setVerificationModal({ isOpen: true, details: null, loading: true })

        try {
            // Fetch signed verdict from IPFS
            const ipfsUrl = `https://ipfs.io/ipfs/${signedVerdictCid}`
            const response = await fetch(ipfsUrl)

            if (!response.ok) {
                throw new Error('Failed to fetch verification details')
            }

            const signedVerdict = await response.json()
            setVerificationModal({
                isOpen: true,
                details: {
                    ...signedVerdict.verdict,
                    verifier_address: signedVerdict.verifier_address,
                    timestamp: signedVerdict.timestamp,
                    signature: signedVerdict.signature
                },
                loading: false
            })
        } catch (err) {
            console.error('Error fetching verification:', err)
            setVerificationModal({ isOpen: true, details: null, loading: false })
        }
    }

    const closeVerificationModal = () => {
        setVerificationModal({ isOpen: false, details: null, loading: false })
    }
    return (
        <div className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Sidebar */}
                <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                    <div className="glass-card p-4">
                        <h4 className="font-semibold text-gray-900">Account</h4>
                        <p className="text-sm text-gray-600 mt-1">
                            Signed in as {address.substring(0, 6)}...{address.substring(38)}
                        </p>
                    </div>
                    <div className="glass-card p-4">
                        
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => onVisitProfile(address)}
                                className="w-full text-left px-3 py-2 rounded-lg bg-white/70 hover:bg-white transition shadow-sm"
                            >
                                👤 User Profile
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const section = document.getElementById('discover-people-card')
                                    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg bg-white/70 hover:bg-white transition shadow-sm"
                            >
                                👥 Follower Explore
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowingFeed(true)}
                                className="w-full text-left px-3 py-2 rounded-lg bg-white/70 hover:bg-white transition shadow-sm"
                            >
                                📰 Feed
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowingFeed(false)}
                                className="w-full text-left px-3 py-2 rounded-lg bg-white/70 hover:bg-white transition shadow-sm"
                            >
                                ✍️ My Posts
                            </button>
                            <button
                                type="button"
                                onClick={() => setError('Saved posts feature coming soon')}
                                className="w-full text-left px-3 py-2 rounded-lg bg-white/70 hover:bg-white transition shadow-sm"
                            >
                                🔖 Saved
                            </button>
                        </div>
                    </div>

                                
                </aside>

                {/* Middle Main Feed */}
                <main className="col-span-1 lg:col-span-6 space-y-4">


                    {/* Create Post Composer */}
                    <div className="glass-card p-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => onVisitProfile(address)}
                                className="h-11 w-11 rounded-full bg-white/80 text-gray-700 font-semibold shadow-sm hover:bg-white transition"
                                title="Go to profile"
                            >
                                {address.substring(2, 3).toUpperCase()}
                            </button>
                            <button
                                type="button"
                                onClick={openComposer}
                                className="flex-1 text-left rounded-full bg-white/80 px-4 py-2.5 text-gray-500 hover:bg-white transition shadow-sm"
                            >
                                What's on your mind?
                            </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleQuickPhotoAction}
                                className="px-3 py-2 rounded-lg bg-white/80 hover:bg-white text-gray-700 text-sm font-medium transition shadow-sm"
                            >
                                🖼 Photo
                            </button>
                            <button
                                type="button"
                                onClick={openComposer}
                                className="px-3 py-2 rounded-lg bg-white/80 hover:bg-white text-gray-700 text-sm font-medium transition shadow-sm"
                            >
                                🎬 Video
                            </button>
                            <button
                                type="button"
                                onClick={openComposer}
                                className="px-3 py-2 rounded-lg bg-white/80 hover:bg-white text-gray-700 text-sm font-medium transition shadow-sm"
                            >
                                📝 Article
                            </button>
                            <input
                                ref={quickPhotoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageSelect}
                                className="hidden"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Feed Toggle Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowingFeed(true)}
                            className={`px-4 py-2 font-medium transition ${showingFeed
                                ? 'rounded-lg bg-white/90 text-blue-600 shadow-sm'
                                : 'rounded-lg text-gray-600 hover:bg-white/70 hover:text-gray-900'
                                }`}
                        >
                            Following Feed
                        </button>
                        <button
                            onClick={() => setShowingFeed(false)}
                            className={`px-4 py-2 font-medium transition ${!showingFeed
                                ? 'rounded-lg bg-white/90 text-blue-600 shadow-sm'
                                : 'rounded-lg text-gray-600 hover:bg-white/70 hover:text-gray-900'
                                }`}
                        >
                            My Posts
                        </button>
                    </div>

                    {error && <div className="text-red-600">{error}</div>}
                    {loading && !error && <div><LoadingSpinner /></div>}

                    <div className="space-y-4">
                        {posts.length === 0 && !loading && <p>No posts yet.</p>}
                        {posts.map((p) => (
                            <div key={p.cid ?? p.created_at} className="glass-card p-4 shadow-xl">
                                {/* Post Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm text-gray-500">
                                        <span className="font-medium text-gray-700">
                                            {p.author_wallet.substring(0, 6)}...{p.author_wallet.substring(38)}
                                        </span>
                                        {' · '}
                                        {new Date(p.created_at).toLocaleString()}
                                    </div>
                                    {/* Eco Verification Badge */}
                                    {p.signed_verdict_cid && (
                                        <button
                                            onClick={() => handleShowVerification(p.signed_verdict_cid!)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition hover:shadow-md ${p.verified
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            title="Click to view verification details"
                                        >
                                            {p.verified ? (
                                                <>
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>ECO</span>
                                                    {p.eco_score && <span className="text-xs">({Math.round(p.eco_score * 100)}%)</span>}
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>Not Eco</span>
                                                    {p.eco_score && <span className="text-xs">({Math.round(p.eco_score * 100)}%)</span>}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Post Content */}
                                <div className="mt-2 text-gray-900">{p.content}</div>

                                {/* Post Images */}
                                {p.media_cids?.length > 0 && (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {p.media_cids.map((cid, idx) => (
                                            <img
                                                key={idx}
                                                src={resolveIpfsUrl(cid)}
                                                alt="Post image"
                                                className="w-full rounded border object-cover"
                                                style={{ maxHeight: '300px' }}
                                                onError={(e) => {
                                                    const fallback = `https://gateway.pinata.cloud/ipfs/${cid.replace('ipfs://', '')}`
                                                    const img = e.target as HTMLImageElement
                                                    if (!img.src.includes('gateway.pinata.cloud')) {
                                                        img.src = fallback
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

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
                                <div className="mt-3 flex items-center gap-4 pt-3">
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
                                    <div className="mt-4 pt-4 space-y-3">
                                        {/* Add Comment Input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={commentInputs[p.cid!] || ''}
                                                onChange={(e) => setCommentInputs({ ...commentInputs, [p.cid!]: e.target.value })}
                                                placeholder="Write a comment..."
                                                className="flex-1 rounded-lg px-3 py-2 text-sm bg-white/80"
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
                </main>

                {/* Right Sidebar */}
                <aside className="hidden lg:block lg:col-span-3 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                    <div className="glass-card p-4">
                        <div id="discover-people-card">
                            <h3 className="text-lg font-semibold mb-3">Discover People</h3>
                            {users.length === 0 ? (
                                <p className="text-gray-500 text-sm">No other users yet</p>
                            ) : (
                                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                                    {users.map((user) => (
                                        <div
                                            key={user.wallet_address}
                                            onClick={() => onVisitProfile(user.wallet_address)}
                                            className="cursor-pointer rounded-lg bg-white/80 p-3 hover:bg-white shadow-sm transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-200">
                                                    {resolveIpfsUrl(user.avatar_cid) ? (
                                                        <img
                                                            src={resolveIpfsUrl(user.avatar_cid)}
                                                            alt="Avatar"
                                                            className="h-12 w-12 object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex h-12 w-12 items-center justify-center text-sm font-bold text-gray-700">
                                                            {(getUserDisplayName(user).charAt(0) || user.wallet_address.charAt(2)).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-semibold text-gray-900">{getUserDisplayName(user)}</p>
                                                    <p className="font-mono text-xs text-gray-500">
                                                        {user.wallet_address.substring(0, 6)}...{user.wallet_address.substring(38)}
                                                    </p>
                                                    {getUserBio(user) && (
                                                        <p className="mt-1 truncate text-sm text-gray-600">{getUserBio(user)}</p>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">{user.followers_count || 0} followers</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>

            {showComposerModal && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowComposerModal(false)}
                >
                    <div
                        className="glass-card w-full max-w-2xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-gray-900">Create Post</h3>
                            <button
                                type="button"
                                onClick={() => setShowComposerModal(false)}
                                className="h-9 w-9 rounded-full bg-white/80 hover:bg-white text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                const success = await onSubmit(e)
                                if (success) {
                                    setShowComposerModal(false)
                                }
                            }}
                            className="space-y-3"
                        >
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write your post content..."
                                className="w-full min-h-[140px] rounded-xl bg-white/80 px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
                            />

                            {imagePreviewUrls.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {imagePreviewUrls.map((url, index) => (
                                        <div key={index} className="relative rounded-lg overflow-hidden">
                                            <img src={url} alt="Preview" className="w-full h-28 object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer px-3 py-2 rounded-lg bg-white/80 hover:bg-white text-sm font-medium text-gray-700 shadow-sm transition">
                                        🖼 Photo
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageSelect}
                                            className="hidden"
                                            disabled={loading}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="px-3 py-2 rounded-lg bg-white/80 text-sm font-medium text-gray-500 shadow-sm"
                                    >
                                        🎬 Video
                                    </button>
                                    <button
                                        type="button"
                                        className="px-3 py-2 rounded-lg bg-white/80 text-sm font-medium text-gray-500 shadow-sm"
                                    >
                                        📝 Article
                                    </button>
                                </div>

                                <Button
                                    title={uploadingImages ? 'Uploading Images...' : loading ? 'Posting...' : 'Post'}
                                    onPress={() => {
                                        const event = { preventDefault: () => { } } as React.FormEvent
                                        onSubmit(event)
                                    }}
                                    disabled={loading || uploadingImages}
                                />
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Verification Details Modal */}
            {verificationModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeVerificationModal}>
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">🌍 Eco Verification Details</h2>
                            <button
                                onClick={closeVerificationModal}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {verificationModal.loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                </div>
                            ) : verificationModal.details ? (
                                <div className="space-y-6">
                                    {/* Verdict Summary */}
                                    <div className={`p-4 rounded-lg border-2 ${verificationModal.details.is_eco
                                        ? 'bg-green-50 border-green-300'
                                        : 'bg-gray-50 border-gray-300'
                                        }`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            {verificationModal.details.is_eco ? (
                                                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                            <div>
                                                <h3 className={`text-2xl font-bold ${verificationModal.details.is_eco ? 'text-green-700' : 'text-gray-700'
                                                    }`}>
                                                    {verificationModal.details.is_eco ? '✅ Eco-Friendly' : '❌ Not Eco-Friendly'}
                                                </h3>
                                                <p className="text-sm text-gray-600">
                                                    Confidence: <span className="font-bold">{Math.round(verificationModal.details.confidence * 100)}%</span>
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-700 mt-2">{verificationModal.details.reasoning}</p>
                                    </div>

                                    {/* Detected Objects */}
                                    {verificationModal.details.detected_objects.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-gray-900 mb-2">🔍 Detected Eco Objects:</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {verificationModal.details.detected_objects.map((obj, idx) => (
                                                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                                        {obj.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Score Breakdown */}
                                    <div>
                                        <h4 className="font-semibold text-gray-900 mb-3">📊 Score Breakdown:</h4>
                                        <div className="space-y-3">
                                            {[
                                                { name: 'Object Detection (YOLOv8)', score: verificationModal.details.breakdown.yolo_score, weight: '40%' },
                                                { name: 'Image-Text Alignment (CLIP)', score: verificationModal.details.breakdown.clip_score, weight: '30%' },
                                                { name: 'Visual Classification', score: verificationModal.details.breakdown.efficientnet_score, weight: '20%' },
                                                { name: 'Text Content', score: verificationModal.details.breakdown.text_score, weight: '10%' }
                                            ].map((item, idx) => (
                                                <div key={idx}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-gray-700">{item.name} <span className="text-gray-500">({item.weight})</span></span>
                                                        <span className="font-semibold">{Math.round(item.score * 100)}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                                            style={{ width: `${item.score * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ML Models Used */}
                                    <div>
                                        <h4 className="font-semibold text-gray-900 mb-2">🤖 ML Models Used:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {verificationModal.details.models_used.map((model, idx) => (
                                                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                                                    {model}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Verifier Info */}
                                    <div className="border-t pt-4">
                                        <h4 className="font-semibold text-gray-900 mb-2">🔐 Verification Info:</h4>
                                        <div className="text-sm space-y-1 text-gray-600">
                                            <div className="flex gap-2">
                                                <span className="font-medium">Verifier Address:</span>
                                                <span className="font-mono text-xs break-all">{verificationModal.details.verifier_address}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="font-medium">Verified At:</span>
                                                <span>{new Date(verificationModal.details.timestamp).toLocaleString()}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="font-medium">Signature:</span>
                                                <span className="font-mono text-xs break-all">
                                                    {verificationModal.details.signature.substring(0, 20)}...{verificationModal.details.signature.slice(-20)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-gray-700">
                                            <p><strong>✅ Cryptographically Verified:</strong> This verdict is signed and stored on IPFS. Anyone can verify its authenticity.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-red-600">Failed to load verification details</p>
                                    <p className="text-sm text-gray-500 mt-2">The verification data may not be available on IPFS</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}