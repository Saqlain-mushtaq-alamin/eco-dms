import React, { useEffect, useState } from 'react'
import { getMe } from '../api'
import { Button, Card, Input, ProfileCard, LoadingSpinner } from '@eco-dms/ui'

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
    if (loading) return <div className="p-6"><LoadingSpinner /></div>
    if (error) return <div className="p-6 text-red-600">{error}</div>
    if (!profile) return <div className="p-6">No profile data found.</div>

    return (
        <div className="p-6 space-y-4">
            <h2 className="text-2xl font-semibold">My Profile</h2>
            <ProfileCard
                address={profile.wallet_address || address}
                username={profile.username}
                bio={profile.bio}
                avatarUri={profile.avatar_cid ? `https://${profile.avatar_cid}.ipfs.nftstorage.link` : undefined}
                ecoScore={Number(profile.eco_score || 0)}
                verifiedActions={Number(profile.verified_actions || 0)}
            />
            {!editing ? (
                <>
                    <Card>
                        {Object.entries(profile).map(([key, value]) => (
                            <div key={key} className="py-2">
                                <strong className="capitalize">{key.replace(/_/g, ' ')}:</strong>
                                {' '}
                                {Array.isArray(value) ? value.join(', ') || '-' : String(value) || '-'}
                            </div>
                        ))}
                    </Card>
                    <div className="flex gap-2">
                        <Button title="Edit Profile" onPress={() => setEditing(true)} />
                        <Button title="Back to Feed" onPress={onBack} variant="secondary" />
                    </div>
                </>
            ) : (
                <>
                    <Input
                        label="Username"
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Username"
                    />
                    <Input
                        label="Bio"
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Bio"
                        multiline
                        numberOfLines={4}
                    />
                    <div className="flex gap-2">
                        <Button title="Save" onPress={save} />
                        <Button title="Cancel" onPress={() => setEditing(false)} variant="outline" />
                        <Button title="Back to Feed" onPress={onBack} variant="secondary" />
                    </div>
                </>
            )}
        </div>
    )
}