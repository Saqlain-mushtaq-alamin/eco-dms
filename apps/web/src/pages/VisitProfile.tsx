import React, { useEffect, useState } from 'react'
import { getUserProfile, checkFollowStatus, followUser, unfollowUser } from '../api'
import { Button, Card, LoadingSpinner, ProfileCard } from '@eco-dms/ui'

type UserProfile = {
    wallet_address: string
    username?: string
    name?: string
    bio?: string
    about?: string
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

    if (loading) return <div className="p-6"><LoadingSpinner /></div>
    if (error) return <div className="p-6 text-red-600">{error}</div>
    if (!profile) return <div className="p-6">Profile not found</div>

    const isOwnProfile = walletAddress.toLowerCase() === currentUserAddress.toLowerCase()

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header with Back Button */}
            <div className="max-w-[180px]">
                <Button title="Back to Feed" onPress={onBack} variant="outline" />
            </div>

            {/* Profile Card */}
            <Card>
                <ProfileCard
                    address={profile.wallet_address}
                    username={getProfileName(profile)}
                    bio={getProfileBio(profile)}
                    avatarUri={resolveIpfsUrl(profile.avatar_cid)}
                    ecoScore={0}
                    verifiedActions={posts.length}
                />
                {!isOwnProfile && (
                    <div className="mt-4 max-w-[180px]">
                        <Button
                            title={actionLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                            onPress={handleFollowToggle}
                            disabled={actionLoading}
                            variant={isFollowing ? 'secondary' : 'primary'}
                        />
                    </div>
                )}
                <div className="mt-4 flex gap-8 pt-4 border-t">
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
            </Card>

            {/* Posts Section */}
            <div>
                <h3 className="text-xl font-semibold mb-4">Posts</h3>
                {posts.length === 0 ? (
                    <Card>
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <p className="text-gray-500">No posts yet</p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {posts.map((post) => (
                            <Card key={post.cid ?? post.created_at}>
                                <div className="text-sm text-gray-500 mb-2">
                                    {new Date(post.created_at).toLocaleString()}
                                </div>
                                <div className="text-gray-900 whitespace-pre-wrap">{post.content}</div>

                                {post.media_cids?.length > 0 && (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {post.media_cids.map((cid, idx) => (
                                            <img
                                                key={`${post.cid}-${idx}`}
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

                                <div className="mt-3 flex items-center gap-4 border-t pt-3 text-sm text-gray-500">
                                    <span>❤️ {post.likes_count || 0} likes</span>
                                    <span>💬 {post.comments_count || 0} comments</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
