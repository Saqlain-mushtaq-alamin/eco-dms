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
    return r.json()
}

export async function getMe() {
    const r = await fetch(`${API_BASE}/api/me`, {
        credentials: 'include'
    })
    if (!r.ok) throw new Error('not authed')
    return r.json()
}

export async function logout() {
    await fetch(`${API_BASE}/api/siwe/logout`, {
        method: 'POST',
        credentials: 'include'
    })
}