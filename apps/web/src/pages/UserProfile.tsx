import React, { useEffect, useState } from 'react'

type Profile = {
    wallet_address: string
    username?: string
    bio?: string
    followers?: string[]
    following?: string[]
}

const API_BASE = '/api/v1'

export default function UserProfile() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [editing, setEditing] = useState(false)
    const [username, setUsername] = useState('')
    const [bio, setBio] = useState('')

    const token = localStorage.getItem('auth_token') || ''

    useEffect(() => {
        (async () => {
            if (!token) return
            const res = await fetch(`${API_BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) {
                const data = await res.json()
                setProfile(data)
                setUsername(data.username || '')
                setBio(data.bio || '')
            }
        })()
    }, [token])

    const save = async () => {
        const res = await fetch(`${API_BASE}/users/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ username, bio }),
        })
        if (res.ok) {
            setEditing(false)
            const re = await fetch(`${API_BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
            if (re.ok) setProfile(await re.json())
        }
    }

    if (!token) return <div className="p-6">Please sign in to view your profile.</div>
    if (!profile) return <div className="p-6">Loading...</div>

    return (
        <div className="p-6 space-y-4">
            <h2 className="text-2xl font-semibold">My Profile</h2>
            <div>Wallet: {profile.wallet_address}</div>
            {!editing ? (
                <>
                    <div>Username: {profile.username || '-'}</div>
                    <div>Bio: {profile.bio || '-'}</div>
                    <div>Followers: {profile.followers?.length || 0}</div>
                    <div>Following: {profile.following?.length || 0}</div>
                    <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setEditing(true)}>
                        Edit Profile
                    </button>
                </>
            ) : (
                <>
                    <input className="border px-2 py-1 w-full" value={username} onChange={e => setUsername(e.target.value)} />
                    <textarea className="border px-2 py-1 w-full" value={bio} onChange={e => setBio(e.target.value)} rows={4} />
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={save}>Save</button>
                        <button className="px-3 py-2 rounded bg-gray-300" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </>
            )}
        </div>
    )
}