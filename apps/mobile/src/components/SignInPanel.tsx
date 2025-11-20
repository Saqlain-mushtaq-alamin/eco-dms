// filepath: d:\canvas\eco-dms\eco-dms\apps\mobile\src\components\SignInPanel.tsx
import React from 'react'
import { View, Button, Alert } from 'react-native'
import { WalletConnectButton } from './WalletConnectButton'
import { useSIWE } from '../hooks/useSIWE'
import type { AuthResponse } from '../hooks/useSIWE'

// Temporary mock sign-in (replace with real deep link + signature flow)
async function mockSignatureProvider(message: string): Promise<string> {
    // In production, open wallet, sign message, return signature
    return '0x' + '1'.repeat(130) // placeholder signature
}

export function SignInPanel({ onAuth }: { onAuth: (auth: AuthResponse) => void }) {
    const { signWithExternalWallet } = useSIWE()

    async function mockMetaMaskFlow() {
        try {
            // Demo address (replace with selected wallet address)
            const demoAddress = '0x0000000000000000000000000000000000000001'
            const chainId = 1
            const auth = await signWithExternalWallet(demoAddress, chainId, mockSignatureProvider)
            onAuth(auth)
        } catch (e) {
            Alert.alert('Sign-In Failed', String(e))
        }
    }

    return (
        <View style={{ gap: 12 }}>
            <Button title="Mock MetaMask Sign-In" onPress={mockMetaMaskFlow} />
            <WalletConnectButton onAuth={onAuth} />
        </View>
    )
}