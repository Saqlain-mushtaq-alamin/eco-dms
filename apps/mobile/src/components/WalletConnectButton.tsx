// filepath: d:\canvas\eco-dms\eco-dms\apps\mobile\src\components\WalletConnectButton.tsx
import React from 'react'
import { Button, Alert } from 'react-native'
import type { AuthResponse } from '../hooks/useSIWE'

// Placeholder (implement real WalletConnect later)
export function WalletConnectButton({ onAuth }: { onAuth: (auth: AuthResponse) => void }) {
    return (
        <Button
            title="Mock WalletConnect Sign-In"
            onPress={() => {
                // Simulate existing user (is_new false)
                onAuth({ address: '0x0000000000000000000000000000000000000002', is_new: false })
                Alert.alert('WalletConnect', 'Mock sign-in successful')
            }}
        />
    )
}


