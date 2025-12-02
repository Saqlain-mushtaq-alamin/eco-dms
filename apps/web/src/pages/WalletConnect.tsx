import React, { useState } from 'react'
import { getNonce, prepareMessage, verifySignature } from '../api'

export default function WalletConnect({ onConnected }: { onConnected: (address: string) => void }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleConnect = async () => {
        setLoading(true)
        setError('')

        try {
            // Get wallet address from MetaMask
            const accounts = await (window as any).ethereum.request({
                method: 'eth_requestAccounts'
            })
            const address = accounts[0]
            console.log('Connected:', address)

            // Get nonce
            const { nonce } = await getNonce()
            console.log('Got nonce:', nonce)

            // Prepare message
            const { message } = await prepareMessage(address, 1, nonce)
            console.log('Got message to sign')

            // Sign message
            const signature = await (window as any).ethereum.request({
                method: 'personal_sign',
                params: [message, address]
            })
            console.log('Got signature')

            // Verify signature
            const result = await verifySignature(message, signature)
            console.log('Signature verified:', result)

            // Call onConnected callback
            onConnected(address)
        } catch (err: any) {
            console.error('Connect error:', err)
            setError(err.message || 'Connection failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Sign In with Ethereum</h2>
            {error && <div className="text-red-600">{error}</div>}
            <button
                onClick={handleConnect}
                disabled={loading}
                className="border px-4 py-2 bg-blue-600 text-white disabled:opacity-50 w-full"
            >
                {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
        </div>
    )
}