import React from 'react'

export function ProfileCreate({ address, onDone }: { address: string; onDone: () => void }) {
    return (
        <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Create Profile</h2>
            <p>Welcome new user: {address}</p>
            <p>Placeholder: profile creation form goes here.</p>
            <button
                className="border px-3 py-2"
                onClick={onDone}
            >
                Finish
            </button>
        </div>
    )
}