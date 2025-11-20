// filepath: d:\canvas\eco-dms\eco-dms\apps\web\src\components\SignInPanel.tsx
import React from 'react'
import { MetaMaskButton } from './MetaMaskButton'
import { WalletConnectButton } from './WalletConnectButton'
import { useSIWE } from '../hooks/useSIWE'

export function SignInPanel({ onAuth }: { onAuth: () => void }) {
    const { signInWithMetaMask } = useSIWE()

    return (
        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
            <MetaMaskButton onClick={async () => { await signInWithMetaMask(); onAuth(); }} />
            <WalletConnectButton onAuth={onAuth} />
        </div>
    )
}
