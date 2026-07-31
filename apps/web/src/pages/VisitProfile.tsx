import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, getUserProfile, checkFollowStatus, followUser, unfollowUser } from '../api'
import { Button, Card, LoadingSpinner, PostCard } from '@eco-dms/ui'

type UserProfile = {
    wallet_address: string
    username?: string
    name?: string
    bio?: string
    about?: string
    avatar_cid?: string
    cover_photo_cid?: string
    date_of_birth?: string
    location?: string
    profession?: string
    followers: string[]
    following: string[]
    created_at?: string
}

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
    verification_status?: 'queued' | 'processing' | 'retrying' | 'failed' | 'verified' | 'not_eco' | 'unqueued' | 'none' | 'pending'
}

type Comment = {
    cid: string
    post_cid: string
    author_wallet: string
    content: string
    created_at: string
}

interface VisitProfileProps {
    walletAddress: string
    currentUserAddress: string
    onBack: () => void
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

function getProfileName(profile: UserProfile): string {
    return profile.username?.trim() || profile.name?.trim() || ''
}

function getProfileBio(profile: UserProfile): string {
    return profile.bio?.trim() || profile.about?.trim() || ''
}

export default function VisitProfile({ walletAddress, currentUserAddress, onBack }: VisitProfileProps) {
    const navigate = useNavigate()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [posts, setPosts] = useState<Post[]>([])
    const [isFollowing, setIsFollowing] = useState(false)
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
    const [comments, setComments] = useState<Record<string, Comment[]>>({})
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState('')

    const fetchComments = async (postCid: string) => {
        const token = localStorage.getItem('auth_token')
        if (!token) return []

        try {
            const response = await fetch(`${API_BASE}/api/posts/${postCid}/comments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!response.ok) return []
            const data = await response.json()
            return data.comments || []
        } catch (err) {
            console.error('Failed to fetch comments:', err)
            return []
        }
    }

    const handleLike = async (postCid: string, isLiked: boolean) => {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        const previousPost = posts.find((post) => post.cid === postCid)
        if (!previousPost) return

        const optimisticLikes = Math.max(0, (previousPost.likes_count || 0) + (isLiked ? -1 : 1))
        setPosts((prev) => prev.map((post) =>
            post.cid === postCid
                ? {
                    ...post,
                    liked_by_user: !isLiked,
                    likes_count: optimisticLikes,
                }
                : post,
        ))

        try {
            const response = await fetch(`${API_BASE}/api/posts/${postCid}/like`, {
                method: isLiked ? 'DELETE' : 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!response.ok) throw new Error('Like request failed')
            const data = await response.json()

            setPosts((prev) => prev.map((post) =>
                post.cid === postCid
                    ? {
                        ...post,
                        liked_by_user: !isLiked,
                        likes_count: data.likes_count,
                    }
                    : post,
            ))
        } catch (err) {
            console.error('Like/unlike failed:', err)

            // Roll back optimistic like if backend fails
            setPosts((prev) => prev.map((post) =>
                post.cid === postCid
                    ? {
                        ...post,
                        liked_by_user: previousPost.liked_by_user,
                        likes_count: previousPost.likes_count,
                    }
                    : post,
            ))
        }
    }

    const handleToggleComments = async (postCid: string) => {
        if (expandedComments.has(postCid)) {
            const next = new Set(expandedComments)
            next.delete(postCid)
            setExpandedComments(next)
            return
        }

        const postComments = await fetchComments(postCid)
        setComments((prev) => ({ ...prev, [postCid]: postComments }))
        const next = new Set(expandedComments)
        next.add(postCid)
        setExpandedComments(next)
    }

    const handleAddComment = async (postCid: string) => {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        const content = (commentInputs[postCid] || '').trim()
        if (!content) return

        const tempCommentId = `temp-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const optimisticComment: Comment = {
            cid: tempCommentId,
            post_cid: postCid,
            author_wallet: currentUserAddress,
            content,
            created_at: new Date().toISOString(),
        }

        const previousComments = comments[postCid] || []
        const previousInput = commentInputs[postCid] || ''
        const previousCount = posts.find((post) => post.cid === postCid)?.comments_count || 0

        setCommentInputs((prev) => ({ ...prev, [postCid]: '' }))
        setComments((prev) => ({ ...prev, [postCid]: [...(prev[postCid] || []), optimisticComment] }))
        setPosts((prev) => prev.map((post) =>
            post.cid === postCid
                ? { ...post, comments_count: previousCount + 1 }
                : post,
        ))

        try {
            const response = await fetch(`${API_BASE}/api/posts/${postCid}/comments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    post_cid: postCid,
                    author_wallet: currentUserAddress,
                    content,
                }),
            })
            if (!response.ok) throw new Error('Comment request failed')

            await response.json()

            const refreshed = await fetchComments(postCid)
            setComments((prev) => ({ ...prev, [postCid]: refreshed }))
            setPosts((prev) => prev.map((post) =>
                post.cid === postCid
                    ? { ...post, comments_count: refreshed.length }
                    : post,
            ))
        } catch (err) {
            console.error('Add comment failed:', err)

            // Roll back optimistic comment if backend fails
            setCommentInputs((prev) => ({ ...prev, [postCid]: previousInput }))
            setComments((prev) => ({ ...prev, [postCid]: previousComments }))
            setPosts((prev) => prev.map((post) =>
                post.cid === postCid
                    ? { ...post, comments_count: previousCount }
                    : post,
            ))
        }
    }

    const fetchProfile = async () => {
        try {
            setLoading(true)
            const [profileData, followStatus, postsData] = await Promise.all([
                getUserProfile(walletAddress),
                checkFollowStatus(walletAddress),
                fetchUserPosts()
            ])

            setProfile(profileData)
            setIsFollowing(followStatus.is_following)
            setPosts(postsData)
        } catch (err: any) {
            console.error('Fetch error:', err)
            setError(err.message || 'Failed to load profile')
        } finally {
            setLoading(false)
        }
    }

    const isProcessingVerification = (status?: string) => {
        return status === 'pending' || status === 'queued' || status === 'processing' || status === 'retrying'
    }

    const fetchUserPosts = async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) return []

        try {
            const res = await fetch(`${API_BASE}/api/posts/${walletAddress}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) return []
            const data = await res.json()
            return data.posts || []
        } catch (err) {
            console.error('Failed to fetch posts:', err)
            return []
        }
    }

    useEffect(() => {
        if (walletAddress) {
            fetchProfile()
        }
    }, [walletAddress])

    const handleFollowToggle = async () => {
        const wasFollowing = isFollowing
        const previousFollowers = profile?.followers || []

        // Optimistic follow UI update
        setIsFollowing(!wasFollowing)
        setProfile((prev) => {
            if (!prev) return prev
            const followerSet = new Set(prev.followers || [])
            if (wasFollowing) {
                followerSet.delete(currentUserAddress)
            } else {
                followerSet.add(currentUserAddress)
            }
            return { ...prev, followers: Array.from(followerSet) }
        })

        try {
            setActionLoading(true)
            if (wasFollowing) {
                await unfollowUser(walletAddress)
            } else {
                await followUser(walletAddress)
            }
        } catch (err: any) {
            console.error('Follow/Unfollow error:', err)
            setError(err.message || 'Failed to update follow status')

            // Roll back optimistic follow update
            setIsFollowing(wasFollowing)
            setProfile((prev) => (prev ? { ...prev, followers: previousFollowers } : prev))
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) return <div className="p-6"><LoadingSpinner /></div>
    if (error) return <div className="p-6 text-red-600">{error}</div>
    if (!profile) return <div className="p-6">Profile not found</div>

    const isOwnProfile = walletAddress.toLowerCase() === currentUserAddress.toLowerCase()

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
            <Card variant="glass" style={{ borderWidth: 0 }}>
                <div className="relative">
                    <div className="h-48 md:h-52 w-full rounded-2xl bg-gray-100 overflow-hidden shadow-sm">
                        {resolveIpfsUrl(profile.cover_photo_cid) ? (
                            <img src={resolveIpfsUrl(profile.cover_photo_cid)} alt="Cover" className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400">Cover photo</div>
                        )}
                    </div>

                    <div className="mt-4 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 border-4 border-white -mt-12 shadow-md">
                                {resolveIpfsUrl(profile.avatar_cid) ? (
                                    <img src={resolveIpfsUrl(profile.avatar_cid)} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center font-semibold text-gray-600">
                                        {(getProfileName(profile) || profile.wallet_address).charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="pt-1">
                                <h2 className="text-2xl font-semibold text-gray-900">{getProfileName(profile) || 'Unnamed user'}</h2>
                                <p className="text-gray-600">{profile.profession || 'Profession not set'}</p>
                                <p className="text-gray-500 text-sm">{profile.location || 'Location not set'}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {!isOwnProfile && (
                                <Button
                                    title={actionLoading ? 'Loading...' : isFollowing ? 'Rooted' : 'Root'}
                                    onPress={handleFollowToggle}
                                    disabled={actionLoading}
                                    variant={isFollowing ? 'secondary' : 'primary'}
                                />
                            )}
                            <button
                                id="view-eco-portfolio-btn"
                                type="button"
                                onClick={() => navigate(`/portfolio/${walletAddress}`)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.5rem 0.9rem',
                                    borderRadius: '12px',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid rgba(34,197,94,0.3)',
                                    background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.08))',
                                    color: '#15803d',
                                }}
                            >
                                🏡 Garden Portfolio
                            </button>
                            <Button title="Back to Garden" onPress={onBack} variant="secondary" />
                        </div>

                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                    <Card variant="glass" style={{ borderWidth: 0 }}>
                        <h3 className="text-lg font-semibold mb-3">Profile Info</h3>
                        <div className="space-y-2 text-sm text-gray-700">
                            <div><span className="font-medium">🗃️:</span> <span className="break-all">{profile.wallet_address}</span></div>
                            <div><span className="font-medium">🎂:</span> {profile.date_of_birth || '-'}</div>
                            <div><span className="font-medium">📍:</span> {profile.location || '-'}</div>
                            <div><span className="font-medium">📝:</span> {getProfileBio(profile) || '-'}</div>
                        </div>
                        <div className="mt-4 pt-4 flex gap-6">
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{profile.followers?.length || 0}</div>
                                <div className="text-sm text-gray-500">Rooters</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{profile.following?.length || 0}</div>
                                <div className="text-sm text-gray-500">Rooting</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{posts.length}</div>
                                <div className="text-sm text-gray-500">Sprouts</div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-8 space-y-3">
                    <h3 className="text-lg font-semibold">Posts</h3>
                    {posts.length === 0 ? (
                        <Card variant="glass" style={{ borderWidth: 0 }}>
                            <div className="text-gray-500">No posts yet.</div>
                        </Card>
                    ) : (
                        posts.map((post) => (
                            <div key={post.cid ?? post.created_at} className="space-y-3">
                                <PostCard
                                    author={{
                                        address: profile.wallet_address,
                                        username: getProfileName(profile),
                                        avatarUri: resolveIpfsUrl(profile.avatar_cid),
                                    }}
                                    content={post.content || ''}
                                    imageUris={
                                        (post.media_cids || [])
                                            .map((cid) => resolveIpfsUrl(cid))
                                            .filter((v): v is string => Boolean(v))
                                    }
                                    timestamp={new Date(post.created_at).getTime()}
                                    likes={post.likes_count || 0}
                                    comments={post.comments_count || 0}
                                    isLiked={Boolean(post.liked_by_user)}
                                    headerRight={post.verification_status === 'verified' || post.verification_status === 'not_eco' ? (
                                        <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${post.verified ? 'border-emerald-200 bg-white/90 text-emerald-700' : 'border-rose-200 bg-white/90 text-rose-700'}`}>
                                            <span className={`h-2 w-2 rounded-full ${post.verified ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span>{post.verified ? 'ROOTED SPROUT' : 'NOT ROOTED'}</span>
                                            {typeof post.eco_score === 'number' && (
                                                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold">
                                                    {Math.round(post.eco_score * 100)}%
                                                </span>
                                            )}
                                        </span>
                                    ) : isProcessingVerification(post.verification_status) ? (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/90 px-3.5 py-1.5 text-xs font-semibold text-amber-700">
                                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span>{post.verification_status === 'queued' ? 'Queued' : 'ML Analyzing...'}</span>
                                        </span>
                                    ) : post.verification_status === 'failed' || post.verification_status === 'unqueued' ? (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/90 px-3.5 py-1.5 text-xs font-semibold text-rose-700">
                                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                                            <span>{post.verification_status === 'failed' ? 'Verification failed (auto retry scheduled)' : 'Verification not queued (watchdog will requeue)'}</span>
                                        </span>
                                    ) : undefined}
                                    onImagePress={post.cid ? (index) => navigate(`/post/${post.cid}?image=${index}`) : undefined}
                                    onLike={post.cid ? () => handleLike(post.cid!, post.liked_by_user ?? false) : undefined}
                                    onComment={post.cid ? () => handleToggleComments(post.cid!) : undefined}
                                    style={{
                                        borderWidth: 0,
                                        backgroundColor: 'rgba(255,255,255,0.72)',
                                        shadowOpacity: 0.08,
                                    }}
                                />

                                {post.cid && expandedComments.has(post.cid) && (
                                    <Card variant="glass" style={{ borderWidth: 0 }}>
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={commentInputs[post.cid] || ''}
                                                    onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.cid!]: e.target.value }))}
                                                    placeholder="Leave a nurture on someone's sprout..."
                                                    className="flex-1 rounded-xl px-3 py-2.5 text-sm bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-lime-300"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault()
                                                            handleAddComment(post.cid!)
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleAddComment(post.cid!)}
                                                    className="px-4 py-2.5 bg-lime-500 text-gray-900 rounded-xl text-sm font-semibold hover:bg-lime-400"
                                                >
                                                    Nurture
                                                </button>
                                            </div>

                                            <div className="space-y-3">
                                                {(comments[post.cid] || []).length === 0 && (
                                                    <p className="text-sm text-gray-500 italic">No comments yet</p>
                                                )}

                                                {(comments[post.cid] || []).map((comment) => (
                                                    <div key={comment.cid} className="bg-white/85 rounded-xl p-3 border border-gray-100 shadow-sm">
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
                                    </Card>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
