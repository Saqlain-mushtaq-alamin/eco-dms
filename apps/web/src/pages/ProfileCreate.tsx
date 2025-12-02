import React from 'react'
import { API_BASE } from '../api'

export function ProfileCreate({ address, onDone }: { address: string; onDone: () => void }) {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    return (
        <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Create Profile</h2>
            <p>Welcome new user: {address}</p>
            {error && <div className="text-red-600">{error}</div>}
            <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true)
                setError('')

                const token = localStorage.getItem('auth_token')
                if (!token) {
                    setError('Not authenticated')
                    setLoading(false)
                    return
                }

                const formData = new FormData(e.currentTarget);
                const username = formData.get('username') as string;
                const bio = formData.get('bio') as string;

                try {
                    const response = await fetch(`${API_BASE}/api/users/me`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        credentials: 'include',
                        body: JSON.stringify({ username, bio }),
                    });

                    if (response.ok) {
                        console.log('Profile created successfully')
                        onDone();
                    } else {
                        const errorData = await response.text()
                        console.error('Failed to create profile:', errorData)
                        setError(`Failed: ${response.status}`)
                    }
                } catch (error) {
                    console.error('Profile update failed:', error);
                    setError('Network error')
                } finally {
                    setLoading(false)
                }
            }}>
                <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input type="text" name="username" className="border px-3 py-2 w-full" placeholder="Enter username" required />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Bio</label>
                    <textarea name="bio" className="border px-3 py-2 w-full" placeholder="Enter bio" rows={3} />
                </div>
                <button type="submit" disabled={loading} className="border px-3 py-2 bg-blue-600 text-white disabled:opacity-50">
                    {loading ? 'Creating...' : 'Create Profile'}
                </button>
            </form>
        </div>
    )
}