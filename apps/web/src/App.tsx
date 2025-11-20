// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\App.tsx
import React, { useEffect, useState } from 'react'
import { SignInPanel } from './components/SignInPanel'
import { getMe, logout } from './api'
import { ProfileCreate } from './pages/ProfileCreate'
import { Feed } from './pages/Feed'
import type { AuthResponse } from './hooks/useSIWE'

type View = 'signin' | 'create-profile' | 'feed'

export default function App() {
    const [view, setView] = useState<View>('signin')
    const [address, setAddress] = useState<string>('')

    // Try existing session on load
    useEffect(() => {
        ; (async () => {
            try {
                const me = await getMe()
                setAddress(me.address)
                setView('feed')
            } catch {
                setView('signin')
            }
        })()
    }, [])

    const handleAuth = (auth: AuthResponse) => {
        setAddress(auth.address)
        if (auth.is_new) setView('create-profile')
        else setView('feed')
    }

    return (
        <div className="max-w-xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">Eco DMS Web SIWE</h1>

            {view === 'signin' && <SignInPanel onAuth={handleAuth} />}

            {view === 'create-profile' && (
                <ProfileCreate
                    address={address}
                    onDone={() => setView('feed')}
                />
            )}

            {view === 'feed' && (
                <>
                    <Feed address={address} />
                    <button
                        className="border px-3 py-2 mt-4"
                        onClick={async () => {
                            await logout()
                            setView('signin')
                            setAddress('')
                        }}
                    >
                        Logout
                    </button>
                </>
            )}
        </div>
    )
}