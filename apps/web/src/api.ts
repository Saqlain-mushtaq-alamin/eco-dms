// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\api.ts
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

    // Store the JWT token from response
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