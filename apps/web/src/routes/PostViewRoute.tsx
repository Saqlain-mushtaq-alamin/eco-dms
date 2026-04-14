import React from 'react'
import { useParams } from 'react-router-dom'
import PostView from '../pages/PostView'

export function PostViewRoute() {
    const { postCid } = useParams<{ postCid: string }>()

    if (!postCid) {
        return (
            <div className="flex items-center justify-center h-64">
                <p>Post not found.</p>
            </div>
        )
    }

    return <PostView postCid={postCid} />
}
