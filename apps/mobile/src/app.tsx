// filepath: d:\canvas\eco-dms\eco-dms\apps\mobile\src\App.tsx
import React, { useEffect, useState } from 'react'
import { SafeAreaView, Text, View, Button } from 'react-native'
import { SignInPanel } from './components/SignInPanel'
import { getMe, logout } from './api'
import { ProfileCreate } from './pages/ProfileCreate'
import { Feed } from './pages/Feed'
import type { AuthResponse } from './hooks/useSIWE'

type ViewState = 'signin' | 'create-profile' | 'feed'

export default function App() {
    const [view, setView] = useState<ViewState>('signin')
    const [address, setAddress] = useState('')

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
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: '600', marginBottom: 16 }}>Eco DMS Mobile SIWE</Text>

            {view === 'signin' && <SignInPanel onAuth={handleAuth} />}

            {view === 'create-profile' && (
                <View style={{ marginTop: 12 }}>
                    <ProfileCreate address={address} onDone={() => setView('feed')} />
                </View>
            )}

            {view === 'feed' && (
                <View style={{ marginTop: 12, gap: 12 }}>
                    <Feed address={address} />
                    <Button
                        title="Logout"
                        onPress={async () => {
                            await logout()
                            setAddress('')
                            setView('signin')
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    )
}