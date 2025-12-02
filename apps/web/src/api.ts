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

    // Store the JWT token from the response
    if (data.token) {
        localStorage.setItem('auth_token', data.token)
        console.log('Token stored:', data.token.substring(0, 20) + '...')
    }

    return data
}

export async function getToken(): Promise<string | null> {
    // Get token from localStorage (set by verifySignature)
    return localStorage.getItem('auth_token')
}

export async function getMe() {
    const token = await getToken()

    if (!token) {
        throw new Error('No authentication token found')
    }

    const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })

    if (!res.ok) {
        throw new Error(`Failed to fetch user profile: ${res.status}`)
    }
    return res.json()
}

export async function logout() {
    await fetch(`${API_BASE}/api/siwe/logout`, {
        method: 'POST',
        credentials: 'include'
    })
}