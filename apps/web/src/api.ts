export const API_BASE = 'http://localhost:8000'

export async function getNonce(): Promise<{ nonce: string }> {
    const r = await fetch(`${API_BASE}/api/siwe/nonce`)
    return r.json()
}

export async function prepareMessage(address: string, chainId: number, nonce: string) {
    const r = await fetch(`${API_BASE}/api/siwe/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chain_id: chainId, nonce })
    })
    if (!r.ok) throw new Error('prepare failed')
    return r.json() as Promise<{ message: string }>
}

export async function verifySignature(message: string, signature: string) {
    const r = await fetch(`${API_BASE}/api/siwe/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, signature })
    })
    if (!r.ok) throw new Error('verify failed')

    const data = await r.json()
    if (data.token) {
        localStorage.setItem('auth_token', data.token)
        console.log('✅ Token stored')
    }

    return data
}

export async function getMe() {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })

    if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`)
    return res.json()
}

export async function logout() {
    const token = localStorage.getItem('auth_token')
    if (token) {
        try {
            await fetch(`${API_BASE}/api/siwe/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            })
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }
    localStorage.removeItem('auth_token')
}

export async function uploadImage(file: File): Promise<{ cid: string; url: string }> {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE}/api/posts/upload-image`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })

    if (!res.ok) {
        const error = await res.text()
        throw new Error(error || `Failed to upload image: ${res.status}`)
    }

    return res.json()
}

export async function getAllUsers() {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/users/all`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`)
    return res.json()
}

export async function searchUserAccounts(query: string, limit: number = 20) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const params = new URLSearchParams({
        q: query,
        limit: String(limit)
    })

    const res = await fetch(`${API_BASE}/api/users/search?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to search users: ${res.status}`)
    return res.json()
}

export async function getUserProfile(walletAddress: string) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/users/${walletAddress}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`)
    return res.json()
}

export async function followUser(walletAddress: string) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/users/follow/${walletAddress}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to follow user: ${res.status}`)
    return res.json()
}

export async function unfollowUser(walletAddress: string) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/users/follow/${walletAddress}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to unfollow user: ${res.status}`)
    return res.json()
}

export async function checkFollowStatus(walletAddress: string) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/users/check-follow/${walletAddress}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to check follow status: ${res.status}`)
    return res.json()
}

export async function getFeedTimeline() {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/posts/feed/timeline`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status}`)
    return res.json()
}

export interface AppNotification {
    id: string
    type: 'like' | 'comment' | 'reward' | string
    message: string
    recipient_wallet: string
    actor_wallet?: string | null
    post_cid?: string | null
    metadata?: Record<string, unknown>
    read: boolean
    created_at: string
}

export interface NotificationListResponse {
    notifications: AppNotification[]
    count: number
    unread_count: number
}

export async function getNotifications(limit: number = 20): Promise<NotificationListResponse> {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const params = new URLSearchParams({ limit: String(limit) })
    const res = await fetch(`${API_BASE}/api/notifications?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`)
    return res.json()
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to mark notification as read: ${res.status}`)
    return res.json()
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to mark all notifications as read: ${res.status}`)
    return res.json()
}

export interface NotificationPost {
    cid?: string
    author_wallet?: string
    author?: string
    content?: string
    media_cids?: string[]
    created_at?: string
    likes_count?: number
    comments_count?: number
    verification_status?: 'pending' | 'verified' | 'none' | string
    verified?: boolean
    eco_score?: number
}

export async function getPostByCid(postCid: string): Promise<{ post: NotificationPost }> {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('No authentication token')

    const res = await fetch(`${API_BASE}/api/posts/by-cid/${postCid}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) throw new Error(`Failed to fetch post by cid: ${res.status}`)
    return res.json()
}

// ── Community Voting API ───────────────────────────────────────────────────────

export interface VoteStatusResponse {
    post_cid: string
    path: 'auto' | 'standard' | 'extended'
    quorum: number
    deadline: number
    seconds_left: number
    window_open: boolean
    total_votes: number
    quorum_met: boolean
    has_voted: boolean | null
    ml_confidence: number
    // only after close
    eco_votes?: number
    not_eco_votes?: number
    final_verdict?: boolean | null
    settled?: boolean
}

export async function getVoteStatus(postCid: string): Promise<VoteStatusResponse | null> {
    const token = localStorage.getItem('auth_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
        const res = await fetch(`${API_BASE}/api/votes/${encodeURIComponent(postCid)}/status`, { headers })
        if (res.status === 404) return null
        if (!res.ok) throw new Error(`Vote status fetch failed: ${res.status}`)
        const data = await res.json()
        // Backend returns {window_open: false, exists: false} when no window has been opened yet
        if (data.exists === false) return null
        return data as VoteStatusResponse
    } catch {
        return null
    }
}

export async function castVote(
    postCid: string,
    choice: 'eco' | 'not_eco',
    signature: string,
    ecoTokenBalance: number,
): Promise<{ success: boolean; message: string }> {
    const token = localStorage.getItem('auth_token')
    if (!token) return { success: false, message: 'Not authenticated' }

    const res = await fetch(`${API_BASE}/api/votes/${encodeURIComponent(postCid)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            choice,
            signature,
            eco_token_balance: ecoTokenBalance,
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        return { success: false, message: err.detail ?? 'Vote failed' }
    }
    return res.json()
}