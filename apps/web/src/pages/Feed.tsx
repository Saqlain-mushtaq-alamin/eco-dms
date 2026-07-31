import React, { useEffect, useRef, useState, Component, ReactNode } from 'react'
import { Button, Input, LoadingSpinner, PostCard, VotePanel } from '@eco-dms/ui'
import type { VoteStatus } from '@eco-dms/ui'
import { getVoteStatus, castVote } from '../api'

// Prevents a VotePanel JS crash from wiping the whole page
class VotePanelErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
    state = { crashed: false }
    static getDerivedStateFromError() { return { crashed: true } }
    render() {
        if (this.state.crashed) return (
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 8 }}>
                Voting unavailable for this post.
            </div>
        )
        return this.props.children
    }
}

type Post = {
    cid?: string
    client_temp_id?: string
    type: 'post'
    version: number
    author_wallet: string
    content: string
    media_cids: string[]
    video_cids: string[]
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
    verification_status?: 'queued' | 'processing' | 'retrying' | 'failed' | 'verified' | 'not_eco' | 'unqueued' | 'none' | 'pending'
    verification_error?: string
    local_image_uri?: string
    local_video_uri?: string
    isOptimistic?: boolean
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

async function createPost(apiBase: string, token: string, authorWallet: string, content: string, mediaCids: string[] = [], videoCids: string[] = []) {
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
            video_cids: videoCids,
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

type CurrentUserProfile = {
    username?: string
    avatar_cid?: string
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

function shortAddress(walletAddress: string): string {
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`
}

export function Feed({
    address,
    onVisitProfile,
    onOpenPost,
}: {
    address: string;
    onVisitProfile: (walletAddress: string) => void;
    onOpenPost: (postCid: string, imageIndex?: number) => void;
}) {
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
    const [selectedVideos, setSelectedVideos] = useState<File[]>([])
    const [uploadingVideos, setUploadingVideos] = useState(false)
    const [videoPreviewUrls, setVideoPreviewUrls] = useState<string[]>([])
    const [showingFeed, setShowingFeed] = useState(true) // true = feed timeline, false = my posts
    const [showComposerModal, setShowComposerModal] = useState(false)
    const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null)
    const [mlPollingActive, setMlPollingActive] = useState(false)
    const quickPhotoInputRef = useRef<HTMLInputElement>(null)
    const quickVideoInputRef = useRef<HTMLInputElement>(null)

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

    const loadCurrentUserProfile = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) return

        try {
            const res = await fetch(`${apiBase}/api/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            })

            if (!res.ok) return
            const data = await res.json()
            setCurrentUserProfile({
                username: data?.username,
                avatar_cid: data?.avatar_cid
            })
        } catch (err) {
            console.error('Failed to load current user profile:', err)
        }
    }

    const load = () => {
        if (showingFeed) {
            loadFeed()
        } else {
            loadMyPosts()
        }
    }

    const isProcessingVerification = (status?: string) => {
        return status === 'pending' || status === 'queued' || status === 'processing' || status === 'retrying'
    }

    useEffect(() => {
        load()
        loadUsers()
        loadCurrentUserProfile()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, showingFeed])


    //! ML Polling Logic - If there are any posts with pending verification, we start a polling interval to refresh the feed every 8 seconds until all are resolved (either verified or failed). This ensures users see updated verification statuses without needing to manually refresh.
    useEffect(() => {
        if (!showingFeed) {
            setMlPollingActive(false)
            return
        }

        const hasPendingVerification = posts.some((post) => isProcessingVerification(post.verification_status))
        setMlPollingActive(hasPendingVerification)

        if (!hasPendingVerification) return

        const interval = setInterval(() => {
            loadFeed()
        }, 8000)

        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posts, showingFeed])

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

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        const validFiles = files.filter(file => {
            if (!file.type.startsWith('video/')) {
                setError('Only video files are allowed')
                return false
            }
            if (file.size > 100 * 1024 * 1024) {
                setError('Video size must be less than 100MB')
                return false
            }
            return true
        })

        setSelectedVideos(prev => [...prev, ...validFiles])

        // Create preview URLs for videos
        validFiles.forEach(file => {
            const url = URL.createObjectURL(file)
            setVideoPreviewUrls(prev => [...prev, url])
        })
    }

    const removeVideo = (index: number) => {
        // Revoke the object URL to free memory
        URL.revokeObjectURL(videoPreviewUrls[index])
        setSelectedVideos(prev => prev.filter((_, i) => i !== index))
        setVideoPreviewUrls(prev => prev.filter((_, i) => i !== index))
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim() && selectedImages.length === 0 && selectedVideos.length === 0) return false
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setError('Not authenticated')
            return false
        }

        const draftContent = content.trim()
        const draftPreview = imagePreviewUrls[0]
        const draftVideoPreview = videoPreviewUrls[0]
        const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const optimisticPost: Post = {
            client_temp_id: optimisticId,
            type: 'post',
            version: 1,
            author_wallet: address,
            content: draftContent,
            media_cids: [],
            video_cids: [],
            tags: [],
            created_at: new Date().toISOString(),
            likes_count: 0,
            comments_count: 0,
            liked_by_user: false,
            verification_status: (selectedImages.length > 0 || selectedVideos.length > 0) ? 'pending' : 'none',
            local_image_uri: draftPreview,
            local_video_uri: draftVideoPreview,
            isOptimistic: true,
        }

        setPosts((prev) => [optimisticPost, ...prev])
        setShowComposerModal(false)
        setContent('')
        setSelectedImages([])
        setImagePreviewUrls([])
        setSelectedVideos([])
        setVideoPreviewUrls([])
        setLoading(true)
        setError(null)
        try {
            let mediaCids: string[] = []
            let videoCids: string[] = []

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

            // Upload videos if any
            if (selectedVideos.length > 0) {
                setUploadingVideos(true)
                const videoUploadPromises = selectedVideos.map(async (file) => {
                    const formData = new FormData()
                    formData.append('file', file)
                    const res = await fetch(`${apiBase}/api/posts/upload-video`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    })
                    if (!res.ok) throw new Error('Video upload failed')
                    const data = await res.json()
                    return data.cid
                })
                videoCids = await Promise.all(videoUploadPromises)
                setUploadingVideos(false)
            }

            const result = await createPost(apiBase, token, address, draftContent, mediaCids, videoCids)
            console.log('Post created successfully:', result)

            setPosts((prev) => prev.map((post) =>
                post.client_temp_id === optimisticId
                    ? {
                        ...post,
                        cid: result.cid,
                        media_cids: mediaCids,
                        video_cids: videoCids,
                        local_image_uri: mediaCids[0] ? undefined : post.local_image_uri,
                        local_video_uri: videoCids[0] ? undefined : post.local_video_uri,
                        isOptimistic: false,
                    }
                    : post,
            ))
            return true
        } catch (e: any) {
            console.error('Create post error:', e)
            setError(e.message || 'Failed to create post')

            // Roll back failed optimistic post
            setPosts((prev) => prev.filter((post) => post.client_temp_id !== optimisticId))
            return false
        } finally {
            setLoading(false)
            setUploadingImages(false)
            setUploadingVideos(false)
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

    const handleQuickVideoAction = () => {
        setShowComposerModal(true)
        setTimeout(() => {
            quickVideoInputRef.current?.click()
        }, 0)
    }

    const handleLike = async (postCid: string, isLiked: boolean) => {
        const token = localStorage.getItem('auth_token') ?? ''
        if (!token) return

        const previousPost = posts.find((p) => p.cid === postCid)
        if (!previousPost) return

        const optimisticLikes = Math.max(0, (previousPost.likes_count || 0) + (isLiked ? -1 : 1))
        setPosts((prev) => prev.map((p) =>
            p.cid === postCid
                ? { ...p, liked_by_user: !isLiked, likes_count: optimisticLikes }
                : p,
        ))

        try {
            const result = await toggleLike(apiBase, token, postCid, isLiked)
            setPosts((prev) => prev.map((p) =>
                p.cid === postCid
                    ? { ...p, liked_by_user: !isLiked, likes_count: result.likes_count }
                    : p,
            ))
        } catch (e: any) {
            console.error('Like error:', e)

            // Roll back optimistic like state on failure
            setPosts((prev) => prev.map((p) =>
                p.cid === postCid
                    ? {
                        ...p,
                        liked_by_user: previousPost.liked_by_user,
                        likes_count: previousPost.likes_count,
                    }
                    : p,
            ))
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

        const tempCommentId = `temp-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const optimisticComment: Comment = {
            cid: tempCommentId,
            type: 'comment',
            post_cid: postCid,
            author_wallet: address,
            content: commentText,
            created_at: new Date().toISOString(),
        }

        const previousComments = comments[postCid] || []
        const previousInput = commentInputs[postCid] || ''
        const previousCount = posts.find((p) => p.cid === postCid)?.comments_count || 0

        setCommentInputs((prev) => ({ ...prev, [postCid]: '' }))
        setComments((prev) => ({ ...prev, [postCid]: [...(prev[postCid] || []), optimisticComment] }))
        setPosts((prev) => prev.map((p) =>
            p.cid === postCid
                ? { ...p, comments_count: previousCount + 1 }
                : p,
        ))

        try {
            await addComment(apiBase, token, postCid, address, commentText)
            console.log('Comment added')

            // Replace optimistic entry with authoritative backend list
            const data = await fetchComments(apiBase, token, postCid)
            setComments((prev) => ({ ...prev, [postCid]: data.comments }))
            setPosts((prev) => prev.map((p) =>
                p.cid === postCid
                    ? { ...p, comments_count: data.count }
                    : p,
            ))
        } catch (e: any) {
            console.error('Add comment error:', e)

            // Roll back optimistic comment on failure
            setCommentInputs((prev) => ({ ...prev, [postCid]: previousInput }))
            setComments((prev) => ({ ...prev, [postCid]: previousComments }))
            setPosts((prev) => prev.map((p) =>
                p.cid === postCid
                    ? { ...p, comments_count: previousCount }
                    : p,
            ))
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

    const getAuthorForPost = (walletAddress: string) => {
        const normalized = walletAddress.toLowerCase()
        const matched = users.find((user) => user.wallet_address.toLowerCase() === normalized)

        if (matched) {
            return {
                displayName: getUserDisplayName(matched),
                avatarUri: resolveIpfsUrl(matched.avatar_cid),
            }
        }

        if (normalized === address.toLowerCase()) {
            return {
                displayName: currentUserProfile?.username?.trim() || shortAddress(walletAddress),
                avatarUri: resolveIpfsUrl(currentUserProfile?.avatar_cid),
            }
        }

        return {
            displayName: shortAddress(walletAddress),
            avatarUri: undefined,
        }
    }

    const getCommentAuthor = (walletAddress: string) => {
        const normalized = walletAddress.toLowerCase()
        const matched = users.find((user) => user.wallet_address.toLowerCase() === normalized)

        if (matched) {
            return {
                name: getUserDisplayName(matched),
                avatarUri: resolveIpfsUrl(matched.avatar_cid),
            }
        }

        if (normalized === address.toLowerCase()) {
            return {
                name: currentUserProfile?.username?.trim() || shortAddress(walletAddress),
                avatarUri: resolveIpfsUrl(currentUserProfile?.avatar_cid),
            }
        }

        return {
            name: shortAddress(walletAddress),
            avatarUri: undefined,
        }
    }

    return (
        <div className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Sidebar */}
                <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                    <div className="glass-card p-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => onVisitProfile(address)}
                                className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 shadow-sm"
                                title="Open profile"
                            >
                                {resolveIpfsUrl(currentUserProfile?.avatar_cid) ? (
                                    <img
                                        src={resolveIpfsUrl(currentUserProfile?.avatar_cid)}
                                        alt="Profile"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-full w-full items-center justify-center font-semibold text-gray-700">
                                        {(currentUserProfile?.username?.charAt(0) || address.substring(2, 3)).toUpperCase()}
                                    </span>
                                )}
                            </button>
                            <div className="min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate">
                                    {currentUserProfile?.username?.trim() || 'Your Profile'}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                    {address.substring(0, 6)}...{address.substring(38)}
                                </p>
                            </div>
                        </div>
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
                                className="h-11 w-11 rounded-full bg-white/80 text-gray-700 font-semibold shadow-sm hover:bg-white transition overflow-hidden"
                                title="Go to profile"
                            >
                                {resolveIpfsUrl(currentUserProfile?.avatar_cid) ? (
                                    <img
                                        src={resolveIpfsUrl(currentUserProfile?.avatar_cid)}
                                        alt="Profile"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span>{(currentUserProfile?.username?.charAt(0) || address.substring(2, 3)).toUpperCase()}</span>
                                )}
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
                    {mlPollingActive && !loading && (
                        <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>ML verification is active (queued/processing/retrying). Feed auto-refreshes every few seconds.</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        {posts.length === 0 && !loading && <p>No posts yet.</p>}
                        {posts.map((p) => (
                            <div key={p.cid ?? p.created_at} className="space-y-2">
                                <PostCard
                                    author={{
                                        address: p.author_wallet,
                                        username: getAuthorForPost(p.author_wallet).displayName,
                                        avatarUri: getAuthorForPost(p.author_wallet).avatarUri,
                                    }}
                                    headerRight={p.verification_status === 'verified' || p.verification_status === 'not_eco' ? (
                                        <button
                                            onClick={() => p.signed_verdict_cid && handleShowVerification(p.signed_verdict_cid)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${p.verified
                                                ? 'border-emerald-200 bg-white/90 text-emerald-700'
                                                : 'border-rose-200 bg-white/90 text-rose-700'
                                                }`}
                                            title={p.signed_verdict_cid ? 'View verification details' : 'Verification completed'}
                                            disabled={!p.signed_verdict_cid}
                                        >
                                            <span
                                                className={`h-2 w-2 rounded-full ${p.verified ? 'bg-emerald-500' : 'bg-rose-500'
                                                    }`}
                                            />
                                            <span>{p.verified ? 'ECO' : 'NOT ECO'}</span>
                                            {typeof p.eco_score === 'number' && (
                                                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold">
                                                    {Math.round(p.eco_score * 100)}%
                                                </span>
                                            )}
                                        </button>
                                    ) : isProcessingVerification(p.verification_status) ? (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/90 px-3.5 py-1.5 text-xs font-semibold text-amber-700">
                                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span>{p.verification_status === 'queued' ? 'Queued' : 'ML Analyzing...'}</span>
                                        </span>
                                    ) : p.verification_status === 'failed' || p.verification_status === 'unqueued' ? (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/90 px-3.5 py-1.5 text-xs font-semibold text-rose-700">
                                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                                            <span>{p.verification_status === 'failed' ? 'Verification failed (auto retry scheduled)' : 'Verification not queued (watchdog will requeue)'}</span>
                                        </span>
                                    ) : undefined}
                                    content={p.content}
                                    imageUris={
                                        (p.media_cids || [])
                                            .map((cid) => resolveIpfsUrl(cid))
                                            .filter((v): v is string => Boolean(v))
                                    }
                                    timestamp={new Date(p.created_at).getTime()}
                                    likes={p.likes_count || 0}
                                    comments={p.comments_count || 0}
                                    isLiked={Boolean(p.liked_by_user)}
                                    isOptimistic={Boolean(p.isOptimistic)}
                                    onImagePress={p.cid ? (index) => onOpenPost(p.cid!, index) : undefined}
                                    onAuthorPress={() => onVisitProfile(p.author_wallet)}
                                    onLike={p.cid ? () => handleLike(p.cid!, p.liked_by_user ?? false) : undefined}
                                    onComment={p.cid ? () => handleToggleComments(p.cid!) : undefined}
                                    ecoScore={typeof p.eco_score === 'number' ? p.eco_score : undefined}
                                    verified={p.verified === true}
                                    votePanel={p.cid && (p.verification_status === 'verified' || p.verification_status === 'not_eco') ? (
                                        <VotePanelErrorBoundary key={p.cid}>
                                            <VotePanel
                                                postCid={p.cid}
                                                viewerWallet={address}
                                                ecoBalance={10} // TODO: read actual ECO balance from chain
                                                onFetchStatus={async (cid) => {
                                                    const s = await getVoteStatus(cid)
                                                    return s as VoteStatus | null
                                                }}
                                                onCastVote={async (cid, choice, sig, bal) => {
                                                    return castVote(cid, choice, sig, bal)
                                                }}
                                            />
                                        </VotePanelErrorBoundary>
                                    ) : undefined}
                                    style={{
                                        borderWidth: 0,
                                        backgroundColor: 'rgba(255,255,255,0.75)',
                                        shadowOpacity: 0.08,
                                        borderRadius: 16,
                                    }}
                                />

                                {p.tags?.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {p.tags.map((tag, i) => (
                                            <span
                                                key={i}
                                                className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                {/* Comments Section */}
                                {expandedComments.has(p.cid!) && (
                                    <div className="glass-card p-4 space-y-4 shadow-sm">
                                        {/* Add Comment Input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={commentInputs[p.cid!] || ''}
                                                onChange={(e) => setCommentInputs({ ...commentInputs, [p.cid!]: e.target.value })}
                                                placeholder="Write a comment..."
                                                className="flex-1 rounded-xl px-3 py-2.5 text-sm bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-lime-300"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault()
                                                        handleAddComment(p.cid!)
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => handleAddComment(p.cid!)}
                                                className="px-4 py-2.5 bg-lime-500 text-gray-900 rounded-xl text-sm font-semibold hover:bg-lime-400"
                                            >
                                                Post
                                            </button>
                                        </div>

                                        {/* Comments List */}
                                        <div className="space-y-3">
                                            {comments[p.cid!]?.length === 0 && (
                                                <p className="text-sm text-gray-500 italic">No comments yet</p>
                                            )}
                                            {comments[p.cid!]?.map((comment) => (
                                                <div key={comment.cid} className="bg-white/85 rounded-xl p-3 border border-gray-100 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
                                                            {getCommentAuthor(comment.author_wallet).avatarUri ? (
                                                                <img src={getCommentAuthor(comment.author_wallet).avatarUri} alt="Comment author" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-gray-700">
                                                                    {getCommentAuthor(comment.author_wallet).name.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => onVisitProfile(comment.author_wallet)}
                                                                className="text-sm font-semibold text-gray-800 hover:underline"
                                                            >
                                                                {getCommentAuthor(comment.author_wallet).name}
                                                            </button>
                                                            <div className="text-xs text-gray-500">
                                                                {new Date(comment.created_at).toLocaleString()}
                                                            </div>
                                                        </div>
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

