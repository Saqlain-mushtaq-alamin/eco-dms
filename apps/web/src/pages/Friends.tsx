import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, searchUserAccounts } from '../api'

interface FriendUser {
    wallet_address: string
    username?: string
    bio?: string
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

    useEffect(() => {
        const loadUsers = async () => {
            try {
                setLoading(true)
                setError('')

                if (query.trim()) {
                    const res: UsersResponse = await searchUserAccounts(query.trim())
                    setUsers(res?.users || [])
                } else {
                    const res: UsersResponse = await fetchAllUsers()
                    setUsers(res?.users || [])
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
                        <button
                            key={user.wallet_address}
                            className="bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition"
                            onClick={() => navigate(`/profile/${user.wallet_address}`)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900 truncate">
                                    {user.username || 'Unnamed user'}
                                </h3>
                                <span className="text-lg">👤</span>
                            </div>
                            <p className="text-xs text-gray-500 break-all mb-3">{user.wallet_address}</p>
                            <p className="text-sm text-gray-600 line-clamp-2 min-h-[40px]">{user.bio || 'No bio yet'}</p>
                            <div className="mt-3 text-xs text-gray-500 flex gap-3">
                                <span>Followers: {user.followers_count || 0}</span>
                                <span>Following: {user.following_count || 0}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
