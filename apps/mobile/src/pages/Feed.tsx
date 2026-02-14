import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Button, Card, Input, PostCard } from '@eco-dms/ui'
import { API_BASE } from '../api'

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
    verified?: boolean
    eco_score?: number
}

export function Feed({ address }: { address: string }) {
    const [posts, setPosts] = useState<Post[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadFeed = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/api/posts/feed/timeline`, {
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Failed to load feed')
            const data = await res.json()
            setPosts(data.posts || [])
        } catch (e: any) {
            console.error('Feed load error:', e)
            setError(e.message || 'Failed to load feed')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadFeed()
    }, [address])

    const handleCreatePost = async () => {
        if (!content.trim()) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/api/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    author_wallet: address,
                    content: content.trim(),
                    media_cids: [],
                    tags: [],
                }),
            })
            if (!res.ok) throw new Error('Failed to create post')
            setContent('')
            await loadFeed()
        } catch (e: any) {
            console.error('Create post error:', e)
            setError(e.message || 'Failed to create post')
        } finally {
            setLoading(false)
        }
    }

    const handleLike = async (postCid: string, isLiked: boolean) => {
        try {
            const method = isLiked ? 'DELETE' : 'POST'
            const res = await fetch(`${API_BASE}/api/posts/${postCid}/like`, {
                method,
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Failed to toggle like')
            const result = await res.json()
            setPosts(posts.map(p =>
                p.cid === postCid
                    ? { ...p, liked_by_user: !isLiked, likes_count: result.likes_count }
                    : p
            ))
        } catch (e: any) {
            console.error('Like error:', e)
        }
    }

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={{ gap: 16 }}>
                <Card padding="md">
                    <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>Feed</Text>
                    <Text style={{ marginBottom: 16, color: '#6b7280' }}>
                        Signed in as {address.slice(0, 6)}...{address.slice(-4)}
                    </Text>

                    {error ? <Text style={{ color: '#ef4444', marginBottom: 16 }}>{error}</Text> : null}

                    <Input
                        label="What's on your mind?"
                        value={content}
                        onChangeText={setContent}
                        placeholder="Share something..."
                        multiline
                        numberOfLines={3}
                    />
                    <Button
                        title={loading ? 'Posting...' : 'Post'}
                        onPress={handleCreatePost}
                        disabled={loading || !content.trim()}
                        variant="primary"
                        style={{ marginTop: 12 }}
                    />
                </Card>

                {posts.map((post) => (
                    <PostCard
                        key={post.cid}
                        post={post}
                        onLike={() => handleLike(post.cid!, post.liked_by_user || false)}
                        onComment={() => console.log('Comment on', post.cid)}
                    />
                ))}
            </View>
        </ScrollView>
    )
}