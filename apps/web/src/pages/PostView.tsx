import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE, getMe } from '../api'
import { Card, LoadingSpinner } from '@eco-dms/ui'

type Post = {
    cid?: string
    author_wallet: string
    content: string
    media_cids: string[]
    created_at: string
    likes_count?: number
    comments_count?: number
    liked_by_user?: boolean
}

type Comment = {
    cid: string
    post_cid: string
    author_wallet: string
    content: string
    created_at: string
}

function resolveIpfsUrl(value?: string): string | undefined {
    if (!value) return undefined
    if (value.startsWith('http://') || value.startsWith('https://')) return value
    if (value.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${value.replace('ipfs://', '')}`
    }
    const clean = value.replace('ipfs/', '').replace('/ipfs/', '')
    return `https://ipfs.io/ipfs/${clean}`
}

function shortAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function PostView({ postCid }: { postCid: string }) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const [post, setPost] = useState<Post | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [commentInput, setCommentInput] = useState('')
    const [currentUserAddress, setCurrentUserAddress] = useState('')
    const [activeImageIndex, setActiveImageIndex] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadingComment, setLoadingComment] = useState(false)
    const [loadingLike, setLoadingLike] = useState(false)
    const [error, setError] = useState('')

    const imageUrls = useMemo(() => {
        if (!post?.media_cids?.length) return []
        return post.media_cids
            .map((cid) => resolveIpfsUrl(cid))
            .filter((v): v is string => Boolean(v))
    }, [post])

    useEffect(() => {
        const imageParam = Number(searchParams.get('image') || '0')
        if (!Number.isNaN(imageParam) && imageParam >= 0) {
            setActiveImageIndex(imageParam)
        }
    }, [searchParams])

    useEffect(() => {
        const load = async () => {
            const token = localStorage.getItem('auth_token') || ''
            if (!token) {
                setError('Not authenticated')
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                setError('')

                const [postRes, commentsRes, me] = await Promise.all([
                    fetch(`${API_BASE}/api/posts/by-cid/${postCid}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${API_BASE}/api/posts/${postCid}/comments`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    getMe(),
                ])

                if (!postRes.ok) {
                    throw new Error(`Failed to load post: ${postRes.status}`)
                }

                const postPayload = await postRes.json()
                setPost(postPayload.post || null)

                if (commentsRes.ok) {
                    const commentsPayload = await commentsRes.json()
                    setComments(commentsPayload.comments || [])
                } else {
                    setComments([])
                }

                if (me?.wallet_address) {
                    setCurrentUserAddress(me.wallet_address)
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load post')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [postCid])

    useEffect(() => {
        if (imageUrls.length === 0) {
            setActiveImageIndex(0)
            return
        }

        if (activeImageIndex >= imageUrls.length) {
            setActiveImageIndex(0)
            setSearchParams((prev) => {
                prev.set('image', '0')
                return prev
            })
        }
    }, [activeImageIndex, imageUrls.length, setSearchParams])

    const setImageIndex = (index: number) => {
        if (imageUrls.length === 0) return
        const clamped = ((index % imageUrls.length) + imageUrls.length) % imageUrls.length
        setActiveImageIndex(clamped)
        setSearchParams((prev) => {
            prev.set('image', String(clamped))
            return prev
        })
    }

    const handleLike = async () => {
        if (!post?.cid || loadingLike) return
        const token = localStorage.getItem('auth_token') || ''
        if (!token) return

        const wasLiked = Boolean(post.liked_by_user)

        setLoadingLike(true)
        setPost((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                liked_by_user: !wasLiked,
                likes_count: Math.max(0, (prev.likes_count || 0) + (wasLiked ? -1 : 1)),
            }
        })

        try {
            const res = await fetch(`${API_BASE}/api/posts/${post.cid}/like`, {
                method: wasLiked ? 'DELETE' : 'POST',
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error('Like request failed')
            const payload = await res.json()
            setPost((prev) => (prev ? { ...prev, likes_count: payload.likes_count, liked_by_user: !wasLiked } : prev))
        } catch {
            setPost((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    liked_by_user: wasLiked,
                    likes_count: Math.max(0, (prev.likes_count || 0) + (wasLiked ? 1 : -1)),
                }
            })
        } finally {
            setLoadingLike(false)
        }
    }

    const handleAddComment = async () => {
        if (!post?.cid || !commentInput.trim() || loadingComment || !currentUserAddress) return
        const token = localStorage.getItem('auth_token') || ''
        if (!token) return

        const content = commentInput.trim()
        setLoadingComment(true)

        try {
            const res = await fetch(`${API_BASE}/api/posts/${post.cid}/comments`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    post_cid: post.cid,
                    author_wallet: currentUserAddress,
                    content,
                }),
            })
            if (!res.ok) throw new Error('Failed to post comment')

            const commentsRes = await fetch(`${API_BASE}/api/posts/${post.cid}/comments`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (commentsRes.ok) {
                const payload = await commentsRes.json()
                setComments(payload.comments || [])
                setPost((prev) => (prev ? { ...prev, comments_count: payload.count || (payload.comments || []).length } : prev))
            }

            setCommentInput('')
        } catch {
            // keep UI stable without crashing page
        } finally {
            setLoadingComment(false)
        }
    }

    if (loading) {
        return <div className="p-6"><LoadingSpinner /></div>
    }

    if (error || !post) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <Card variant="glass" style={{ borderWidth: 0 }}>
                    <div className="space-y-4">
                        <p className="text-red-600">{error || 'Post not found'}</p>
                        <button onClick={() => navigate(-1)} className="rounded-xl px-4 py-2 text-sm font-semibold">
                            Back
                        </button>
                    </div>
                </Card>
            </div>
        )
    }

    const createdAtText = new Date(post.created_at).toLocaleString()
    const activeImageUrl = imageUrls[activeImageIndex]

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="rounded-xl border border-slate-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                    Back to feed
                </button>
                <div className="text-sm text-slate-500">Post by {shortAddress(post.author_wallet)} · {createdAtText}</div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-10 gap-5">
                <div className="xl:col-span-7">
                    <Card variant="glass" style={{ borderWidth: 0 }}>
                        <div className="rounded-2xl bg-slate-100/70 border border-white/60 overflow-hidden">
                            <div className="relative h-[52vh] md:h-[62vh] bg-slate-200/50">
                                {activeImageUrl ? (
                                    <img src={activeImageUrl} alt={`Post media ${activeImageIndex + 1}`} className="h-full w-full object-contain bg-slate-900" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-slate-500">
                                        No image in this post
                                    </div>
                                )}

                                {imageUrls.length > 1 && (
                                    <>
                                        <button
                                            onClick={() => setImageIndex(activeImageIndex - 1)}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/55 text-white text-2xl leading-none hover:bg-black/70"
                                            title="Previous photo"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            onClick={() => setImageIndex(activeImageIndex + 1)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/55 text-white text-2xl leading-none hover:bg-black/70"
                                            title="Next photo"
                                        >
                                            ›
                                        </button>
                                    </>
                                )}
                            </div>

                            {imageUrls.length > 1 && (
                                <div className="p-3 bg-white/80 border-t border-slate-200/70">
                                    <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
                                        {imageUrls.map((img, idx) => (
                                            <button
                                                key={`${img}-${idx}`}
                                                onClick={() => setImageIndex(idx)}
                                                className={`h-14 md:h-16 rounded-lg overflow-hidden border ${idx === activeImageIndex ? 'border-lime-500 ring-2 ring-lime-200' : 'border-slate-200'}`}
                                                title={`Open image ${idx + 1}`}
                                            >
                                                <img src={img} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="xl:col-span-3">
                    <Card variant="glass" style={{ borderWidth: 0 }}>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-slate-500">Post content</div>
                                <p className="mt-2 text-slate-800 leading-relaxed whitespace-pre-wrap">{post.content || 'No text content'}</p>
                            </div>

                            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/75 px-3 py-2">
                                <button
                                    onClick={handleLike}
                                    disabled={loadingLike}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${post.liked_by_user ? 'text-rose-600' : 'text-slate-700'}`}
                                >
                                    {post.liked_by_user ? '❤️ Liked' : '🤍 Like'}
                                </button>
                                <div className="text-sm text-slate-600">{post.likes_count || 0} likes</div>
                                <div className="text-sm text-slate-600">{comments.length} comments</div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white/75 p-3">
                                <div className="text-sm font-semibold text-slate-800">Comments</div>
                                <div className="mt-3 space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                                    {comments.length === 0 && (
                                        <p className="text-sm text-slate-500 italic">No comments yet</p>
                                    )}
                                    {comments.map((comment) => (
                                        <div key={comment.cid} className="rounded-lg border border-slate-200 bg-white p-2.5">
                                            <div className="text-[11px] text-slate-500">
                                                {shortAddress(comment.author_wallet)} · {new Date(comment.created_at).toLocaleString()}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-800">{comment.content}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 flex gap-2">
                                    <input
                                        type="text"
                                        value={commentInput}
                                        onChange={(e) => setCommentInput(e.target.value)}
                                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        placeholder="Write a comment..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleAddComment()
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        disabled={loadingComment || !commentInput.trim()}
                                        className="rounded-lg bg-lime-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-lime-400 disabled:opacity-50"
                                    >
                                        Post
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
