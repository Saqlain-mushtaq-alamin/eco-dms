import React, { useEffect, useState } from 'react'
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
                                    title={actionLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                                    onPress={handleFollowToggle}
                                    disabled={actionLoading}
                                    variant={isFollowing ? 'secondary' : 'primary'}
                                />
                            )}
                            <Button title="Back to Feed" onPress={onBack} variant="secondary" />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                    <Card variant="glass" style={{ borderWidth: 0 }}>
                        <h3 className="text-lg font-semibold mb-3">Profile Info</h3>
                        <div className="space-y-2 text-sm text-gray-700">
                            <div><span className="font-medium">Wallet:</span> <span className="break-all">{profile.wallet_address}</span></div>
                            <div><span className="font-medium">Date of birth:</span> {profile.date_of_birth || '-'}</div>
                            <div><span className="font-medium">Location:</span> {profile.location || '-'}</div>
                            <div><span className="font-medium">Bio:</span> {getProfileBio(profile) || '-'}</div>
                        </div>
                        <div className="mt-4 pt-4 flex gap-6">
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{profile.followers?.length || 0}</div>
                                <div className="text-sm text-gray-500">Followers</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{profile.following?.length || 0}</div>
                                <div className="text-sm text-gray-500">Following</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900">{posts.length}</div>
                                <div className="text-sm text-gray-500">Posts</div>
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
                            <PostCard
                                key={post.cid ?? post.created_at}
                                author={{
                                    address: profile.wallet_address,
                                    username: getProfileName(profile),
                                    avatarUri: resolveIpfsUrl(profile.avatar_cid),
                                }}
                                content={post.content || ''}
                                imageUri={post.media_cids?.[0] ? resolveIpfsUrl(post.media_cids[0]) : undefined}
                                timestamp={new Date(post.created_at).getTime()}
                                likes={post.likes_count || 0}
                                comments={post.comments_count || 0}
                                isLiked={Boolean(post.liked_by_user)}
                                style={{
                                    borderWidth: 0,
                                    backgroundColor: 'rgba(255,255,255,0.72)',
                                    shadowOpacity: 0.08,
                                }}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
