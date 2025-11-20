import React from 'react'
import { MetaMaskButton } from './MetaMaskButton'
import { WalletConnectButton } from './WalletConnectButton'
import { useSIWE } from '../hooks/useSIWE'
import type { AuthResponse } from '../hooks/useSIWE'

export function SignInPanel({ onAuth }: { onAuth: (auth: AuthResponse) => void }) {
    const { signInWithMetaMask } = useSIWE()
    return (
        <div className="flex flex-col gap-3">
            <MetaMaskButton
                onClick={async () => {
                    const auth = await signInWithMetaMask()
                    onAuth(auth)
                }}
            />
            <WalletConnectButton
                onAuth={async (auth: AuthResponse) => {
                    onAuth(auth)
                }}
            />
        </div>
    )
}