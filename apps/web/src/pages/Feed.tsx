import React from 'react'

export function Feed({ address }: { address: string }) {
    return (
        <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Feed</h2>
            <p>Signed in as {address}</p>
            <p>Placeholder social feed.</p>
        </div>
    )
}