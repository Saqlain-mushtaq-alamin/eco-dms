import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, searchUserAccounts, checkFollowStatus, followUser, unfollowUser } from '../api'

interface FriendUser {
    wallet_address: string
    username?: string
    bio?: string
    avatar_cid?: string
    cover_photo_cid?: string
    profession?: string
    followers_count?: number
    following_count?: number
}

interface FriendsProps {
    query: string
}

interface UsersResponse {
    users?: FriendUser[]
}

async function fetchAllUsers(): Promise<UsersResponse> {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const response = await fetch(`${API_BASE}/api/users/all`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`)
    }

    return response.json()
}

export function Friends({ query }: FriendsProps) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [users, setUsers] = useState<FriendUser[]>([])
    const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({})
    const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({})

    const resolveIpfsUrl = (value?: string): string | undefined => {
        if (!value) return undefined
        if (value.startsWith('http://') || value.startsWith('https://')) return value
        if (value.startsWith('ipfs://')) {
            return `https://ipfs.io/ipfs/${value.replace('ipfs://', '')}`
        }
        const clean = value.replace('ipfs/', '').replace('/ipfs/', '')
        return `https://ipfs.io/ipfs/${clean}`
    }

    const loadFollowStatuses = async (loadedUsers: FriendUser[]) => {
        if (loadedUsers.length === 0) {
            setFollowStatus({})
            return
        }

        const statusEntries = await Promise.all(
            loadedUsers.map(async (user) => {
                try {
                    const result = await checkFollowStatus(user.wallet_address)
                    return [user.wallet_address, Boolean(result?.is_following)] as const
                } catch {
                    return [user.wallet_address, false] as const
                }
            }),
        )

        setFollowStatus(Object.fromEntries(statusEntries))
    }

    const handleFollowToggle = async (walletAddress: string, isFollowing: boolean, event: React.MouseEvent) => {
        event.stopPropagation()

        // Optimistic UI update
        setFollowStatus((prev) => ({ ...prev, [walletAddress]: !isFollowing }))
        setUsers((prev) => prev.map((user) => {
            if (user.wallet_address !== walletAddress) return user
            const currentFollowers = user.followers_count || 0
            return {
                ...user,
                followers_count: isFollowing
                    ? Math.max(0, currentFollowers - 1)
                    : currentFollowers + 1,
            }
        }))

        try {
            setFollowLoading((prev) => ({ ...prev, [walletAddress]: true }))

            if (isFollowing) {
                await unfollowUser(walletAddress)
            } else {
                await followUser(walletAddress)
            }
        } catch (err) {
            console.error('Follow toggle failed:', err)

            // Roll back optimistic update
            setFollowStatus((prev) => ({ ...prev, [walletAddress]: isFollowing }))
            setUsers((prev) => prev.map((user) => {
                if (user.wallet_address !== walletAddress) return user
                const currentFollowers = user.followers_count || 0
                return {
                    ...user,
                    followers_count: isFollowing
                        ? currentFollowers + 1
                        : Math.max(0, currentFollowers - 1),
                }
            }))
        } finally {
            setFollowLoading((prev) => ({ ...prev, [walletAddress]: false }))
        }
    }

    useEffect(() => {
        const loadUsers = async () => {
            try {
                setLoading(true)
                setError('')

                if (query.trim()) {
                    const res: UsersResponse = await searchUserAccounts(query.trim())
                    const loadedUsers = res?.users || []
                    setUsers(loadedUsers)
                    await loadFollowStatuses(loadedUsers)
                } else {
                    const res: UsersResponse = await fetchAllUsers()
                    const loadedUsers = res?.users || []
                    setUsers(loadedUsers)
                    await loadFollowStatuses(loadedUsers)
                }
            } catch (err: any) {
                console.error('Failed to load users:', err)
                setError(err?.message || 'Failed to load users')
            } finally {
                setLoading(false)
            }
        }

        loadUsers()
    }, [query])

    if (loading) {
        return <div className="p-6">Loading accounts...</div>
    }

    if (error) {
        return <div className="p-6 text-red-600">{error}</div>
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
                <p className="text-gray-600 mt-1">
                    {query.trim() ? `Search results for "${query}"` : 'All accounts'}
                </p>
            </div>

            {users.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 text-gray-600">No accounts found.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.map((user) => (
                        <div
                            key={user.wallet_address}
                            className="glass-card rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                            onClick={() => navigate(`/profile/${user.wallet_address}`)}
                        >
                            <div className="h-24 bg-gradient-to-r from-lime-100 to-sky-100 relative">
                                {resolveIpfsUrl(user.cover_photo_cid) ? (
                                    <img
                                        src={resolveIpfsUrl(user.cover_photo_cid)}
                                        alt="Cover"
                                        className="h-full w-full object-cover"
                                    />
                                ) : null}

                                <div className="absolute -bottom-7 left-4 h-14 w-14 rounded-full overflow-hidden border-4 border-white bg-gray-200 shadow-md">
                                    {resolveIpfsUrl(user.avatar_cid) ? (
                                        <img
                                            src={resolveIpfsUrl(user.avatar_cid)}
                                            alt="Avatar"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-sm font-bold text-gray-700">
                                            {(user.username?.charAt(0) || user.wallet_address.charAt(2)).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 pt-9">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate text-base">
                                            {user.username || 'Unnamed user'}
                                        </h3>
                                        <p className="text-xs text-gray-500 truncate">{user.profession || 'Member'}</p>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-500 break-all mt-2">{user.wallet_address}</p>
                                <p className="text-sm text-gray-600 line-clamp-2 min-h-[40px] mt-2">{user.bio || 'No bio yet'}</p>

                                <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
                                    <span><strong className="text-gray-700">{user.followers_count || 0}</strong> Followers</span>
                                    <span><strong className="text-gray-700">{user.following_count || 0}</strong> Following</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={(event) => handleFollowToggle(user.wallet_address, Boolean(followStatus[user.wallet_address]), event)}
                                    disabled={Boolean(followLoading[user.wallet_address])}
                                    className={`mt-4 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition ${followStatus[user.wallet_address]
                                        ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                        : 'bg-lime-400 text-gray-900 hover:bg-lime-300'
                                        }`}
                                >
                                    {followLoading[user.wallet_address]
                                        ? 'Please wait...'
                                        : followStatus[user.wallet_address]
                                            ? 'Following'
                                            : 'Follow'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
