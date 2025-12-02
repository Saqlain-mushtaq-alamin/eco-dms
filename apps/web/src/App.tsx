// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\App.tsx
import React, { useEffect, useState } from 'react'
import { getMe, logout } from './api'
import WalletConnect from './pages/WalletConnect'
import { ProfileCreate } from './pages/ProfileCreate'
import { Feed } from './pages/Feed'
import UserProfile from './pages/UserProfile'

// ! there is a bug need to fix with the page layout when switching between views 
// there i want when the app starts it show the signin page first  that if the user is not authenticated
// and if the user is authenticated it should check if the profile is complete or not 
// if complete go to feed else go to create profile page


type View = 'signin' | 'create-profile' | 'feed' | 'userprofile'

export default function App() {
    const [view, setView] = useState<View>('signin')
    const [address, setAddress] = useState<string>('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Always start on sign-in
        // For clean dev runs, uncomment the next line to clear any stored session:
        // localStorage.removeItem('auth_token')
        setView('signin')
        setLoading(false)
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">Eco DMS Web SIWE</h1>

            {view === 'signin' && (
                <WalletConnect
                    onConnected={async (connectedAddress: string) => {
                        setAddress(connectedAddress)
                        try {
                            const profile = await getMe()
                            // If profile exists (has username), go to feed, otherwise to create-profile
                            if (profile?.username && profile.username.trim()) {
                                setView('feed')
                            } else {
                                setView('create-profile')
                            }
                        } catch (err) {
                            // If getMe fails (e.g., no token yet), default to create-profile
                            console.log('getMe after connect failed:', err)
                            setView('create-profile')
                        }
                    }}
                />
            )}

            {view === 'create-profile' && address && (
                <ProfileCreate
                    address={address}
                    onDone={() => setView('feed')}
                />
            )}

            {view === 'feed' && address && (
                <>
                    <Feed address={address} />

                    <div className="flex gap-2 mt-4 flex-wrap">
                        <button
                            className="border px-3 py-2 bg-blue-600 text-white"
                            onClick={() => setView('userprofile')}
                        >
                            View Profile
                        </button>
                        <button
                            className="border px-3 py-2 bg-blue-600 text-white"
                            onClick={() => setView('create-profile')}
                        >
                            Edit Profile
                        </button>
                        <button
                            className="border px-3 py-2 bg-red-600 text-white"
                            onClick={async () => {
                                await logout()
                                setView('signin')
                                setAddress('')
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </>
            )}

            {view === 'userprofile' && address && (
                <UserProfile
                    address={address}
                    onBack={() => setView('feed')}
                />
            )}
        </div>
    )
}

// In WalletConnect.tsx
export async function verifySignature(message: string, signature: string) {
    const r = await fetch(`/api/siwe/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, signature })
    })
    if (!r.ok) throw new Error('verify failed')

    const data = await r.json()

    // Store the JWT token
    if (data.token) {
        localStorage.setItem('auth_token', data.token)
        console.log('Token stored')
    }

    return data
}


