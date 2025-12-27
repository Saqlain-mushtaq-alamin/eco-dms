import React, { useEffect, useState } from 'react'

type Post = {
    cid?: string
    type: 'post'
    version: number
    author_wallet: string
    content: string
    media_cids: string[]
    tags: string[]
    created_at: string
}

async function createPost(apiBase: string, token: string, authorWallet: string, content: string) {
    const res = await fetch(`${apiBase}/api/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            author_wallet: authorWallet,
            content,
            media_cids: [],
            tags: [],
        }),
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to create post: ${res.status}`)
    }
    return res.json() as Promise<{ success: boolean; cid: string }>
}

async function fetchPosts(apiBase: string, token: string, walletAddress: string) {
    const res = await fetch(`${apiBase}/api/posts/${walletAddress}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to load posts: ${res.status}`)
    }
    return res.json() as Promise<{ author_wallet: string; count: number; posts: Post[] }>
}

export function Feed({ address }: { address: string }) {
    const [posts, setPosts] = useState<Post[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Configure your API base URL
    const apiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

    const load = async () => {
        // Retrieve JWT token from your auth flow (e.g., localStorage after SIWE verify)
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        console.log('Feed load - token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN')
        if (!token) {
            setError('Not authenticated')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchPosts(apiBase, token, address)
            console.log('Feed load - full response:', data)
            console.log('Feed load - posts array:', data.posts)
            console.log('Feed load - posts count:', data.posts?.length)
            setPosts(data.posts || [])
        } catch (e: any) {
            console.error('Feed load error:', e)
            setError(e.message || 'Failed to load posts')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) return
        // Retrieve JWT token from your auth flow (e.g., localStorage after SIWE verify)
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') ?? '' : ''
        if (!token) {
            setError('Not authenticated')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const result = await createPost(apiBase, token, address, content.trim())
            console.log('Post created successfully:', result)
            setContent('')
            await load() // refresh list
        } catch (e: any) {
            console.error('Create post error:', e)
            setError(e.message || 'Failed to create post')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Feed</h2>
            <p>Signed in as {address}</p>

            <form onSubmit={onSubmit} className="space-y-2">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write a post..."
                    className="w-full border rounded p-2"
                    rows={3}
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? 'Posting...' : 'Post'}
                </button>
            </form>

            {error && <div className="text-red-600">{error}</div>}
            {loading && !error && <div>Loading...</div>}

            <div className="space-y-3">
                {posts.length === 0 && !loading && <p>No posts yet.</p>}
                {posts.map((p) => (
                    <div key={p.cid ?? p.created_at} className="border rounded p-3">
                        <div className="text-sm text-gray-500">
                            {new Date(p.created_at).toLocaleString()} · CID {p.cid ?? '—'}
                        </div>
                        <div className="mt-1">{p.content}</div>
                        {p.tags?.length ? (
                            <div className="mt-2 text-xs text-gray-600">Tags: {p.tags.join(', ')}</div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}