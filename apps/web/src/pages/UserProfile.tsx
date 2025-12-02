import React, { useEffect, useState } from 'react'
import { getMe } from '../api'

type Profile = {
    wallet_address: string
    username?: string
    bio?: string
    followers?: string[]
    following?: string[]
    [key: string]: any
}

interface UserProfileProps {
    address: string
    onBack: () => void
}

export default function UserProfile({ address, onBack }: UserProfileProps) {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [editing, setEditing] = useState(false)
    const [username, setUsername] = useState('')
    const [bio, setBio] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchProfile = async () => {
        try {
            setLoading(true)
            const data = await getMe()
            console.log('Profile data:', data)
            setProfile(data)
            setUsername(data.username || '')
            setBio(data.bio || '')
        } catch (err) {
            console.error('Fetch error:', err)
            setError('Failed to load profile. Please sign in again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (address) {
            fetchProfile()
        }
    }, [address])

    const save = async () => {
        try {
            const res = await fetch('/api/users/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, bio }),
            })
            if (res.ok) {
                setEditing(false)
                fetchProfile()
                alert('Profile updated successfully')
            } else {
                setError('Failed to save profile')
            }
        } catch (err) {
            console.error('Save error:', err)
            setError('Failed to save profile')
        }
    }

    if (!address) return <div className="p-6">Please sign in to view your profile.</div>
    if (loading) return <div className="p-6">Loading...</div>
    if (error) return <div className="p-6 text-red-600">{error}</div>
    if (!profile) return <div className="p-6">No profile data found.</div>

    return (
        <div className="p-6 space-y-4">
            <h2 className="text-2xl font-semibold">My Profile</h2>
            {!editing ? (
                <>
                    {Object.entries(profile).map(([key, value]) => (
                        <div key={key} className="py-2">
                            <strong className="capitalize">{key.replace(/_/g, ' ')}:</strong>
                            {' '}
                            {Array.isArray(value) ? value.join(', ') || '-' : String(value) || '-'}
                        </div>
                    ))}
                    <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setEditing(true)}>
                        Edit Profile
                    </button>
                    <button className="px-3 py-2 rounded bg-gray-400 text-white mt-2" onClick={onBack}>
                        Back to Feed
                    </button>
                </>
            ) : (
                <>
                    <input className="border px-2 py-1 w-full" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                    <textarea className="border px-2 py-1 w-full" placeholder="Bio" value={bio} onChange={e => setBio(e.target.value)} rows={4} />
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={save}>Save</button>
                        <button className="px-3 py-2 rounded bg-gray-300" onClick={() => setEditing(false)}>Cancel</button>
                        <button className="px-3 py-2 rounded bg-gray-400 text-white" onClick={onBack}>Back to Feed</button>
                    </div>
                </>
            )}
        </div>
    )
}