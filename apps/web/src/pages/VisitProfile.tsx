import React, { useEffect, useState } from 'react'
import { getUserProfile, checkFollowStatus, followUser, unfollowUser } from '../api'

type UserProfile = {
    wallet_address: string
    username?: string
    bio?: string
    avatar_cid?: string
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
}

interface VisitProfileProps {
    walletAddress: string
    currentUserAddress: string
    onBack: () => void
}

export default function VisitProfile({ walletAddress, currentUserAddress, onBack }: VisitProfileProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [posts, setPosts] = useState<Post[]>([])
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState('')

    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

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

    const fetchUserPosts = async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) return []

        try {
            const res = await fetch(`${apiBase}/api/posts/${walletAddress}`, {
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
        try {
            setActionLoading(true)
            if (isFollowing) {
                await unfollowUser(walletAddress)
                setIsFollowing(false)
            } else {
                await followUser(walletAddress)
                setIsFollowing(true)
            }
            // Refresh profile to update follower count
            await fetchProfile()
        } catch (err: any) {
            console.error('Follow/Unfollow error:', err)
            setError(err.message || 'Failed to update follow status')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) return <div className="p-6">Loading profile...</div>
    if (error) return <div className="p-6 text-red-600">{error}</div>
    if (!profile) return <div className="p-6">Profile not found</div>

    const isOwnProfile = walletAddress.toLowerCase() === currentUserAddress.toLowerCase()

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header with Back Button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Feed
            </button>

            {/* Profile Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                            {profile.avatar_cid ? (
                                <img
                                    src={`https://${profile.avatar_cid}.ipfs.nftstorage.link`}
                                    alt="Avatar"
                                    className="w-20 h-20 rounded-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                />
                            ) : (
                                profile.username?.charAt(0).toUpperCase() || profile.wallet_address.charAt(2).toUpperCase()
                            )}
                        </div>

                        {/* User Info */}
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {profile.username || 'Anonymous User'}
                            </h2>
                            <p className="text-sm text-gray-500 font-mono">
                                {profile.wallet_address.substring(0, 6)}...{profile.wallet_address.substring(38)}
                            </p>
                            {profile.bio && (
                                <p className="mt-2 text-gray-700">{profile.bio}</p>
                            )}
                        </div>
                    </div>

                    {/* Follow Button */}
                    {!isOwnProfile && (
                        <button
                            onClick={handleFollowToggle}
                            disabled={actionLoading}
                            className={`px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 ${isFollowing
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {actionLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="mt-6 flex gap-8 pt-4 border-t">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{posts.length}</div>
                        <div className="text-sm text-gray-500">Posts</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{profile.followers?.length || 0}</div>
                        <div className="text-sm text-gray-500">Followers</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{profile.following?.length || 0}</div>
                        <div className="text-sm text-gray-500">Following</div>
                    </div>
                </div>
            </div>

            {/* Posts Section */}
            <div>
                <h3 className="text-xl font-semibold mb-4">Posts</h3>
                {posts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No posts yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map((post) => (
                            <div key={post.cid ?? post.created_at} className="border rounded-lg p-4 bg-white shadow-sm">
                                {/* Post Header */}
                                <div className="text-sm text-gray-500 mb-2">
                                    {new Date(post.created_at).toLocaleString()}
                                </div>

                                {/* Post Content */}
                                <div className="mt-2 text-gray-900">{post.content}</div>

                                {/* Post Images */}
                                {post.media_cids?.length > 0 && (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {post.media_cids.map((cid, idx) => (
                                            <img
                                                key={idx}
                                                src={`https://${cid}.ipfs.nftstorage.link`}
                                                alt="Post image"
                                                className="w-full rounded border object-cover"
                                                style={{ maxHeight: '300px' }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = `https://ipfs.io/ipfs/${cid}`
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Post Stats */}
                                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 border-t pt-3">
                                    <span>❤️ {post.likes_count || 0} likes</span>
                                    <span>💬 {post.comments_count || 0} comments</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
