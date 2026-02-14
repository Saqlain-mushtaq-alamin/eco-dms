import React from 'react'
import { Button, Card, Input } from '@eco-dms/ui'
import { API_BASE } from '../api'

export function ProfileCreate({ address, onDone }: { address: string; onDone: () => void }) {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [username, setUsername] = React.useState('')
    const [bio, setBio] = React.useState('')
    const [errors, setErrors] = React.useState<{ username?: string; bio?: string }>({})

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setErrors({})

        if (!username.trim()) {
            setErrors({ username: 'Username is required' })
            setLoading(false)
            return
        }

        const token = localStorage.getItem('auth_token')
        if (!token) {
            setError('Not authenticated')
            setLoading(false)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/api/users/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ username, bio }),
            })

            if (response.ok) {
                console.log('Profile created successfully')
                onDone()
            } else {
                const errorData = await response.text()
                console.error('Failed to create profile:', errorData)
                setError(`Failed: ${response.status}`)
            }
        } catch (error) {
            console.error('Profile update failed:', error)
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card padding="lg" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>Create Profile</h2>
            <p style={{ marginBottom: 16, color: '#6b7280' }}>Welcome new user: {address.slice(0, 6)}...{address.slice(-4)}</p>

            {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                    error={errors.username}
                />
                <Input
                    label="Bio"
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    multiline
                    numberOfLines={3}
                />
                <Button
                    title={loading ? 'Creating...' : 'Create Profile'}
                    onPress={handleSubmit}
                    disabled={loading}
                    variant="primary"
                />
            </form>
        </Card>
    )
}